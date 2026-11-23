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

/** The server accepts PNG and JPEG up to 2 MB, scanned and stored privately. */
const PHOTO_TYPES = ['image/png', 'image/jpeg'];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function checkPhotoFile(file: File): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return 'Please choose a PNG or JPG image.';
  if (file.size > MAX_PHOTO_BYTES) return 'The photo must be 2 MB or smaller.';
  return null;
}

/** Sets your own profile photo and returns its stable URL. */
export async function uploadMyPhoto(file: File): Promise<string> {
  const problem = checkPhotoFile(file);
  if (problem) throw new ProfileApiError(problem, 400, 'INVALID_PHOTO');
  const res = await apiFetch('/api/v1/employees/me/photo', {
    method: 'PUT',
    // The server checks the file's real type; the name only needs a matching extension.
    headers: {
      'Content-Type': file.type,
      'X-Filename': file.type === 'image/png' ? 'profile.png' : 'profile.jpg',
    },
    body: file,
  });
  const body = (await res.json().catch(() => null)) as {
    data?: { photoUrl?: string };
    error?: { message?: string; code?: string };
  } | null;
  if (!res.ok || !body?.data?.photoUrl) {
    throw new ProfileApiError(
      body?.error?.message ?? 'The photo could not be saved.',
      res.status,
      body?.error?.code,
    );
  }
  return body.data.photoUrl;
}

export async function deleteMyPhoto(): Promise<void> {
  const res = await apiFetch('/api/v1/employees/me/photo', { method: 'DELETE' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ProfileApiError(
      body?.error?.message ?? 'The photo could not be removed.',
      res.status,
    );
  }
}
