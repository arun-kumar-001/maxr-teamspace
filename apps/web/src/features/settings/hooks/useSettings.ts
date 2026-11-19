import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, updateSettings, SettingsApiError } from '../api/settingsApi';
import { setStaffPayslipsEnabled } from '../../../shell/navigation';
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
  // Extended configuration
  companyLogo?: string | null;
  shiftStartTime?: string;
  shiftEndTime?: string;
  standardDailyHours?: number;
  breakMinutes?: number;
  graceMinutes?: number;
  halfDayCutoffMinutes?: number;
  autoCheckoutHours?: number;
  annualLeaveDays?: number;
  casualLeaveDays?: number;
  sickLeaveDays?: number;
  leaveApprovalFlow?: 'lead_only' | 'hr_only' | 'two_tier';
  advanceNoticeDays?: number;
  excludeWeekendsFromLeave?: boolean;
}

export const CONFIG_STORAGE_KEY = 'maxr_company_config';
export const LOGO_STORAGE_KEY = 'maxr_company_logo';

export interface ExtendedCompanyConfig {
  companyLogo?: string | null;
  shiftStartTime?: string;
  shiftEndTime?: string;
  standardDailyHours?: number;
  breakMinutes?: number;
  graceMinutes?: number;
  halfDayCutoffMinutes?: number;
  autoCheckoutHours?: number;
  annualLeaveDays?: number;
  casualLeaveDays?: number;
  sickLeaveDays?: number;
  leaveApprovalFlow?: 'lead_only' | 'hr_only' | 'two_tier';
  advanceNoticeDays?: number;
  excludeWeekendsFromLeave?: boolean;
}

export const DEFAULT_EXTENDED_CONFIG: ExtendedCompanyConfig = {
  companyLogo: null,
  shiftStartTime: '09:00',
  shiftEndTime: '18:00',
  standardDailyHours: 8,
  breakMinutes: 60,
  graceMinutes: 15,
  halfDayCutoffMinutes: 120,
  autoCheckoutHours: 14,
  annualLeaveDays: 18,
  casualLeaveDays: 12,
  sickLeaveDays: 12,
  leaveApprovalFlow: 'lead_only',
  advanceNoticeDays: 2,
  excludeWeekendsFromLeave: true,
};

export function loadStoredExtendedConfig(): ExtendedCompanyConfig {
  let logo: string | null = null;
  try {
    logo = localStorage.getItem(LOGO_STORAGE_KEY);
  } catch {
    // Browser storage can be unavailable
  }

  let parsed: Partial<ExtendedCompanyConfig> = {};
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (raw) {
      parsed = JSON.parse(raw);
    }
  } catch {
    // Browser storage can be unavailable
  }

  return {
    ...DEFAULT_EXTENDED_CONFIG,
    ...parsed,
    companyLogo: logo ?? parsed.companyLogo ?? null,
  };
}

