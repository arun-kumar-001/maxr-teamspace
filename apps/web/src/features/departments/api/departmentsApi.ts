import { apiFetch } from '../../../api/client';
import type {
  CreateDepartmentPayload,
  Department,
  DepartmentListResponse,
  DepartmentQuery,
  UpdateDepartmentPayload,
} from '../types';

export class DepartmentsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'DEPARTMENTS_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'DepartmentsApiError';
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
    throw new DepartmentsApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'DEPARTMENTS_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

export function buildDepartmentQueryString(query: DepartmentQuery = {}): string {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));

  return params.toString();
}

/**
 * Fetch paginated list of departments.
 */
export async function fetchDepartments(
  query: DepartmentQuery = {},
  signal?: AbortSignal,
): Promise<DepartmentListResponse> {
  const qs = buildDepartmentQueryString(query);
  const url = `/api/v1/departments${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<DepartmentListResponse>(res);
}

/**
 * Fetch a single department by ID.
 */
export async function fetchDepartmentById(id: string, signal?: AbortSignal): Promise<Department> {
  const res = await apiFetch(
    `/api/v1/departments/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  const body = await handleResponse<{ data: Department }>(res);
  return body.data;
}

/**
 * Create a new department.
 */
export async function createDepartment(payload: CreateDepartmentPayload): Promise<Department> {
  const idempotencyKey = `dept-create-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const res = await apiFetch('/api/v1/departments', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Department }>(res);
  return body.data;
}

/**
 * Update an existing department.
 */
export async function updateDepartment(
  id: string,
  payload: UpdateDepartmentPayload,
): Promise<Department> {
  const res = await apiFetch(`/api/v1/departments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Department }>(res);
  return body.data;
}

/**
 * Deactivate a department.
 */
export async function deactivateDepartment(id: string): Promise<{ id: string; isActive: boolean }> {
  const res = await apiFetch(`/api/v1/departments/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
  });
  const body = await handleResponse<{ data: { id: string; isActive: boolean } }>(res);
  return body.data;
}
