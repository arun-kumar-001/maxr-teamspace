import { apiFetch } from '../../../api/client';
import type { BasicCompanySettings, CompanySettings, UpdateSettingsPayload } from '../types';

export class SettingsApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  readonly requestId?: string;

  constructor(
    message: string,
    status: number,
    code: string = 'SETTINGS_ERROR',
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = 'SettingsApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface ApiEnvelope<T> {
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
}

export async function getSettings(): Promise<CompanySettings> {
  const response = await apiFetch('/api/v1/settings');

  if (!response.ok) {
    let errorData: ApiEnvelope<CompanySettings>['error'];
    try {
      const json = (await response.json()) as ApiEnvelope<CompanySettings>;
      errorData = json.error;
    } catch {
      // Non-json response
    }
    throw new SettingsApiError(
      errorData?.message || `Failed to fetch settings (status ${response.status})`,
      response.status,
      errorData?.code || 'FETCH_SETTINGS_FAILED',
      errorData?.details,
      errorData?.requestId,
    );
  }

  const json = (await response.json()) as { data: CompanySettings };
  return json.data;
}

export async function updateSettings(payload: UpdateSettingsPayload): Promise<CompanySettings> {
  const response = await apiFetch('/api/v1/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorData: ApiEnvelope<CompanySettings>['error'];
    try {
      const json = (await response.json()) as ApiEnvelope<CompanySettings>;
      errorData = json.error;
    } catch {
      // Non-json response
    }
    throw new SettingsApiError(
      errorData?.message || `Failed to update settings (status ${response.status})`,
      response.status,
      errorData?.code || 'UPDATE_SETTINGS_FAILED',
      errorData?.details,
      errorData?.requestId,
    );
  }

  const json = (await response.json()) as { data: CompanySettings };
  return json.data;
}

export async function getBasicSettings(): Promise<BasicCompanySettings> {
  const response = await apiFetch('/api/v1/settings/basic');

  if (!response.ok) {
    let errorData: ApiEnvelope<BasicCompanySettings>['error'];
    try {
      const json = (await response.json()) as ApiEnvelope<BasicCompanySettings>;
      errorData = json.error;
    } catch {
      // Non-json response
    }
    throw new SettingsApiError(
      errorData?.message || `Failed to fetch basic settings (status ${response.status})`,
      response.status,
      errorData?.code || 'FETCH_BASIC_SETTINGS_FAILED',
      errorData?.details,
      errorData?.requestId,
    );
  }

  const json = (await response.json()) as { data: BasicCompanySettings };
  return json.data;
}
