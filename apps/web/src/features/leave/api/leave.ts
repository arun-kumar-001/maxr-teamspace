import { apiFetch } from '../../../api/client';
import type {
  AccrualResult,
  ApplyForLeavePayload,
  CreateHolidayInput,
  CreateLeavePolicyInput,
  EmployeeLeaveBalance,
  Holiday,
  LeaveBalance,
  LeaveCalendarEntry,
  LeavePolicy,
  LeaveRequest,
  ListBalancesQuery,
  ListMyLeaveRequestsQuery,
  PaginationMeta,
  UpdateLeavePolicyInput,
} from '../types';

export class LeaveApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'LeaveApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // response not JSON
    }
    throw new LeaveApiError(errorMsg, res.status, code);
  }
  return res.json();
}

export async function fetchLeavePolicies(): Promise<LeavePolicy[]> {
  const res = await apiFetch('/api/v1/leave-policies');
  const json = await handleResponse<{ data: LeavePolicy[] }>(res);
  return json.data;
}

export async function createLeavePolicy(data: CreateLeavePolicyInput): Promise<LeavePolicy> {
  const res = await apiFetch('/api/v1/leave-policies', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await handleResponse<{ data: LeavePolicy }>(res);
  return json.data;
}

export async function updateLeavePolicy(
  id: string,
  data: UpdateLeavePolicyInput,
): Promise<LeavePolicy> {
  const res = await apiFetch(`/api/v1/leave-policies/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  const json = await handleResponse<{ data: LeavePolicy }>(res);
  return json.data;
}

export async function fetchHolidays(year?: number): Promise<Holiday[]> {
  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  const queryString = params.toString();
  const url = queryString ? `/api/v1/holidays?${queryString}` : '/api/v1/holidays';

  const res = await apiFetch(url);
  const json = await handleResponse<{ data: Holiday[] }>(res);
  return json.data;
}

export async function createHoliday(data: CreateHolidayInput): Promise<Holiday> {
  const res = await apiFetch('/api/v1/holidays', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await handleResponse<{ data: Holiday }>(res);
  return json.data;
}

export async function deleteHoliday(id: string): Promise<boolean> {
  const res = await apiFetch(`/api/v1/holidays/${id}`, {
    method: 'DELETE',
  });
  const json = await handleResponse<{ data: { removed: boolean } }>(res);
  return json.data.removed;
}

export async function fetchMyLeaveBalances(year?: number): Promise<LeaveBalance[]> {
  const params = new URLSearchParams();
  if (year) params.append('year', year.toString());
  const queryString = params.toString();
  const url = queryString
    ? `/api/v1/leave-balances/me?${queryString}`
    : '/api/v1/leave-balances/me';

  const res = await apiFetch(url);
  const json = await handleResponse<{ data: LeaveBalance[] }>(res);
  return json.data;
}

export async function fetchLeaveBalances(
  query: ListBalancesQuery = {},
): Promise<{ data: EmployeeLeaveBalance[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  if (query.page) params.append('page', query.page.toString());
  if (query.pageSize) params.append('pageSize', query.pageSize.toString());
  if (query.employeeId) params.append('employeeId', query.employeeId);
  if (query.year) params.append('year', query.year.toString());

  const queryString = params.toString();
  const url = queryString ? `/api/v1/leave-balances?${queryString}` : '/api/v1/leave-balances';

  const res = await apiFetch(url);
  return handleResponse<{ data: EmployeeLeaveBalance[]; meta: PaginationMeta }>(res);
}

export async function runYearlyAccrual(year: number): Promise<AccrualResult> {
  const res = await apiFetch('/api/v1/leave-balances/accrual', {
    method: 'POST',
    body: JSON.stringify({ year }),
  });
  const json = await handleResponse<{ data: AccrualResult }>(res);
  return json.data;
}

export async function applyForLeave(payload: ApplyForLeavePayload): Promise<LeaveRequest> {
  const res = await apiFetch('/api/v1/leave-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const json = await handleResponse<{ data: LeaveRequest }>(res);
  return json.data;
}

export async function fetchMyLeaveRequests(
  query: ListMyLeaveRequestsQuery = {},
): Promise<{ data: LeaveRequest[]; meta: PaginationMeta }> {
  const params = new URLSearchParams();
  if (query.page) params.append('page', query.page.toString());
  if (query.pageSize) params.append('pageSize', query.pageSize.toString());
  if (query.status) params.append('status', query.status);
  if (query.leaveTypeId) params.append('leaveTypeId', query.leaveTypeId);
  if (query.from) params.append('from', query.from);
  if (query.to) params.append('to', query.to);

  const queryString = params.toString();
  const url = queryString
    ? `/api/v1/leave-requests/me?${queryString}`
    : '/api/v1/leave-requests/me';

  const res = await apiFetch(url);
  return handleResponse<{ data: LeaveRequest[]; meta: PaginationMeta }>(res);
}

export async function fetchLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await apiFetch(`/api/v1/leave-requests/${id}`);
  const json = await handleResponse<{ data: LeaveRequest }>(res);
  return json.data;
}

export async function cancelLeaveRequest(id: string): Promise<LeaveRequest> {
  const res = await apiFetch(`/api/v1/leave-requests/${id}/cancel`, {
    method: 'POST',
  });
  const json = await handleResponse<{ data: LeaveRequest }>(res);
  return json.data;
}

export async function fetchLeaveCalendar(from: string, to: string): Promise<LeaveCalendarEntry[]> {
  const params = new URLSearchParams({ from, to });
  const res = await apiFetch(`/api/v1/leave-requests/calendar?${params.toString()}`);
  const json = await handleResponse<{ data: LeaveCalendarEntry[] }>(res);
  return json.data;
}
