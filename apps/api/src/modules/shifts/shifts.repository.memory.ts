import { randomUUID } from 'node:crypto';
import { ScopeFilter, scopeAllows } from '../rbac';
import { IShiftsRepository } from './shifts.repository';
import {
  AssignableEmployee,
  AttendancePolicyRow,
  NewAssignment,
  NewShift,
  Shift,
  ShiftAssignment,
  ShiftPatch,
  ShiftSummary,
  ShiftTx,
} from './shifts.types';

export interface MemoryEmployee extends AssignableEmployee {
  managerId: string | null;
}

const NOW = '2026-10-31T00:00:00.000Z';
const summary = (s: Shift): ShiftSummary => ({
  id: s.id,
  code: s.code,
  name: s.name,
  startTime: s.startTime,
  endTime: s.endTime,
  graceMinutes: s.graceMinutes,
  crossesMidnight: s.crossesMidnight,
});

/** The end is not after the start, as the database computes it. */
export const crossesMidnight = (start: string, end: string): boolean => end <= start;

/** In-memory twin for unit and HTTP tests (not shipped in the build). */
export class MemoryShiftsRepository implements IShiftsRepository {
  public shifts: Shift[] = [
    {
      id: '70000000-0000-4000-8000-000000000001',
      code: 'GENERAL',
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
      graceMinutes: 15,
      crossesMidnight: false,
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
  public assignments: Array<Omit<ShiftAssignment, 'shift'> & { shiftId: string }> = [];
  public policy: AttendancePolicyRow = {
    fullDayMinutes: 480,
    halfDayMinutes: 240,
    defaultShiftId: '70000000-0000-4000-8000-000000000001',
    updatedAt: NOW,
  };
  /** Makes `insertShift`/`insertAssignment` fail after changing state, to prove nothing is kept. */
  public failAfterWrite: Error | null = null;

  constructor(public employees: MemoryEmployee[] = []) {}

  async transaction<T>(work: (tx: ShiftTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({
      shifts: this.shifts,
      assignments: this.assignments,
      policy: this.policy,
    });
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as ShiftTx);
    } catch (err) {
      this.shifts = snapshot.shifts;
      this.assignments = snapshot.assignments;
      this.policy = snapshot.policy;
      throw err;
    }
  }

  private shift(id: string): Shift | undefined {
    return this.shifts.find((s) => s.id === id);
  }

  async listShifts(filter: { isActive?: boolean }) {
    return structuredClone(
      this.shifts
        .filter((s) => filter.isActive === undefined || s.isActive === filter.isActive)
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.code.localeCompare(b.code)),
    );
  }

  async findShift(id: string) {
    const s = this.shift(id);
    return s ? structuredClone(s) : null;
  }

  async lockShift(_tx: ShiftTx, id: string) {
    return this.findShift(id);
  }

  async codeTaken(_tx: ShiftTx, code: string) {
    return this.shifts.some((s) => s.code.toLowerCase() === code.toLowerCase());
  }

  async insertShift(_tx: ShiftTx, input: NewShift): Promise<Shift> {
    const shift: Shift = {
      id: randomUUID(),
      ...input,
      crossesMidnight: crossesMidnight(input.startTime, input.endTime),
      isActive: true,
      createdAt: NOW,
      updatedAt: NOW,
    };
    this.shifts.push(shift);
    if (this.failAfterWrite) throw this.failAfterWrite;
    return structuredClone(shift);
  }

  async updateShift(_tx: ShiftTx, id: string, patch: ShiftPatch): Promise<Shift> {
    const s = this.shift(id) as Shift;
    Object.assign(s, patch);
    s.crossesMidnight = crossesMidnight(s.startTime, s.endTime);
    s.updatedAt = '2026-10-31T01:00:00.000Z';
    if (this.failAfterWrite) throw this.failAfterWrite;
    return structuredClone(s);
  }

  async shiftUsage(_tx: ShiftTx, id: string, today: string) {
    return {
      assignments: this.assignments.filter(
        (a) => a.shiftId === id && (a.effectiveTo === null || a.effectiveTo >= today),
      ).length,
      isDefault: this.policy.defaultShiftId === id,
    };
  }

  async lockEmployee(_tx: ShiftTx, id: string) {
    const e = this.employees.find((x) => x.id === id);
    return e ? { id: e.id, status: e.status } : null;
  }

  async isVisible(id: string, filter: ScopeFilter, selfId: string) {
    if (id === selfId) return true;
    const e = this.employees.find((x) => x.id === id);
    return !!e && scopeAllows(filter, e.id, e.managerId);
  }

  private view(a: Omit<ShiftAssignment, 'shift'> & { shiftId: string }): ShiftAssignment {
    const { shiftId, ...rest } = a;
    return { ...rest, shift: summary(this.shift(shiftId) as Shift) };
  }

  async listAssignments(employeeId: string) {
    return this.assignments
      .filter((a) => a.employeeId === employeeId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
      .map((a) => this.view(a));
  }

  private overlaps(
    a: { effectiveFrom: string; effectiveTo: string | null },
    from: string,
    to: string | null,
  ) {
    return a.effectiveFrom <= (to ?? '9999-12-31') && (a.effectiveTo ?? '9999-12-31') >= from;
  }

  async findOverlapping(_tx: ShiftTx, employeeId: string, from: string, to: string | null) {
    return this.assignments
      .filter((a) => a.employeeId === employeeId && this.overlaps(a, from, to))
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
      .map((a) => this.view(a));
  }

  async insertAssignment(_tx: ShiftTx, input: NewAssignment): Promise<ShiftAssignment> {
    // The exclusion constraint of the real table.
    if (
      this.assignments.some(
        (a) =>
          a.employeeId === input.employeeId &&
          this.overlaps(a, input.effectiveFrom, input.effectiveTo),
      )
    ) {
      throw Object.assign(new Error('employee_shifts_no_overlap'), { code: '23P01' });
    }
    const row = {
      id: randomUUID(),
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      createdAt: NOW,
    };
    this.assignments.push(row);
    if (this.failAfterWrite) throw this.failAfterWrite;
    return this.view(row);
  }

  async endAssignment(_tx: ShiftTx, id: string, effectiveTo: string) {
    const a = this.assignments.find((x) => x.id === id);
    if (a) a.effectiveTo = effectiveTo;
  }

  async shiftFor(employeeId: string, date: string) {
    const a = this.assignments.find(
      (x) =>
        x.employeeId === employeeId &&
        x.effectiveFrom <= date &&
        (x.effectiveTo ?? '9999-12-31') >= date,
    );
    return a ? this.view(a).shift : null;
  }

  async getPolicy() {
    return { ...this.policy };
  }

  async lockPolicy() {
    return { ...this.policy };
  }

  async updatePolicy(
    _tx: ShiftTx,
    patch: { fullDayMinutes?: number; halfDayMinutes?: number; defaultShiftId?: string },
  ) {
    this.policy = {
      fullDayMinutes: patch.fullDayMinutes ?? this.policy.fullDayMinutes,
      halfDayMinutes: patch.halfDayMinutes ?? this.policy.halfDayMinutes,
      defaultShiftId: patch.defaultShiftId ?? this.policy.defaultShiftId,
      updatedAt: '2026-10-31T01:00:00.000Z',
    };
    if (this.failAfterWrite) throw this.failAfterWrite;
    return { ...this.policy };
  }
}
