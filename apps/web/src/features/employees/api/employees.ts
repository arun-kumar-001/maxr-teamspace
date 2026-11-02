import { apiFetch } from '../../../api/client';
import type {
  DepartmentItem,
  DesignationItem,
  EmployeeDirectoryQuery,
  EmployeeDirectoryResponse,
} from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchEmployeeDirectory(
  query: EmployeeDirectoryQuery = {},
): Promise<EmployeeDirectoryResponse> {
  const searchParams = new URLSearchParams();

  if (query.page) searchParams.set('page', String(query.page));
  if (query.pageSize) searchParams.set('pageSize', String(query.pageSize));
  if (query.sortBy) searchParams.set('sortBy', query.sortBy);
  if (query.sortOrder) searchParams.set('sortOrder', query.sortOrder);
  if (query.search) searchParams.set('search', query.search);
  if (query.departmentId) searchParams.set('departmentId', query.departmentId);
  if (query.designationId) searchParams.set('designationId', query.designationId);
  if (query.status) searchParams.set('status', query.status);
  if (query.managerId) searchParams.set('managerId', query.managerId);

  const queryString = searchParams.toString();
  const url = `/api/v1/employees${queryString ? `?${queryString}` : ''}`;

  const res = await apiFetch(url);

  if (!res.ok) {
    let errorMessage = `Failed to fetch employees (${res.status})`;
    let errorCode: string | undefined;
    try {
      const errorJson = (await res.json()) as { error?: { message?: string; code?: string } };
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
      errorCode = errorJson.error?.code;
    } catch {
      // Non-JSON response
    }
    throw new ApiError(res.status, errorMessage, errorCode);
  }

  return (await res.json()) as EmployeeDirectoryResponse;
}

export async function fetchDepartments(): Promise<DepartmentItem[]> {
  try {
    const res = await apiFetch('/api/v1/departments?limit=100');
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DepartmentItem[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchDesignations(): Promise<DesignationItem[]> {
  try {
    const res = await apiFetch('/api/v1/designations?limit=100');
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DesignationItem[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}
