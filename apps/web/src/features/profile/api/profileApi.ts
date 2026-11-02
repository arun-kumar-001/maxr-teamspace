import { apiFetch } from '../../../api/client';
import type { EmployeeProfile, ProfileApiResponse, UpdateProfilePayload } from '../types';

export class ProfileApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'PROFILE_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

/**
 * Backend phone validation regex from detail.schemas.ts:
 * Digits, spaces, + ( ) and - only, length between 6 and 50.
 */
export const PHONE_REGEX = /^[0-9+()\-\s]{6,50}$/;

export function validatePhoneInput(phone: string | null | undefined): {
  isValid: boolean;
  error?: string;
} {
  if (phone === null || phone === undefined) {
    return { isValid: true };
  }
  const trimmed = phone.trim();
  if (trimmed === '') {
    return { isValid: true };
  }
  if (!PHONE_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error:
        'Phone number must be 6 to 50 characters and contain only digits, spaces, +, (, ) and -.',
    };
  }
  return { isValid: true };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const errorInfo = payload?.error;
    throw new ProfileApiError(
      errorInfo?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorInfo?.code ?? 'PROFILE_ERROR',
      errorInfo?.details,
      errorInfo?.requestId,
    );
  }

  return payload as T;
}

/**
 * Retrieves the current authenticated user's employee profile.
 * Endpoint: GET /api/v1/employees/me
 */
export async function fetchProfile(signal?: AbortSignal): Promise<EmployeeProfile> {
  const res = await apiFetch('/api/v1/employees/me', {
    method: 'GET',
    signal,
  });

  const body = await handleResponse<ProfileApiResponse>(res);
  return body.data;
}

/**
 * Updates the current authenticated user's phone number.
 * Endpoint: PUT /api/v1/employees/me
 *
 * Strictly sends only `version` and `phone`. No other fields are permitted.
 */
export async function updateProfilePhone(
  payload: UpdateProfilePayload,
  signal?: AbortSignal,
): Promise<EmployeeProfile> {
  // Enforce strict payload contract before transmission
  const strictBody = {
    version: payload.version,
    phone: payload.phone === null || payload.phone?.trim?.() === '' ? null : payload.phone.trim(),
  };

  const res = await apiFetch('/api/v1/employees/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(strictBody),
    signal,
  });

  const body = await handleResponse<ProfileApiResponse>(res);
  return body.data;
}
