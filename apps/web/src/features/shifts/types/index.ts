export interface Shift extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  graceMinutes: number;
  crossesMidnight: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftPayload {
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes?: number;
}

export interface UpdateShiftPayload {
  name?: string;
  startTime?: string;
  endTime?: string;
  graceMinutes?: number;
  isActive?: boolean;
}

export interface ShiftAssignment extends Record<string, unknown> {
  id: string;
  employeeId: string;
  shiftId: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD
  shiftName?: string;
  shiftCode?: string;
  createdAt: string;
}

export interface AssignShiftPayload {
  employeeId: string;
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface AttendancePolicy extends Record<string, unknown> {
  id?: string;
  fullDayMinutes: number;
  halfDayMinutes: number;
  defaultShiftId: string;
  timezone: string;
  workWeek: number[];
  updatedAt?: string;
}

export interface UpdateAttendancePolicyPayload {
  fullDayMinutes: number;
  halfDayMinutes: number;
  defaultShiftId: string;
}
