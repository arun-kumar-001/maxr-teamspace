import { apiFetch } from '../../../api/client';
import type {
  DepartmentItem,
  DesignationItem,
  EmployeeDirectoryItem,
  EmployeeDirectoryQuery,
  EmployeeDirectoryResponse,
  ManagerOption,
} from '../types';

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly requestId?: string;

  constructor(
    statusOrMessage: number | string,
    messageOrStatus: string | number,
    code?: string,
    requestId?: string,
  ) {
    if (typeof statusOrMessage === 'number') {
      super(typeof messageOrStatus === 'string' ? messageOrStatus : '');
      this.status = statusOrMessage;
      this.statusCode = statusOrMessage;
      this.code = code;
      this.requestId = requestId;
    } else {
      super(statusOrMessage);
      const st = typeof messageOrStatus === 'number' ? messageOrStatus : 500;
      this.status = st;
      this.statusCode = st;
      this.code = code;
      this.requestId = requestId;
    }
    this.name = 'ApiError';
  }
}

export function buildDirectoryQueryString(query: EmployeeDirectoryQuery = {}): string {
  const searchParams = new URLSearchParams();

  if (query.page) searchParams.set('page', String(query.page));
  if (query.pageSize) searchParams.set('pageSize', String(query.pageSize));
  if (query.sortBy) searchParams.set('sortBy', query.sortBy);
  if (query.sortOrder) searchParams.set('sortOrder', query.sortOrder);
  if (query.search?.trim()) searchParams.set('search', query.search.trim());
  if (query.departmentId?.trim()) searchParams.set('departmentId', query.departmentId.trim());
  if (query.designationId?.trim()) searchParams.set('designationId', query.designationId.trim());
  if (query.status) searchParams.set('status', query.status);
  if (query.managerId?.trim()) searchParams.set('managerId', query.managerId.trim());

  return searchParams.toString();
}

export async function fetchEmployeeDirectory(
  query: EmployeeDirectoryQuery = {},
  signal?: AbortSignal,
): Promise<EmployeeDirectoryResponse> {
  const queryString = buildDirectoryQueryString(query);
  const url = `/api/v1/employees${queryString ? `?${queryString}` : ''}`;

  const res = await (signal ? apiFetch(url, { signal }) : apiFetch(url));

  if (!res.ok) {
    let errorMessage = `Failed to fetch employees (${res.status})`;
    let errorCode: string | undefined;
    let requestId: string | undefined;
    try {
      const errorJson = (await res.json()) as {
        error?: { message?: string; code?: string; requestId?: string };
      };
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
      errorCode = errorJson.error?.code;
      requestId = errorJson.error?.requestId;
    } catch {
      // Non-JSON response
    }
    throw new ApiError(res.status, errorMessage, errorCode, requestId);
  }

  return (await res.json()) as EmployeeDirectoryResponse;
}

export async function fetchDepartments(signal?: AbortSignal): Promise<DepartmentItem[]> {
  try {
    const res = await apiFetch('/api/v1/departments?pageSize=100', signal ? { signal } : undefined);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DepartmentItem[] };
    return (json.data ?? [])
      .filter((d) => Boolean(d.id && d.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code ?? '',
      }));
  } catch {
    return [];
  }
}

export async function fetchDesignations(signal?: AbortSignal): Promise<DesignationItem[]> {
  try {
    const res = await apiFetch(
      '/api/v1/designations?pageSize=100',
      signal ? { signal } : undefined,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: DesignationItem[] };
    return (json.data ?? [])
      .filter((d) => Boolean(d.id && d.title))
      .map((d) => ({
        id: d.id,
        title: d.title,
        code: d.code ?? '',
        level: d.level ?? 1,
      }));
  } catch {
    return [];
  }
}

/**
 * Concurrency limit for parallel manager page requests to avoid saturating HTTP connections or backend limits.
 */
const MANAGER_FETCH_CONCURRENCY = 4;
const DIRECTORY_PAGE_SIZE = 100;

/**
 * Fetches manager options safely within the caller's authorized scope.
 *
 * Discovers managers across all employee records by fetching Page 1 to inspect totalPages,
 * then retrieving all remaining pages using bounded concurrency (4 parallel requests at a time).
 * Supports cancellation via optional AbortSignal.
 * Does not truncate or omit managers after 1,000 employees.
 *
 * For Team Lead callers, the backend enforces D-26 / TEAM scope:
 * only direct reports are returned, excluding the caller's own record.
 * Out-of-scope employees are never exposed.
 */
export async function fetchManagerOptions(signal?: AbortSignal): Promise<ManagerOption[]> {
  try {
    const managerMap = new Map<string, ManagerOption>();

    const recordManagersFromItems = (items: EmployeeDirectoryItem[]) => {
      for (const item of items) {
        if (item.manager && item.manager.id) {
          const fullName = `${item.manager.firstName} ${item.manager.lastName}`.trim();
          managerMap.set(item.manager.id, {
            id: item.manager.id,
            name: fullName || item.manager.employeeCode,
            employeeCode: item.manager.employeeCode,
          });
        }
      }
    };

    // Step 1: Fetch Page 1 to determine total record count and totalPages
    const firstRes = await apiFetch(`/api/v1/employees?page=1&pageSize=${DIRECTORY_PAGE_SIZE}`, {
      signal,
    });
    if (!firstRes.ok) return [];

    const firstJson = await firstRes.json();
    const firstItems: EmployeeDirectoryItem[] = firstJson.data ?? [];
    recordManagersFromItems(firstItems);

    const total =
      typeof firstJson.meta?.total === 'number' ? firstJson.meta.total : firstItems.length;
    const totalPages = Math.ceil(total / DIRECTORY_PAGE_SIZE);

    if (totalPages <= 1) {
      return Array.from(managerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    // Step 2: Build list of remaining pages (2 through totalPages)
    const remainingPages: number[] = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    // Step 3: Fetch remaining pages with bounded concurrency
    for (let i = 0; i < remainingPages.length; i += MANAGER_FETCH_CONCURRENCY) {
      if (signal?.aborted) break;

      const pageBatch = remainingPages.slice(i, i + MANAGER_FETCH_CONCURRENCY);
      const batchResults = await Promise.all(
        pageBatch.map(async (pageNumber) => {
          try {
            const res = await apiFetch(
              `/api/v1/employees?page=${pageNumber}&pageSize=${DIRECTORY_PAGE_SIZE}`,
              { signal },
            );
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data ?? []) as EmployeeDirectoryItem[];
          } catch {
            return [];
          }
        }),
      );

      for (const items of batchResults) {
        recordManagersFromItems(items);
      }
    }

    return Array.from(managerMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
