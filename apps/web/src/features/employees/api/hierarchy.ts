import { apiFetch } from '../../../api/client';
import type {
  ChangeManagerPayload,
  EmployeeStatus,
  ManagerChange,
  OrgListResponse,
} from '../types';

export class HierarchyApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'HierarchyApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isCycleOrUnprocessable(): boolean {
    return this.status === 422;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }
}

async function extractError(res: Response, fallbackPrefix: string): Promise<never> {
  let errorMessage = `${fallbackPrefix} (${res.status})`;
  let errorCode: string | undefined;
  let requestId: string | undefined;
  let details: unknown;

  try {
    const errorJson = (await res.json()) as {
      error?: { message?: string; code?: string; requestId?: string; details?: unknown };
    };
    if (errorJson.error?.message) {
      errorMessage = errorJson.error.message;
    }
    errorCode = errorJson.error?.code;
    requestId = errorJson.error?.requestId;
    details = errorJson.error?.details;
  } catch {
    // Non-JSON response
  }

  throw new HierarchyApiError(res.status, errorMessage, errorCode, requestId, details);
}

/**
 * Fetches root nodes of the reporting hierarchy (employees with no manager).
 * Scoped by role: Admin/HR see company roots; Team Lead sees none (their team reports to them).
 */
export async function fetchOrgRoots(
  options: {
    status?: EmployeeStatus;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  } = {},
): Promise<OrgListResponse> {
  const { status, page = 1, pageSize = 50, signal } = options;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (status) params.set('status', status);

  const res = await apiFetch(`/api/v1/employees/org-roots?${params.toString()}`, { signal });
  if (!res.ok) {
    await extractError(res, 'Failed to fetch organization roots');
  }

  return (await res.json()) as OrgListResponse;
}

/**
 * Fetches direct reports of a specified employee.
 * Team Lead may query themselves or someone in their team; Admin/HR may query anyone.
 */
export async function fetchDirectReports(
  employeeId: string,
  options: {
    status?: EmployeeStatus;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  } = {},
): Promise<OrgListResponse> {
  const { status, page = 1, pageSize = 50, signal } = options;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (status) params.set('status', status);

  const res = await apiFetch(
    `/api/v1/employees/${encodeURIComponent(employeeId)}/direct-reports?${params.toString()}`,
    { signal },
  );
  if (!res.ok) {
    await extractError(res, 'Failed to fetch direct reports');
  }

  return (await res.json()) as OrgListResponse;
}

/**
 * Changes, assigns, or clears an employee's manager (Admin and HR Manager only).
 * Cycle prevention is enforced by the backend (returns 422 if self-manager or loop is created).
 * Returns 409 if version is outdated.
 */
export async function changeEmployeeManager(
  employeeId: string,
  payload: ChangeManagerPayload,
  signal?: AbortSignal,
): Promise<ManagerChange> {
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/manager`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    await extractError(res, 'Failed to update manager');
  }

  const json = (await res.json()) as { data: ManagerChange };
  return json.data;
}
