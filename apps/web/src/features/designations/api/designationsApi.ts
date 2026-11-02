import { apiFetch } from '../../../api/client';
import type {
  CreateDesignationPayload,
  DepartmentOption,
  Designation,
  DesignationListResponse,
  DesignationQuery,
  UpdateDesignationPayload,
} from '../types';

export class DesignationsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'DESIGNATIONS_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'DesignationsApiError';
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
    throw new DesignationsApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'DESIGNATIONS_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

export function buildDesignationQueryString(query: DesignationQuery = {}): string {
  const params = new URLSearchParams();

  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.departmentId?.trim()) params.set('departmentId', query.departmentId.trim());
  if (query.isActive !== undefined) params.set('isActive', String(query.isActive));

  return params.toString();
}

/**
 * Fetch paginated list of designations.
 */
export async function fetchDesignations(
  query: DesignationQuery = {},
  signal?: AbortSignal,
): Promise<DesignationListResponse> {
  const qs = buildDesignationQueryString(query);
  const url = `/api/v1/designations${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<DesignationListResponse>(res);
}

/**
 * Fetch a single designation by ID.
 */
export async function fetchDesignationById(id: string, signal?: AbortSignal): Promise<Designation> {
  const res = await apiFetch(
    `/api/v1/designations/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  const body = await handleResponse<{ data: Designation }>(res);
  return body.data;
}

/**
 * Create a new designation definition.
 */
export async function createDesignation(payload: CreateDesignationPayload): Promise<Designation> {
  const idempotencyKey = `desig-create-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const res = await apiFetch('/api/v1/designations', {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Designation }>(res);
  return body.data;
}

/**
 * Update an existing designation definition.
 */
export async function updateDesignation(
  id: string,
  payload: UpdateDesignationPayload,
): Promise<Designation> {
  const res = await apiFetch(`/api/v1/designations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: Designation }>(res);
  return body.data;
}

/**
 * Deactivate a designation definition.
 */
export async function deactivateDesignation(
  id: string,
): Promise<{ id: string; isActive: boolean }> {
  const res = await apiFetch(`/api/v1/designations/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
  });
  const body = await handleResponse<{ data: { id: string; isActive: boolean } }>(res);
  return body.data;
}

/**
 * Fetch departments to populate designation forms and department filter options.
 */
export async function fetchDepartmentOptions(signal?: AbortSignal): Promise<DepartmentOption[]> {
  try {
    const res = await apiFetch('/api/v1/departments?pageSize=100', signal ? { signal } : undefined);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DepartmentOption[] };
    return (json.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      isActive: d.isActive,
    }));
  } catch {
    return [];
  }
}
