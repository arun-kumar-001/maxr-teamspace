import { PaginatedResponse } from '@maxr/shared';
import { conflict } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
import { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { IAttendanceRepository } from './attendance.repository';
import { SORTABLE_ATTENDANCE_FIELDS } from './attendance.schemas';
import {
  AttendanceRecord,
  CheckInDto,
  CheckOutDto,
  ListAttendanceQuery,
  TodayAttendanceSummary,
} from './attendance.types';

export interface RequestContext {
  actorId: string;
  requestId?: string;
}

type PlatformDeps = Pick<PlatformServices, 'audit' | 'events'>;

export class AttendanceService {
  constructor(
    private readonly repository: IAttendanceRepository,
    private readonly platform: PlatformDeps,
  ) {}

  /**
   * Helper to format UTC Date as YYYY-MM-DD
   */
  private getTodayDateString(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  async getActiveSession(employeeId: string): Promise<AttendanceRecord | null> {
    return this.repository.findActiveSession(employeeId);
  }

  async getTodaySummary(
    employeeId: string,
    workDate = this.getTodayDateString(),
  ): Promise<TodayAttendanceSummary> {
    const todaySessions = await this.repository.findTodaySessions(employeeId, workDate);
    const activeSession = todaySessions.find((s) => s.checkOutTime === null) ?? null;
    const completedSessions = todaySessions.filter((s) => s.checkOutTime !== null);

    let totalWorkedMinutes = 0;
    for (const session of completedSessions) {
      if (session.durationMinutes) {
        totalWorkedMinutes += session.durationMinutes;
      }
    }

    // If an active session is in progress, also account for elapsed minutes so far
    if (activeSession) {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(activeSession.checkInTime).getTime()) / 60000),
      );
      totalWorkedMinutes += elapsed;
    }

    return {
      date: workDate,
      activeSession,
      completedSessions,
      totalWorkedMinutes,
      status: activeSession ? 'PRESENT' : completedSessions.length > 0 ? 'PRESENT' : 'ON_LEAVE',
    };
  }

  async checkIn(
    employeeId: string,
    dto: CheckInDto,
    ctx: RequestContext,
  ): Promise<AttendanceRecord> {
    // 1. Verify there is no ongoing open session
    const existingActive = await this.repository.findActiveSession(employeeId);
    if (existingActive) {
      throw conflict('An active attendance session is already open. Please check out first.');
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();
    const workDate = this.getTodayDateString();

    try {
      const created = await this.repository.createCheckIn(employeeId, workDate, dto);

      await audit.record({
        action: 'attendance.check_in',
        outcome: 'success',
        entityType: 'attendance_record',
        entityId: created.id,
      });

      events.add({
        type: 'attendance.checked_in',
        payload: { id: created.id, employeeId, checkInTime: created.checkInTime },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return created;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'attendance.check_in',
        outcome: 'failure',
        entityType: 'attendance_record',
      });
      throw err;
    }
  }

  async checkOut(
    employeeId: string,
    dto: CheckOutDto,
    ctx: RequestContext,
  ): Promise<AttendanceRecord> {
    // 1. Find the active open session
    const active = await this.repository.findActiveSession(employeeId);
    if (!active) {
      throw conflict('No active attendance session found to check out.');
    }

    const checkOutTime = new Date().toISOString();
    const durationMinutes = Math.max(
      0,
      Math.round(
        (new Date(checkOutTime).getTime() - new Date(active.checkInTime).getTime()) / 60000,
      ),
    );

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const updated = await this.repository.createCheckOut(
        active.id,
        checkOutTime,
        durationMinutes,
        dto.notes,
      );

      if (!updated) {
        throw conflict('Attendance session has already been finalized.');
      }

      await audit.record({
        action: 'attendance.check_out',
        outcome: 'success',
        entityType: 'attendance_record',
        entityId: updated.id,
        changes: { durationMinutes },
      });

      events.add({
        type: 'attendance.checked_out',
        payload: { id: updated.id, employeeId, durationMinutes, checkOutTime },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return updated;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'attendance.check_out',
        outcome: 'failure',
        entityType: 'attendance_record',
      });
      throw err;
    }
  }

  async listHistory(
    employeeId: string,
    query: ListAttendanceQuery,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const sort = resolveSort(query, SORTABLE_ATTENDANCE_FIELDS, {
      column: 'checkInTime',
      order: 'desc',
    });
    const { items, total } = await this.repository.findMany(employeeId, {
      ...toOffsetLimit(query),
      sort,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
    });
    return buildPage(items, total, query);
  }

  async listAll(
    query: ListAttendanceQuery,
    scope?: { employeeIds?: string[] },
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const sort = resolveSort(query, SORTABLE_ATTENDANCE_FIELDS, {
      column: 'checkInTime',
      order: 'desc',
    });
    const { items, total } = await this.repository.findAll({
      ...toOffsetLimit(query),
      sort,
      employeeId: query.employeeId,
      employeeIds: scope?.employeeIds,
      startDate: query.startDate,
      endDate: query.endDate,
      status: query.status,
    });
    return buildPage(items, total, query);
  }
}
