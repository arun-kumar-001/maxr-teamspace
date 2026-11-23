import { apiFetch } from '../../../api/client';
import { ApiError } from './employees';
import type { DeactivationResult } from '../types/deactivation';

export { ApiError };

async function handleApiError(res: Response, defaultMessage: string): Promise<never> {
  let errorMessage = `${defaultMessage} (${res.status})`;
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

/**
 * Deactivates an employee immediately. Admin only (D-23).
 * Body is strictly an empty object {}.
 * POST /api/v1/employees/:id/deactivate
 */
export async function deactivateEmployee(employeeId: string): Promise<DeactivationResult> {
  const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(employeeId)}/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to deactivate employee');
  }

  const json = (await res.json()) as { data: DeactivationResult };
  return json.data;
}
