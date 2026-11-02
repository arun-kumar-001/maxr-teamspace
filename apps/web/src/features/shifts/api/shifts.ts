import { apiFetch } from '../../../api/client';
import type {
  AttendancePolicy,
  AssignShiftPayload,
  CreateShiftPayload,
  Shift,
  ShiftAssignment,
  UpdateAttendancePolicyPayload,
  UpdateShiftPayload,
} from '../types';

export class ShiftsApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'SHIFTS_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ShiftsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;

  if (!res.ok) {
    const errorInfo = payload?.error;
    throw new ShiftsApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'SHIFTS_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

/**
 * Fetch all defined shifts.
 */
export async function fetchShifts(includeInactive = false): Promise<Shift[]> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  const res = await apiFetch(`/api/v1/shifts${qs}`);
  const body = await handleResponse<{ data: Shift[] }>(res);
  return body.data;
}

/**
 * Fetch a single shift by ID.
 */
export async function fetchShift(id: string): Promise<Shift> {
  const res = await apiFetch(`/api/v1/shifts/${encodeURIComponent(id)}`);
  const body = await handleResponse<{ data: Shift }>(res);
  return body.data;
}

/**
 * Create a new shift definition.
 */
export async function createShift(payload: CreateShiftPayload): Promise<Shift> {
  const res = await apiFetch('/api/v1/shifts', {
    method: 'POST',
    headers: {
      'Idempotency-Key': `shift-create-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Shift }>(res);
  return body.data;
}

/**
 * Update an existing shift definition.
 */
export async function updateShift(id: string, payload: UpdateShiftPayload): Promise<Shift> {
  const res = await apiFetch(`/api/v1/shifts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Shift }>(res);
  return body.data;
}

/**
 * Fetch current attendance policy settings.
 */
export async function fetchAttendancePolicy(): Promise<AttendancePolicy> {
  const res = await apiFetch('/api/v1/attendance/policies');
  const body = await handleResponse<{ data: AttendancePolicy }>(res);
  return body.data;
}

/**
 * Update attendance policy parameters.
 */
export async function updateAttendancePolicy(
  payload: UpdateAttendancePolicyPayload,
): Promise<AttendancePolicy> {
  const res = await apiFetch('/api/v1/attendance/policies', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: AttendancePolicy }>(res);
  return body.data;
}

/**
 * Fetch shift assignments for a specific employee.
 */
export async function fetchEmployeeShiftAssignments(
  employeeId: string,
): Promise<ShiftAssignment[]> {
  const res = await apiFetch(`/api/v1/shifts/assignments/${encodeURIComponent(employeeId)}`);
  const body = await handleResponse<{ data: ShiftAssignment[] }>(res);
  return body.data;
}

/**
 * Assign a shift to an employee.
 */
export async function assignShift(payload: AssignShiftPayload): Promise<ShiftAssignment> {
  const res = await apiFetch('/api/v1/shifts/assignments', {
    method: 'POST',
    headers: {
      'Idempotency-Key': `shift-assign-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: ShiftAssignment }>(res);
  return body.data;
}