export function persistExtendedConfig(config: ExtendedCompanyConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    if (config.companyLogo) {
      localStorage.setItem(LOGO_STORAGE_KEY, config.companyLogo);
    } else {
      localStorage.removeItem(LOGO_STORAGE_KEY);
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('maxr:company-config-updated'));
  } catch {
    // Browser storage can be unavailable
  }
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
  const [savedExtended, setSavedExtended] = useState<ExtendedCompanyConfig>(loadStoredExtendedConfig);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initDraft = useCallback((s: CompanySettings): SettingsDraft => {
    const ext = loadStoredExtendedConfig();
    setSavedExtended(ext);
    return {
      companyName: s.companyName,
      timezone: s.timezone,
      workWeekStart: s.workWeek.start,
      workWeekEnd: s.workWeek.end,
      integrations: { ...s.integrations },
      ...ext,
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSettings();
      setSettings(data);
      setDraft(initDraft(data));
      try {
        localStorage.setItem('maxr_company_settings', JSON.stringify(data));
      } catch {
        // Browser storage can be unavailable while API settings remain usable.
      }
      if (data.integrations?.payrollExport !== undefined) {
        setStaffPayslipsEnabled(data.integrations.payrollExport);
      }
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

    // Extended config differences
    if ((draft.companyLogo ?? null) !== (savedExtended.companyLogo ?? null)) return true;
    if ((draft.shiftStartTime ?? '09:00') !== (savedExtended.shiftStartTime ?? '09:00')) return true;
    if ((draft.shiftEndTime ?? '18:00') !== (savedExtended.shiftEndTime ?? '18:00')) return true;
    if ((draft.standardDailyHours ?? 8) !== (savedExtended.standardDailyHours ?? 8)) return true;
    if ((draft.breakMinutes ?? 60) !== (savedExtended.breakMinutes ?? 60)) return true;
    if ((draft.graceMinutes ?? 15) !== (savedExtended.graceMinutes ?? 15)) return true;
    if ((draft.halfDayCutoffMinutes ?? 120) !== (savedExtended.halfDayCutoffMinutes ?? 120)) return true;
    if ((draft.autoCheckoutHours ?? 14) !== (savedExtended.autoCheckoutHours ?? 14)) return true;
    if ((draft.annualLeaveDays ?? 18) !== (savedExtended.annualLeaveDays ?? 18)) return true;
    if ((draft.casualLeaveDays ?? 12) !== (savedExtended.casualLeaveDays ?? 12)) return true;
    if ((draft.sickLeaveDays ?? 12) !== (savedExtended.sickLeaveDays ?? 12)) return true;
    if ((draft.leaveApprovalFlow ?? 'lead_only') !== (savedExtended.leaveApprovalFlow ?? 'lead_only')) return true;
    if ((draft.advanceNoticeDays ?? 2) !== (savedExtended.advanceNoticeDays ?? 2)) return true;
    if ((draft.excludeWeekendsFromLeave ?? true) !== (savedExtended.excludeWeekendsFromLeave ?? true)) return true;

    return false;
  }, [settings, draft, savedExtended]);

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

    if (!draft) return false;

    setIsSaving(true);
    setError(null);
    try {
      const payload = buildPayload();
      let updatedSettings = settings;

      if (payload && Object.keys(payload).length > 0) {
        updatedSettings = await updateSettings(payload);
        setSettings(updatedSettings);
      }

      // Persist extended configuration in storage
      const newExtended: ExtendedCompanyConfig = {
        companyLogo: draft.companyLogo ?? null,
        shiftStartTime: draft.shiftStartTime ?? '09:00',
        shiftEndTime: draft.shiftEndTime ?? '18:00',
        standardDailyHours: draft.standardDailyHours ?? 8,
        breakMinutes: draft.breakMinutes ?? 60,
        graceMinutes: draft.graceMinutes ?? 15,
        halfDayCutoffMinutes: draft.halfDayCutoffMinutes ?? 120,
        autoCheckoutHours: draft.autoCheckoutHours ?? 14,
        annualLeaveDays: draft.annualLeaveDays ?? 18,
        casualLeaveDays: draft.casualLeaveDays ?? 12,
        sickLeaveDays: draft.sickLeaveDays ?? 12,
        leaveApprovalFlow: draft.leaveApprovalFlow ?? 'lead_only',
        advanceNoticeDays: draft.advanceNoticeDays ?? 2,
        excludeWeekendsFromLeave: draft.excludeWeekendsFromLeave ?? true,
      };

      persistExtendedConfig(newExtended);
      setSavedExtended(newExtended);

      if (updatedSettings) {
        setDraft(initDraft(updatedSettings));
        try {
          localStorage.setItem('maxr_company_settings', JSON.stringify(updatedSettings));
        } catch {
          // Browser storage can be unavailable while API settings remain usable.
        }
        if (updatedSettings.integrations?.payrollExport !== undefined) {
          setStaffPayslipsEnabled(updatedSettings.integrations.payrollExport);
        }
      }

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
  }, [hasWorkWeekError, buildPayload, draft, settings, initDraft]);

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
