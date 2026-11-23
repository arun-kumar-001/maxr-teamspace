import type { PoolClient } from 'pg';

export type ShiftTx = Pick<PoolClient, 'query'>;

/** Times are company-local wall-clock `HH:MM`; the company timezone is a setting. */
export interface Shift {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  /** The end is not after the start: the shift runs past midnight and belongs to the date it starts. */
  crossesMidnight: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ShiftSummary = Pick<
  Shift,
  'id' | 'code' | 'name' | 'startTime' | 'endTime' | 'graceMinutes' | 'crossesMidnight'
>;

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shift: ShiftSummary;
  /** `YYYY-MM-DD`, inclusive. */
  effectiveFrom: string;
  /** Inclusive; null when the assignment has no end date. */
  effectiveTo: string | null;
  createdAt: string;
}

export interface AttendancePolicyRow {
  fullDayMinutes: number;
  halfDayMinutes: number;
  defaultShiftId: string;
  updatedAt: string;
}

export interface AttendancePolicyView {
  fullDayMinutes: number;
  halfDayMinutes: number;
  defaultShift: ShiftSummary;
  /** From the company settings, shown here for convenience; change it there. */
  timezone: string;
  workWeek: { start: string; end: string; days: string[] };
  updatedAt: string;
}

export interface NewShift {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
}

export type ShiftPatch = Partial<Omit<NewShift, 'code'>> & { isActive?: boolean };

export interface NewAssignment {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface AssignableEmployee {
  id: string;
  status: 'active' | 'pending' | 'deactivated';
}

/** What attendance (and later leave and reports) ask: which shift applies to someone on a date. */
export interface ShiftResolver {
  shiftOn(employeeId: string, date: string): Promise<ShiftSummary>;
}
