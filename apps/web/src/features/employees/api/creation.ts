import { apiFetch } from '../../../api/client';
import type {
  CreateEmployeePayload,
  CreatedEmployee,
  DepartmentSelectOption,
  DesignationSelectOption,
  ManagerSelectOption,
} from '../types';

export class CreateEmployeeApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly details?: unknown;
  public readonly fieldErrors: Record<string, string>;

  constructor(
    status: number,
    message: string,
    code?: string,
    requestId?: string,
    details?: unknown,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'CreateEmployeeApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Generates a valid unique Idempotency-Key for POST /employees.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `emp-create-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Submits employee creation payload to POST /api/v1/employees.
 * Requires an Idempotency-Key header.
 */
export async function createEmployee(
  payload: CreateEmployeePayload,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<CreatedEmployee> {
  // Construct clean payload strictly adhering to createEmployeeSchema
  const cleanBody: Record<string, unknown> = {
    employeeCode: payload.employeeCode.trim(),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    departmentId: payload.departmentId,
    designationId: payload.designationId,
    joiningDate: payload.joiningDate,
    role: payload.role,
  };

  if (payload.phone && payload.phone.trim()) {
    cleanBody.phone = payload.phone.trim();
  }

  if (payload.managerId && payload.managerId.trim()) {
    cleanBody.managerId = payload.managerId.trim();
  }

  if (payload.additionalEmails && payload.additionalEmails.length > 0) {
    cleanBody.additionalEmails = payload.additionalEmails;
  }

  if (payload.additionalPhones && payload.additionalPhones.length > 0) {
    cleanBody.additionalPhones = payload.additionalPhones;
  }

  if (payload.permanentAddress && payload.permanentAddress.trim()) {
    cleanBody.permanentAddress = payload.permanentAddress.trim();
  }

  if (payload.currentAddress && payload.currentAddress.trim()) {
    cleanBody.currentAddress = payload.currentAddress.trim();
  }

  if (payload.bloodGroup && payload.bloodGroup.trim()) {
    cleanBody.bloodGroup = payload.bloodGroup.trim();
  }

  if (payload.panNumber && payload.panNumber.trim()) {
    cleanBody.panNumber = payload.panNumber.trim().toUpperCase();
  }

  if (payload.aadhaarNumber && payload.aadhaarNumber.trim()) {
    cleanBody.aadhaarNumber = payload.aadhaarNumber.replace(/\s+/g, '');
  }

  if (payload.bankAccountHolder && payload.bankAccountHolder.trim()) {
    cleanBody.bankAccountHolder = payload.bankAccountHolder.trim();
  }

  if (payload.bankName && payload.bankName.trim()) {
    cleanBody.bankName = payload.bankName.trim();
  }

  if (payload.bankAccountNumber && payload.bankAccountNumber.trim()) {
    cleanBody.bankAccountNumber = payload.bankAccountNumber.replace(/\s+/g, '');
  }

  if (payload.bankIfscCode && payload.bankIfscCode.trim()) {
    cleanBody.bankIfscCode = payload.bankIfscCode.trim().toUpperCase();
  }

  if (payload.bankBranch && payload.bankBranch.trim()) {
    cleanBody.bankBranch = payload.bankBranch.trim();
  }

  const res = await apiFetch('/api/v1/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(cleanBody),
    signal,
  });

  if (!res.ok) {
    let errorMessage = `Failed to create employee (${res.status})`;
    let errorCode: string | undefined;
    let requestId: string | undefined;
    let details: unknown = undefined;
    const fieldErrors: Record<string, string> = {};

    try {
      const errorJson = (await res.json()) as {
        error?: {
          message?: string;
          code?: string;
          requestId?: string;
          details?: Array<{ field?: string; message?: string }>;
        };
      };

      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
      errorCode = errorJson.error?.code;
      requestId = errorJson.error?.requestId;
      details = errorJson.error?.details;

      // Map 409 Conflict field errors
      if (res.status === 409) {
        if (/code/i.test(errorMessage)) {
          fieldErrors.employeeCode = errorMessage;
        } else if (/email/i.test(errorMessage)) {
          fieldErrors.email = errorMessage;
        }
      }

      // Map 422 Unprocessable field errors (problems array with { field, message })
      if (res.status === 422 && Array.isArray(errorJson.error?.details)) {
        for (const problem of errorJson.error.details) {
          if (problem.field && problem.message) {
            fieldErrors[problem.field] = problem.message;
          }
        }
      }

      // Map 400 Validation errors if details array exists
      if (res.status === 400 && Array.isArray(errorJson.error?.details)) {
        for (const issue of errorJson.error.details) {
          if (issue.field && issue.message) {
            fieldErrors[issue.field] = issue.message;
          }
        }
      }
    } catch {
      // Non-JSON response
    }

    throw new CreateEmployeeApiError(
      res.status,
      errorMessage,
      errorCode,
      requestId,
      details,
      fieldErrors,
    );
  }

  const json = (await res.json()) as { data: CreatedEmployee };
  return json.data;
}

/**
 * Fetches active departments to populate the department selection.
 */
export async function fetchActiveDepartments(
  signal?: AbortSignal,
): Promise<DepartmentSelectOption[]> {
  try {
    const res = await apiFetch('/api/v1/departments?pageSize=100', { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{ id: string; name: string; code?: string; isActive?: boolean }>;
    };
    return (json.data ?? [])
      .filter((d) => d.isActive !== false && Boolean(d.id && d.name))
      .map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/**
 * Fetches active designations for a specific department.
 */
export async function fetchDesignationsByDepartment(
  departmentId: string,
  signal?: AbortSignal,
): Promise<DesignationSelectOption[]> {
  if (!departmentId) return [];
  try {
    const res = await apiFetch(
      `/api/v1/designations?departmentId=${encodeURIComponent(departmentId)}&pageSize=100`,
      { signal },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        title: string;
        code?: string;
        departmentId: string;
        isActive?: boolean;
      }>;
    };
    return (json.data ?? [])
      .filter(
        (d) => d.isActive !== false && d.departmentId === departmentId && Boolean(d.id && d.title),
      )
      .map((d) => ({
        id: d.id,
        title: d.title,
        code: d.code ?? '',
        departmentId: d.departmentId,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch {
    return [];
  }
}

/**
 * Fetches active employees eligible to be chosen as a reporting manager.
 */
export async function fetchEligibleManagers(signal?: AbortSignal): Promise<ManagerSelectOption[]> {
  try {
    const res = await apiFetch('/api/v1/employees?status=active&pageSize=100', { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        status?: string;
      }>;
    };
    return (json.data ?? [])
      .filter((emp) => Boolean(emp.id && emp.employeeCode))
      .map((emp) => ({
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`.trim() || emp.employeeCode,
        employeeCode: emp.employeeCode,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
