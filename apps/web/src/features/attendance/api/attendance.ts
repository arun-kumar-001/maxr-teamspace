import { apiFetch } from '../../../api/client';
import type {
  AttendanceListResponse,
  AttendanceQuery,
  AttendanceRecord,
  CheckInRequest,
  CheckOutRequest,
  TodayAttendanceSummary,
} from '../types';

export class AttendanceApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'ATTENDANCE_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'AttendanceApiError';
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
    throw new AttendanceApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'ATTENDANCE_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

function buildQueryString(query?: AttendanceQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();

  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  if (query.startDate) params.set('startDate', query.startDate);
  if (query.endDate) params.set('endDate', query.endDate);
  if (query.status) params.set('status', query.status);
  if (query.employeeId) params.set('employeeId', query.employeeId);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Fetch today's attendance summary for the authenticated user.
 */
export async function fetchTodayAttendance(): Promise<TodayAttendanceSummary> {
  const res = await apiFetch('/api/v1/attendance/today');
  const body = await handleResponse<{ data: TodayAttendanceSummary }>(res);
  return body.data;
}

/**
 * Fetch the current open/active session if any.
 */
export async function fetchActiveSession(): Promise<AttendanceRecord | null> {
  const res = await apiFetch('/api/v1/attendance/active');
  const body = await handleResponse<{ data: AttendanceRecord | null }>(res);
  return body.data;
}

/**
 * Check-in for an attendance session.
 */
export async function checkIn(data?: CheckInRequest): Promise<AttendanceRecord> {
  const res = await apiFetch('/api/v1/attendance/check-in', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
  const body = await handleResponse<{ data: AttendanceRecord }>(res);
  return body.data;
}

/**
 * Check-out of the active session.
 */
export async function checkOut(data?: CheckOutRequest): Promise<AttendanceRecord> {
  const res = await apiFetch('/api/v1/attendance/check-out', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
  const body = await handleResponse<{ data: AttendanceRecord }>(res);
  return body.data;
}

/**
 * Fetch personal attendance history for the authenticated employee.
 */
export async function fetchMyAttendanceHistory(
  query?: AttendanceQuery,
): Promise<AttendanceListResponse> {
  const qs = buildQueryString(query);
  const res = await apiFetch(`/api/v1/attendance/me${qs}`);
  return handleResponse<AttendanceListResponse>(res);
}

/**
 * Fetch team or company-wide attendance records (scoped by role: Team Lead / HR / Admin).
 */
export async function fetchTeamAttendance(
  query?: AttendanceQuery,
): Promise<AttendanceListResponse> {
  const qs = buildQueryString(query);
  const res = await apiFetch(`/api/v1/attendance${qs}`);
  return handleResponse<AttendanceListResponse>(res);
}
