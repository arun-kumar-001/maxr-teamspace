import { apiFetch } from '../../../api/client';
import type { EmployeeDetail, EmployeePatch } from '../types';

export class EmployeeDetailApiError extends Error {
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
    this.name = 'EmployeeDetailApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isUnprocessable(): boolean {
    return this.status === 422;
  }
}

/**
 * Reads a single employee record by ID.
 * Follows field-level permissions: account login details are included only for Admin and HR.
 * Team Leads see only their reports; Staff see only themselves. Out-of-scope returns 404.
 */
export async function fetchEmployeeDetail(
  id: string,
  signal?: AbortSignal,
): Promise<EmployeeDetail> {
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(id)}`, { signal });

  if (!res.ok) {
    let errorMessage = `Failed to fetch employee details (${res.status})`;
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

    throw new EmployeeDetailApiError(res.status, errorMessage, errorCode, requestId, details);
  }

  const json = (await res.json()) as { data: EmployeeDetail };
  return json.data;
}

/**
 * Updates an employee's details with optimistic concurrency control.
 * Requires `version: number`. Returns 409 on version mismatch or uniqueness clash.
 * HR cannot change employeeCode or email (returns 403). Deactivated employees return 422.
 */
export async function updateEmployeeDetail(
  id: string,
  payload: EmployeePatch & { version: number },
  signal?: AbortSignal,
): Promise<EmployeeDetail> {
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    let errorMessage = `Failed to update employee (${res.status})`;
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

    throw new EmployeeDetailApiError(res.status, errorMessage, errorCode, requestId, details);
  }

  const json = (await res.json()) as { data: EmployeeDetail };
  return json.data;
}
