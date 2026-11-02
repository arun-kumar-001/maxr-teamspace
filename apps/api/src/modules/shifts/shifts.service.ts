import { conflict, notFound, unprocessable } from '../../http/errors';
import type { PlatformServices } from '../../platform';
import { EventCollector } from '../../platform/events/event-bus';
import { ScopeFilter } from '../rbac';
import type { CompanySettingsReader } from '../settings';
import { IShiftsRepository } from './shifts.repository';
import {
  AttendancePolicyView,
  NewAssignment,
  NewShift,
  Shift,
  ShiftAssignment,
  ShiftPatch,
  ShiftResolver,
  ShiftSummary,
} from './shifts.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** Who is calling, taken from the session by the route, never from the body. */
export interface ShiftsCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayBefore = (isoDate: string): string =>
  new Date(new Date(`${isoDate}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);

const summary = (s: Shift): ShiftSummary => ({
  id: s.id,
  code: s.code,
  name: s.name,
  startTime: s.startTime,
  endTime: s.endTime,
  graceMinutes: s.graceMinutes,
  crossesMidnight: s.crossesMidnight,
});

export class ShiftsService implements ShiftResolver {
  constructor(
    private readonly repository: IShiftsRepository,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
  ) {}

  /** Today's date in the company timezone, the day "still in force" is counted from. */
  private async today(): Promise<string> {
    const { timezone } = await this.settings.getBasic();
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  }

  private audit(caller: ShiftsCaller) {
    return this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
  }

  listShifts(filter: { isActive?: boolean }): Promise<Shift[]> {
    return this.repository.listShifts(filter);
  }

  async getShift(id: string): Promise<Shift> {
    const shift = await this.repository.findShift(id);
    if (!shift) throw notFound('Shift not found');
    return shift;
  }

  async createShift(dto: NewShift, caller: ShiftsCaller): Promise<Shift> {
    const audit = this.audit(caller);
    try {
      return await this.repository.transaction(async (tx) => {
        if (await this.repository.codeTaken(tx, dto.code)) {
          throw conflict('A shift with this code already exists');
        }
        const shift = await this.repository.insertShift(tx, dto);
        await audit.record(
          {
            action: 'shift.create',
            outcome: 'success',
            entityType: 'shift',
            entityId: shift.id,
            changes: {
              code: shift.code,
              startTime: shift.startTime,
              endTime: shift.endTime,
              graceMinutes: shift.graceMinutes,
              crossesMidnight: shift.crossesMidnight,
            },
          },
          { transaction: tx },
        );
        return shift;
      });
    } catch (err) {
      await audit.tryRecord({ action: 'shift.create', outcome: 'failure', entityType: 'shift' });
      throw err;
    }
  }

  async updateShift(id: string, patch: ShiftPatch, caller: ShiftsCaller): Promise<Shift> {
    const audit = this.audit(caller);
    const today = await this.today();
    try {
      return await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockShift(tx, id);
        if (!current) throw notFound('Shift not found');

        const changed = (Object.keys(patch) as Array<keyof ShiftPatch>).filter(
          (k) => patch[k] !== current[k],
        );
        if (changed.length === 0) return current;

        const startTime = patch.startTime ?? current.startTime;
        const endTime = patch.endTime ?? current.endTime;
        if (startTime === endTime) {
          throw unprocessable('A shift cannot start and end at the same time', [
            { field: 'endTime', message: 'Same as the start time' },
          ]);
        }
        if (patch.isActive === false && current.isActive) {
          const usage = await this.repository.shiftUsage(tx, id, today);
          if (usage.isDefault || usage.assignments > 0) {
            throw unprocessable('This shift is in use and cannot be deactivated', [
              {
                field: 'isActive',
                message: usage.isDefault
                  ? 'It is the default shift of the attendance policy'
                  : `${usage.assignments} employee assignment(s) are still in force`,
              },
            ]);
          }
        }

        const updated = await this.repository.updateShift(tx, id, patch);
        await audit.record(
          {
            action: 'shift.update',
            outcome: 'success',
            entityType: 'shift',
            entityId: id,
            changes: {
              fields: changed,
              ...Object.fromEntries(changed.map((k) => [k, { from: current[k], to: updated[k] }])),
            },
          },
          { transaction: tx },
        );
        return updated;
      });
    } catch (err) {
      await audit.tryRecord({
        action: 'shift.update',
        outcome: 'failure',
        entityType: 'shift',
        entityId: id,
      });
      throw err;
    }
  }

  async listAssignments(
    employeeId: string,
    filter: ScopeFilter,
    caller: ShiftsCaller,
  ): Promise<ShiftAssignment[]> {
    if (!(await this.repository.isVisible(employeeId, filter, caller.employeeId))) {
      throw notFound('Employee not found');
    }
    return this.repository.listAssignments(employeeId);
  }

  /**
   * Gives an employee a shift from a date, with an optional end date. An employee has one shift per
   * date: a new open-ended assignment that starts after the start of the current open-ended one
   * ends that one the day before (the normal "from the 1st they work the night shift"); any
   * other overlap is a 409 that names the dates in the way. The database exclusion constraint is
   * the backstop for two requests at once.
   */
  async assign(dto: NewAssignment, caller: ShiftsCaller): Promise<ShiftAssignment> {
    const audit = this.audit(caller);
    const events = new EventCollector();
    try {
      const created = await this.repository.transaction(async (tx) => {
        const employee = await this.repository.lockEmployee(tx, dto.employeeId);
        if (!employee) throw notFound('Employee not found');
        if (employee.status === 'deactivated') {
          throw unprocessable('A deactivated employee cannot be given a shift');
        }
        const shift = await this.repository.lockShift(tx, dto.shiftId);
        if (!shift || !shift.isActive) {
          throw unprocessable('The shift does not exist or is not active', [
            { field: 'shiftId', message: 'Shift is missing or inactive' },
          ]);
        }

        const overlaps = await this.repository.findOverlapping(
          tx,
          dto.employeeId,
          dto.effectiveFrom,
          dto.effectiveTo,
        );
        let ended: { id: string; effectiveTo: string } | null = null;
        const [only] = overlaps;
        if (
          overlaps.length === 1 &&
          only &&
          only.effectiveTo === null &&
          only.effectiveFrom < dto.effectiveFrom &&
          dto.effectiveTo === null
        ) {
          ended = { id: only.id, effectiveTo: dayBefore(dto.effectiveFrom) };
          await this.repository.endAssignment(tx, only.id, ended.effectiveTo);
        } else if (overlaps.length > 0) {
          throw conflict(
            `The employee already has a shift on these dates: ${overlaps
              .map((o) => `${o.shift.code} from ${o.effectiveFrom} to ${o.effectiveTo ?? 'no end'}`)
              .join('; ')}`,
          );
        }

        let assignment: ShiftAssignment;
        try {
          assignment = await this.repository.insertAssignment(tx, dto);
        } catch (err) {
          // Two requests passed the check together: the exclusion constraint decided.
          if ((err as { code?: string }).code === '23P01') {
            throw conflict('The employee already has a shift on these dates');
          }
          throw err;
        }
        await audit.record(
          {
            action: 'shift.assign',
            outcome: 'success',
            entityType: 'employee_shift',
            entityId: assignment.id,
            changes: {
              employeeId: dto.employeeId,
              shiftId: dto.shiftId,
              effectiveFrom: dto.effectiveFrom,
              effectiveTo: dto.effectiveTo,
              ...(ended ? { endedPrevious: ended } : {}),
            },
          },
          { transaction: tx },
        );
        events.add({
          type: 'shift.assigned',
          payload: {
            employeeId: dto.employeeId,
            shiftId: dto.shiftId,
            effectiveFrom: dto.effectiveFrom,
            effectiveTo: dto.effectiveTo,
          },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
        return assignment;
      });
      await events.flush(this.platform.events);
      return created;
    } catch (err) {
      await audit.tryRecord({
        action: 'shift.assign',
        outcome: 'failure',
        entityType: 'employee_shift',
      });
      throw err;
    }
  }

  async getPolicy(): Promise<AttendancePolicyView> {
    const policy = await this.repository.getPolicy();
    const shift = await this.getShift(policy.defaultShiftId);
    const { timezone, workWeek } = await this.settings.getBasic();
    return {
      fullDayMinutes: policy.fullDayMinutes,
      halfDayMinutes: policy.halfDayMinutes,
      defaultShift: summary(shift),
      timezone,
      workWeek,
      updatedAt: policy.updatedAt,
    };
  }

  async updatePolicy(
    patch: { fullDayMinutes?: number; halfDayMinutes?: number; defaultShiftId?: string },
    caller: ShiftsCaller,
  ): Promise<AttendancePolicyView> {
    const audit = this.audit(caller);
    try {
      await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockPolicy(tx);
        const fullDayMinutes = patch.fullDayMinutes ?? current.fullDayMinutes;
        const halfDayMinutes = patch.halfDayMinutes ?? current.halfDayMinutes;
        if (halfDayMinutes >= fullDayMinutes) {
          throw unprocessable('A half day must be shorter than a full day', [
            { field: 'halfDayMinutes', message: 'Must be less than fullDayMinutes' },
          ]);
        }
        if (patch.defaultShiftId !== undefined) {
          const shift = await this.repository.lockShift(tx, patch.defaultShiftId);
          if (!shift || !shift.isActive) {
            throw unprocessable('The default shift does not exist or is not active', [
              { field: 'defaultShiftId', message: 'Shift is missing or inactive' },
            ]);
          }
        }
        const next = {
          fullDayMinutes,
          halfDayMinutes,
          defaultShiftId: patch.defaultShiftId ?? current.defaultShiftId,
        };
        const changed = (Object.keys(next) as Array<keyof typeof next>).filter(
          (k) => next[k] !== current[k],
        );
        if (changed.length === 0) return;
        await this.repository.updatePolicy(tx, next);
        await audit.record(
          {
            action: 'attendance_policy.update',
            outcome: 'success',
            entityType: 'attendance_policy',
            changes: {
              fields: changed,
              ...Object.fromEntries(changed.map((k) => [k, { from: current[k], to: next[k] }])),
            },
          },
          { transaction: tx },
        );
      });
    } catch (err) {
      await audit.tryRecord({
        action: 'attendance_policy.update',
        outcome: 'failure',
        entityType: 'attendance_policy',
      });
      throw err;
    }
    return this.getPolicy();
  }

  /** The shift that applies on a date: the employee's assignment, else the policy's default. */
  async shiftOn(employeeId: string, date: string): Promise<ShiftSummary> {
    const assigned = await this.repository.shiftFor(employeeId, date);
    if (assigned) return assigned;
    return summary(await this.getShift((await this.repository.getPolicy()).defaultShiftId));
  }
}
