import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../http/errors';
import { buildPage, resolveSort, toOffsetLimit } from '../../http/pagination';
import { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { IShiftsRepository } from './shifts.repository';
import { SORTABLE_SHIFT_FIELDS } from './shifts.schemas';
import {
  AssignEmployeeShiftDto,
  AttendancePolicy,
  CreateShiftDto,
  EmployeeShift,
  ListShiftsQuery,
  Shift,
  UpdateAttendancePolicyDto,
  UpdateShiftDto,
} from './shifts.types';

export interface RequestContext {
  actorId: string;
  actorRole?: string;
  requestId?: string;
}

type PlatformDeps = Pick<PlatformServices, 'audit' | 'events'>;

export class ShiftsService {
  constructor(
    private readonly repository: IShiftsRepository,
    private readonly platform: PlatformDeps,
  ) {}

  async listShifts(query: ListShiftsQuery): Promise<PaginatedResponse<Shift>> {
    const sort = resolveSort(query, SORTABLE_SHIFT_FIELDS, {
      column: 'createdAt',
      order: 'desc',
    });
    const { items, total } = await this.repository.findShifts({
      ...toOffsetLimit(query),
      sort,
      isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
    });
    return buildPage(items, total, query);
  }

  async getShiftById(id: string): Promise<Shift> {
    const shift = await this.repository.findShiftById(id);
    if (!shift) {
      throw notFound(`Shift with id ${id} was not found`);
    }
    return shift;
  }

  async createShift(dto: CreateShiftDto, ctx: RequestContext): Promise<Shift> {
    // 1. Verify code uniqueness
    const existing = await this.repository.findShiftByCode(dto.code);
    if (existing) {
      throw conflict(`Shift with code ${dto.code} already exists`);
    }

    // 2. Validate timing
    if (dto.startTime === dto.endTime) {
      throw unprocessable('Shift start time and end time cannot be identical');
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const created = await this.repository.createShift(dto);

      await audit.record({
        action: 'shift.create',
        outcome: 'success',
        entityType: 'shift',
        entityId: created.id,
        changes: { code: created.code, name: created.name },
      });

      events.add({
        type: 'shift.created',
        payload: { id: created.id, code: created.code, name: created.name },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return created;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'shift.create',
        outcome: 'failure',
        entityType: 'shift',
      });
      throw err;
    }
  }

  async updateShift(id: string, dto: UpdateShiftDto, ctx: RequestContext): Promise<Shift> {
    const existing = await this.repository.findShiftById(id);
    if (!existing) {
      throw notFound(`Shift with id ${id} was not found`);
    }

    if (dto.code && dto.code.toUpperCase() !== existing.code) {
      const withSameCode = await this.repository.findShiftByCode(dto.code);
      if (withSameCode && withSameCode.id !== id) {
        throw conflict(`Shift with code ${dto.code} already exists`);
      }
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const updated = (await this.repository.updateShift(id, dto))!;

      await audit.record({
        action: 'shift.update',
        outcome: 'success',
        entityType: 'shift',
        entityId: updated.id,
      });

      events.add({
        type: 'shift.updated',
        payload: { id: updated.id, code: updated.code },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return updated;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'shift.update',
        outcome: 'failure',
        entityType: 'shift',
        entityId: id,
      });
      throw err;
    }
  }

  async assignEmployeeShift(
    dto: AssignEmployeeShiftDto,
    ctx: RequestContext,
  ): Promise<EmployeeShift> {
    const shift = await this.repository.findShiftById(dto.shiftId);
    if (!shift) {
      throw notFound(`Shift with id ${dto.shiftId} was not found`);
    }

    const audit = this.platform.audit.withContext(ctx);
    const events = new EventCollector();

    try {
      const assigned = await this.repository.assignEmployeeShift(dto);

      await audit.record({
        action: 'employee_shift.assign',
        outcome: 'success',
        entityType: 'employee_shift',
        entityId: assigned.id,
        changes: { employeeId: dto.employeeId, shiftId: dto.shiftId },
      });

      events.add({
        type: 'employee_shift.assigned',
        payload: { id: assigned.id, employeeId: dto.employeeId, shiftId: dto.shiftId },
        actorId: ctx.actorId,
        requestId: ctx.requestId,
      });

      await events.flush(this.platform.events);
      return assigned;
    } catch (err) {
      events.discard();
      await audit.tryRecord({
        action: 'employee_shift.assign',
        outcome: 'failure',
        entityType: 'employee_shift',
      });
      throw err;
    }
  }

  async getEmployeeShifts(employeeId: string): Promise<EmployeeShift[]> {
    return this.repository.findEmployeeShifts(employeeId);
  }

  async getAttendancePolicy(): Promise<AttendancePolicy> {
    return this.repository.getAttendancePolicy();
  }

  async updateAttendancePolicy(
    dto: UpdateAttendancePolicyDto,
    ctx: RequestContext,
  ): Promise<AttendancePolicy> {
    const audit = this.platform.audit.withContext(ctx);
    try {
      const updated = await this.repository.updateAttendancePolicy(dto);
      await audit.record({
        action: 'attendance_policy.update',
        outcome: 'success',
        entityType: 'attendance_policy',
        entityId: updated.id,
      });
      return updated;
    } catch (err) {
      await audit.tryRecord({
        action: 'attendance_policy.update',
        outcome: 'failure',
        entityType: 'attendance_policy',
      });
      throw err;
    }
  }
}
