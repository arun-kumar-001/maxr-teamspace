import { PaginatedResponse } from '@maxr/shared';
import { badRequest, conflict, forbidden, notFound } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
import { AuditLogger } from '../../platform/audit/types';
import { ScopeFilter } from '../rbac';
import {
  ATTENDANCE_SORTABLE_FIELDS,
  CheckInInput,
  CheckOutInput,
  ListAttendanceQuery,
} from './attendance.schemas';
import { IAttendanceRepository } from './attendance.repository';
import { AttendanceRecord, TodayAttendanceSummary } from './attendance.types';

import { CompanySettingsReader } from '../settings';

export interface RequestContext {
  actorId: string;
  actorRole: string;
  employeeId?: string;
  requestId?: string;
}

const DEFAULT_SETTINGS_READER: CompanySettingsReader = {
  getBasic: async () => ({
    companyName: 'MAXR Teamspace',
    timezone: 'UTC',
    workWeek: {
      start: 'Monday',
      end: 'Friday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
  }),
};

export class AttendanceService {
  private readonly settingsReader: CompanySettingsReader;

  constructor(
    private readonly repo: IAttendanceRepository,
    private readonly audit?: AuditLogger,
    settingsReader?: CompanySettingsReader,
    private readonly isEmployeeActive: (employeeId: string) => Promise<boolean> | boolean = (id) =>
      repo.isEmployeeActive(id),
  ) {
    this.settingsReader = settingsReader ?? DEFAULT_SETTINGS_READER;
  }

  private async getWorkDate(date = new Date()): Promise<string> {
    const { timezone } = await this.settingsReader.getBasic();
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date);
  }

  async getActiveSession(employeeId: string): Promise<AttendanceRecord | null> {
    return this.repo.findActiveSession(employeeId);
  }

  async getTodaySummary(employeeId: string): Promise<TodayAttendanceSummary> {
    const today = await this.getWorkDate();
    const sessions = await this.repo.findTodaySessions(employeeId, today);
    const activeSession = sessions.find((s) => s.checkOutTime === null) ?? null;

    const totalDurationMinutes = sessions.reduce((acc, s) => {
      if (s.durationMinutes) return acc + s.durationMinutes;
      if (s.checkOutTime === null) {
        const diffMs = Date.now() - new Date(s.checkInTime).getTime();
        return acc + Math.max(0, Math.round(diffMs / 60000));
      }
      return acc;
    }, 0);

    return {
      workDate: today,
      totalDurationMinutes,
      sessionsCount: sessions.length,
      activeSession,
      sessions,
    };
  }

  async checkIn(
    employeeId: string,
    dto: CheckInInput,
    ctx: RequestContext,
  ): Promise<AttendanceRecord> {
    const active = await this.isEmployeeActive(employeeId);
    if (!active) {
      throw forbidden('Deactivated employee cannot perform attendance check-in');
    }

    const openSession = await this.repo.findActiveSession(employeeId);
    if (openSession) {
      throw conflict('An open attendance session already exists. Please check out first.');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const workDate = await this.getWorkDate(now);

    const record = await this.repo.createCheckIn(employeeId, workDate, dto, nowIso);

    await this.audit?.tryRecord({
      action: 'attendance.check_in',
      outcome: 'success',
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      entityType: 'attendance_record',
      entityId: record.id,
      metadata: { workDate, checkInTime: nowIso, location: dto.location },
      requestId: ctx.requestId,
    });

    return record;
  }

  async checkOut(
    employeeId: string,
    dto: CheckOutInput,
    ctx: RequestContext,
  ): Promise<AttendanceRecord> {
    const active = await this.isEmployeeActive(employeeId);
    if (!active) {
      throw forbidden('Deactivated employee cannot perform attendance check-out');
    }

    const openSession = await this.repo.findActiveSession(employeeId);
    if (!openSession) {
      throw badRequest('No active attendance session found to check out');
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const checkInMs = new Date(openSession.checkInTime).getTime();
    const durationMinutes = Math.max(0, Math.round((now.getTime() - checkInMs) / 60000));

    const updated = await this.repo.createCheckOut(
      openSession.id,
      nowIso,
      durationMinutes,
      dto.notes,
    );

    if (!updated) {
      throw notFound('Session already closed or missing');
    }

    await this.audit?.tryRecord({
      action: 'attendance.check_out',
      outcome: 'success',
      actorId: ctx.actorId,
      actorRole: ctx.actorRole,
      entityType: 'attendance_record',
      entityId: updated.id,
      metadata: { checkOutTime: nowIso, durationMinutes },
      requestId: ctx.requestId,
    });

    return updated;
  }

  async list(
    query: ListAttendanceQuery,
    scope: ScopeFilter,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    const sort = resolveSort(query, ATTENDANCE_SORTABLE_FIELDS, {
      column: 'workDate',
      order: 'desc',
    });
    const { offset, limit } = toOffsetLimit(query);

    const { items, total } = await this.repo.findMany(
      {
        offset,
        limit,
        sort,
        employeeId: query.employeeId,
        startDate: query.startDate,
        endDate: query.endDate,
        status: query.status,
      },
      scope,
    );

    return buildPage(items, total, query);
  }

  async listHistory(
    employeeId: string,
    query: ListAttendanceQuery,
    scope: ScopeFilter,
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    return this.list({ ...query, employeeId }, scope);
  }
}
