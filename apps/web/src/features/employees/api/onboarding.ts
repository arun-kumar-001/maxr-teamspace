import { apiFetch } from '../../../api/client';
import { ApiError } from './employees';
import type {
  OnboardingChecklistDetail,
  OnboardingListQuery,
  OnboardingListResponse,
} from '../types/onboarding';

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

export async function fetchOnboardingList(
  query: OnboardingListQuery = {},
): Promise<OnboardingListResponse> {
  const searchParams = new URLSearchParams();

  if (query.page) searchParams.set('page', String(query.page));
  if (query.pageSize) searchParams.set('pageSize', String(query.pageSize));
  if (query.status) searchParams.set('status', query.status);
  if (query.step) searchParams.set('step', query.step);
  if (query.departmentId) searchParams.set('departmentId', query.departmentId);
  if (query.search) searchParams.set('search', query.search);

  const queryString = searchParams.toString();
  const url = `/api/v1/onboarding${queryString ? `?${queryString}` : ''}`;

  const res = await apiFetch(url);

  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch onboarding checklists');
  }

  const json = (await res.json()) as {
    data: OnboardingListResponse['data'];
    meta: { total: number };
  };

  return {
    data: json.data,
    total: json.meta?.total ?? json.data.length,
  };
}

export async function fetchOnboardingDetail(
  employeeId: string,
): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}`);

  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch onboarding detail');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}

export async function fetchMyOnboarding(): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch('/api/v1/onboarding/me');

  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch your onboarding checklist');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}

export async function verifyOnboardingItem(
  employeeId: string,
  itemKey: string,
  data: { notes?: string } = {},
): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/items/${itemKey}/verify`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to verify checklist item');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}

export async function unverifyOnboardingItem(
  employeeId: string,
  itemKey: string,
): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/items/${itemKey}/unverify`, {
    method: 'POST',
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to unverify checklist item');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}

export async function generateSetPasswordToken(
  employeeId: string,
): Promise<{ token?: string; expiresAt: string }> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/generate-token`, {
    method: 'POST',
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to generate set-password link');
  }

  const json = (await res.json()) as { data: { token?: string; expiresAt: string } };
  return json.data;
}

export async function setOnboardingPassword(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; employeeId: string }> {
  const res = await apiFetch('/api/v1/onboarding/set-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to set password');
  }

  const json = (await res.json()) as { data: { success: boolean; employeeId: string } };
  return json.data;
}

export async function activateEmployee(employeeId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/activate`, {
    method: 'POST',
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to activate employee account');
  }
}

export async function reopenOnboarding(
  employeeId: string,
  reason?: string,
): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to reopen onboarding');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}

export async function completeEmployeeStep(
  employeeId: string,
  data: { notes?: string } = {},
): Promise<OnboardingChecklistDetail> {
  const res = await apiFetch(`/api/v1/onboarding/${employeeId}/employee-step`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to complete employee step');
  }

  const json = (await res.json()) as { data: OnboardingChecklistDetail };
  return json.data;
}
