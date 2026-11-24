import { apiFetch } from '../../../api/client';
import type {
  AttendanceCorrection,
  AttendanceListResponse,
  AttendanceQuery,
  AttendanceRecord,
  CheckInRequest,
  CheckOutRequest,
  CorrectionQuery,
  PaginatedCorrectionsResponse,
  RequestCorrectionPayload,
  TeamCalendarData,
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
    const detailMsg =
      Array.isArray(errorInfo?.details) && errorInfo.details.length > 0
        ? errorInfo.details
            .map((d: { field?: string; message?: string }) => d.message || d.field)
            .filter(Boolean)
            .join(', ')
        : null;
    throw new AttendanceApiError(
      detailMsg ?? errorInfo?.message ?? `Request failed with status ${res.status}`,
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
 * Start a break for the active session.
 */
export async function startBreak(): Promise<AttendanceRecord> {
  const res = await apiFetch('/api/v1/attendance/break-start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const body = await handleResponse<{ data: AttendanceRecord }>(res);
  return body.data;
}

/**
 * End an ongoing break for the active session.
 */
export async function endBreak(): Promise<AttendanceRecord> {
  const res = await apiFetch('/api/v1/attendance/break-end', {
    method: 'POST',
    body: JSON.stringify({}),
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

/** A fresh Idempotency-Key for one submission (the server accepts 8 to 128 letters, digits, "-" and "_"). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Submit an attendance correction request. Pass the same `idempotencyKey` when retrying the same
 * submission, so the server answers from the first attempt instead of filing it twice.
 */
export async function requestCorrection(
  payload: RequestCorrectionPayload,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<AttendanceCorrection> {
  const res = await apiFetch('/api/v1/attendance/corrections', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: AttendanceCorrection }>(res);
  return body.data;
}

/**
 * List the current user's attendance correction requests.
 */
export async function fetchCorrections(
  query?: CorrectionQuery,
): Promise<PaginatedCorrectionsResponse> {
  const params = new URLSearchParams();
  if (query?.page) params.set('page', String(query.page));
  if (query?.pageSize) params.set('pageSize', String(query.pageSize));
  if (query?.status) params.set('status', query.status);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await apiFetch(`/api/v1/attendance/corrections${qs}`);
  return handleResponse<PaginatedCorrectionsResponse>(res);
}

/**
 * Fetch a single attendance correction by ID.
 */
export async function fetchCorrection(id: string): Promise<AttendanceCorrection> {
  const res = await apiFetch(`/api/v1/attendance/corrections/${encodeURIComponent(id)}`);
  const body = await handleResponse<{ data: AttendanceCorrection }>(res);
  return body.data;
}

/**
 * Cancel a pending attendance correction request.
 */
export async function cancelCorrection(id: string): Promise<AttendanceCorrection> {
  const res = await apiFetch(`/api/v1/attendance/corrections/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  const body = await handleResponse<{ data: AttendanceCorrection }>(res);
  return body.data;
}

/**
 * A short-lived link to one record's check-in or check-out photo. Photos are never part of a list:
 * ask for the one you are about to show.
 */
export async function fetchAttendancePhotoLink(
  recordId: string,
  which: 'check-in' | 'check-out',
): Promise<{ url: string; expiresAt: string | null }> {
  const res = await apiFetch(`/api/v1/attendance/${recordId}/photos/${which}`);
  const body = await handleResponse<{ data: { url: string; expiresAt: string | null } }>(res);
  return body.data;
}

export async function fetchTeamCalendar(params?: {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  employeeId?: string;
}): Promise<TeamCalendarData> {
  const qs = new URLSearchParams();
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  if (params?.departmentId) qs.set('departmentId', params.departmentId);
  if (params?.employeeId) qs.set('employeeId', params.employeeId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch(`/api/v1/attendance/team-calendar${suffix}`);
  const body = await handleResponse<{ data: TeamCalendarData }>(res);
  return body.data;
}
