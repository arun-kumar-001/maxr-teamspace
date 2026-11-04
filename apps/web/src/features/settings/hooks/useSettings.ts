import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, updateSettings, SettingsApiError } from '../api/settingsApi';
import {
  type CompanySettings,
  type DayName,
  type IntegrationToggles,
  type UpdateSettingsPayload,
} from '../types';

export interface SettingsDraft {
  companyName: string;
  timezone: string;
  workWeekStart: DayName;
  workWeekEnd: DayName;
  integrations: IntegrationToggles;
}

export interface UseSettingsResult {
  settings: CompanySettings | null;
  draft: SettingsDraft | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  isDirty: boolean;
  hasWorkWeekError: boolean;
  workWeekErrorMessage: string | null;
  updateDraft: (updates: Partial<SettingsDraft>) => void;
  updateIntegrationToggle: (key: keyof IntegrationToggles, value: boolean) => void;
  saveSettings: () => Promise<boolean>;
  resetDraft: () => void;
  refetch: () => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initDraft = useCallback((s: CompanySettings): SettingsDraft => {
    return {
      companyName: s.companyName,
      timezone: s.timezone,
      workWeekStart: s.workWeek.start,
      workWeekEnd: s.workWeek.end,
      integrations: { ...s.integrations },
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      setSettings(data);
      setDraft(initDraft(data));
    } catch (err) {
      if (err instanceof SettingsApiError) {
        setError(err.message);
      } else {
        setError('Failed to load company settings');
      }
    } finally {
      setIsLoading(false);
    }
  }, [initDraft]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateDraft = useCallback((updates: Partial<SettingsDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const updateIntegrationToggle = useCallback((key: keyof IntegrationToggles, value: boolean) => {
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        integrations: {
          ...prev.integrations,
          [key]: value,
        },
      };
    });
  }, []);

  const resetDraft = useCallback(() => {
    if (settings) {
      setDraft(initDraft(settings));
      setError(null);
    }
  }, [settings, initDraft]);

  const hasWorkWeekError = useMemo(() => {
    if (!draft) return false;
    return draft.workWeekStart === draft.workWeekEnd;
  }, [draft]);

  const workWeekErrorMessage = useMemo(() => {
    if (hasWorkWeekError) {
      return 'Start day and end day cannot be the same day.';
    }
    return null;
  }, [hasWorkWeekError]);

  const isDirty = useMemo(() => {
    if (!settings || !draft) return false;
    if (draft.companyName.trim() !== settings.companyName) return true;
    if (draft.timezone !== settings.timezone) return true;
    if (draft.workWeekStart !== settings.workWeek.start) return true;
    if (draft.workWeekEnd !== settings.workWeek.end) return true;
    if (draft.integrations.email !== settings.integrations.email) return true;
    if (draft.integrations.sms !== settings.integrations.sms) return true;
    if (draft.integrations.calendarSync !== settings.integrations.calendarSync) return true;
    if (draft.integrations.payrollExport !== settings.integrations.payrollExport) return true;
    return false;
  }, [settings, draft]);

  const buildPayload = useCallback((): UpdateSettingsPayload | null => {
    if (!settings || !draft) return null;

    const payload: UpdateSettingsPayload = {};

    if (draft.companyName.trim() !== settings.companyName) {
      payload.companyName = draft.companyName.trim();
    }
    if (draft.timezone !== settings.timezone) {
      payload.timezone = draft.timezone;
    }
    if (
      draft.workWeekStart !== settings.workWeek.start ||
      draft.workWeekEnd !== settings.workWeek.end
    ) {
      payload.workWeek = {
        start: draft.workWeekStart,
        end: draft.workWeekEnd,
      };
    }

    const changedIntegrations: Partial<IntegrationToggles> = {};
    let hasIntegrationChange = false;

    if (draft.integrations.email !== settings.integrations.email) {
      changedIntegrations.email = draft.integrations.email;
      hasIntegrationChange = true;
    }
    if (draft.integrations.sms !== settings.integrations.sms) {
      changedIntegrations.sms = draft.integrations.sms;
      hasIntegrationChange = true;
    }
    if (draft.integrations.calendarSync !== settings.integrations.calendarSync) {
      changedIntegrations.calendarSync = draft.integrations.calendarSync;
      hasIntegrationChange = true;
    }
    if (draft.integrations.payrollExport !== settings.integrations.payrollExport) {
      changedIntegrations.payrollExport = draft.integrations.payrollExport;
      hasIntegrationChange = true;
    }

    if (hasIntegrationChange) {
      payload.integrations = changedIntegrations;
    }

    return payload;
  }, [settings, draft]);

  const saveSettings = useCallback(async (): Promise<boolean> => {
    if (hasWorkWeekError) {
      setError('A work week needs a start day that differs from its end day');
      return false;
    }

    const payload = buildPayload();
    if (!payload || Object.keys(payload).length === 0) {
      return true; // Nothing to update
    }

    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateSettings(payload);
      setSettings(updated);
      setDraft(initDraft(updated));
      return true;
    } catch (err) {
      if (err instanceof SettingsApiError) {
        setError(err.message);
      } else {
        setError('Failed to save settings changes');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [hasWorkWeekError, buildPayload, initDraft]);

  return {
    settings,
    draft,
    isLoading,
    isSaving,
    error,
    isDirty,
    hasWorkWeekError,
    workWeekErrorMessage,
    updateDraft,
    updateIntegrationToggle,
    saveSettings,
    resetDraft,
    refetch: fetchSettings,
  };
}
