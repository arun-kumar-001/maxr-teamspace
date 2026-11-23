import { isDemoDataEnabled } from '@/lib/demo-data';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSettings, updateSettings, SettingsApiError } from '../api/settingsApi';
import { setStaffPayslipsEnabled } from '../../../shell/navigation';
import { fetchLeavePolicies, createLeavePolicy, updateLeavePolicy } from '../../leave/api/leave';
import type { LeavePolicy } from '../../leave/types';
import {
  type CompanySettings,
  type DayName,
  type IntegrationToggles,
  type LateDeductionConfig,
  type PermissionPolicyConfig,
  type UpdateSettingsPayload,
  calculateWorkDays,
} from '../types';

export interface CustomLeaveType {
  id: string;
  name: string;
  code?: string;
  category?:
    | 'annual'
    | 'casual'
    | 'medical'
    | 'parental'
    | 'special'
    | 'unpaid'
    | 'compensatory'
    | 'general'
    | 'permission';
  frequency: 'monthly' | 'yearly';
  quota: number;
  isPaid: boolean;
  accrualMethod?: 'monthly' | 'yearly' | 'upfront' | 'manual';
  monthlyCredit?: number;
  annualEntitlement?: number;
  maxBalance?: number;
  creditStartDate?: string;
  leaveYearType?: 'calendar' | 'financial' | 'anniversary';
  proratedAllocation?: boolean;
  probationEligibility?: 'eligible' | 'not_eligible' | 'reduced';
  carryForwardEnabled?: boolean;
  carryForwardMax?: number;
  carryForwardExpiryMonths?: number;
  encashmentEnabled?: boolean;
  maxEncashableDays?: number;
  encashmentBasis?: 'basic_salary' | 'gross_salary' | 'fixed_rate';
  encashmentAtYearEnd?: boolean;
  encashmentAtExit?: boolean;
  allowHalfDay?: boolean;
  allowNegativeBalance?: boolean;
  maxNegativeDays?: number;
  allowUnpaid?: boolean;
  requireDocs?: boolean;
  minDaysForDocs?: number;
  noticePeriodDays?: number;
  maxConsecutiveDays?: number;
  allowProbation?: boolean;
  maxBackdateDays?: number;
  includeWeekends?: boolean;
  includeHolidays?: boolean;
  isActive?: boolean;
  description?: string;
}

export interface LeavePolicyProfile {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  leaveYearType: 'calendar' | 'financial' | 'anniversary';
  proratedAllocation: boolean;
  leaveTypeIds: string[];
  assignedDepartments?: string[];
  assignedEmployeesCount?: number;
}

export type { LateDeductionConfig, PermissionPolicyConfig };

export const DEFAULT_LATE_DEDUCTION: LateDeductionConfig = {
  enabled: true,
  graceMinutes: 15,
  deductionType: 'fixed_amount',
  deductionAmount: 100,
  freeLateLimitCount: 2,
  halfDayCutoffMinutes: 120,
};

/** Predefined templates available on demand for quick start, but never imposed as mandatory defaults */
export const SAMPLE_LEAVE_TEMPLATES: CustomLeaveType[] = [
  {
    id: 'leave_sample_annual',
    name: 'Earned / Annual Leave',
    code: 'EL',
    category: 'annual',
    frequency: 'yearly',
    quota: 18,
    isPaid: true,
    accrualMethod: 'yearly',
    annualEntitlement: 18,
    carryForwardEnabled: true,
    carryForwardMax: 15,
    carryForwardExpiryMonths: 12,
    encashmentEnabled: true,
    maxEncashableDays: 10,
    encashmentBasis: 'basic_salary',
    encashmentAtExit: true,
    allowHalfDay: true,
    allowNegativeBalance: false,
    requireDocs: false,
    noticePeriodDays: 3,
    maxConsecutiveDays: 14,
    allowProbation: false,
    includeWeekends: false,
    includeHolidays: false,
    isActive: true,
    description: 'Statutory earned annual leave with carry forward and encashment at separation',
  },
  {
    id: 'leave_sample_casual',
    name: 'Casual Leave',
    code: 'CL',
    category: 'casual',
    frequency: 'monthly',
    quota: 12,
    isPaid: true,
    accrualMethod: 'monthly',
    monthlyCredit: 1.0,
    annualEntitlement: 12,
    carryForwardEnabled: false,
    carryForwardMax: 0,
    encashmentEnabled: false,
    maxEncashableDays: 0,
    allowHalfDay: true,
    allowNegativeBalance: false,
    requireDocs: false,
    noticePeriodDays: 1,
    maxConsecutiveDays: 3,
    allowProbation: true,
    includeWeekends: false,
    includeHolidays: false,
    isActive: true,
    description: 'Monthly accrued personal and urgent leaves that lapse at year-end',
  },
  {
    id: 'leave_sample_sick',
    name: 'Sick / Medical Leave',
    code: 'SL',
    category: 'medical',
    frequency: 'yearly',
    quota: 12,
    isPaid: true,
    accrualMethod: 'yearly',
    annualEntitlement: 12,
    carryForwardEnabled: false,
    carryForwardMax: 0,
    encashmentEnabled: false,
    maxEncashableDays: 0,
    allowHalfDay: true,
    allowNegativeBalance: true,
    maxNegativeDays: 2,
    requireDocs: true,
    minDaysForDocs: 2,
    noticePeriodDays: 0,
    maxConsecutiveDays: 15,
    allowProbation: true,
    maxBackdateDays: 3,
    includeWeekends: false,
    includeHolidays: false,
    isActive: true,
    description: 'Medical and health recuperation. Medical slip required if > 2 consecutive days',
  },
];

export const DEFAULT_LEAVE_TYPES: CustomLeaveType[] = [];

export const DEFAULT_PERMISSION_POLICY: PermissionPolicyConfig = {
  enabled: true,
  maxPermissionsPerMonth: 2,
  maxHoursPerPermission: 2,
  totalMonthlyPermissionHours: 4,
  advanceNoticeHours: 1,
  requiresCompensation: false,
  approvalFlow: 'lead_only',
  allowLateArrival: true,
  allowEarlyDeparture: true,
};

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
  customLeaveTypes?: CustomLeaveType[];
  leavePolicies?: LeavePolicyProfile[];
  lateDeductionPolicy?: LateDeductionConfig;
  permissionPolicy?: PermissionPolicyConfig;
}

export const CONFIG_STORAGE_KEY = 'maxr_company_config';

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
  customLeaveTypes?: CustomLeaveType[];
  leavePolicies?: LeavePolicyProfile[];
  lateDeductionPolicy?: LateDeductionConfig;
  permissionPolicy?: PermissionPolicyConfig;
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
  leaveApprovalFlow: 'lead_only',
  advanceNoticeDays: 2,
  excludeWeekendsFromLeave: true,
  customLeaveTypes: [], // Initially empty: every company starts with clear empty state
  leavePolicies: [], // Initially empty
  lateDeductionPolicy: DEFAULT_LATE_DEDUCTION,
  permissionPolicy: DEFAULT_PERMISSION_POLICY,
};

/** What may be cached in this browser: the navigation only needs the integration toggles. */
function cacheable(settings: CompanySettings): CompanySettings {
  return { ...settings, companyLogo: null, lateDeductionPolicy: null, permissionPolicy: null };
}

/**
 * The part of the company configuration that is still kept in this browser only (shift times,
 * leave quotas and similar). The logo and the late-deduction and permission policies are NOT here:
 * they are saved on the server, so every user sees the same ones.
 */
export function loadStoredExtendedConfig(): ExtendedCompanyConfig {
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
    companyLogo: null,
    lateDeductionPolicy: DEFAULT_LATE_DEDUCTION,
    permissionPolicy: DEFAULT_PERMISSION_POLICY,
  };
}

/** The server-held settings as the screen edits them; defaults stand in for "never configured". */
export function serverBackedConfig(
  s: Pick<CompanySettings, 'companyLogo' | 'lateDeductionPolicy' | 'permissionPolicy'>,
): Pick<ExtendedCompanyConfig, 'companyLogo' | 'lateDeductionPolicy' | 'permissionPolicy'> {
  return {
    companyLogo: s.companyLogo ?? null,
    lateDeductionPolicy: s.lateDeductionPolicy
      ? { ...DEFAULT_LATE_DEDUCTION, ...s.lateDeductionPolicy }
      : DEFAULT_LATE_DEDUCTION,
    permissionPolicy: s.permissionPolicy
      ? { ...DEFAULT_PERMISSION_POLICY, ...s.permissionPolicy }
      : DEFAULT_PERMISSION_POLICY,
  };
}

export function persistExtendedConfig(config: ExtendedCompanyConfig) {
  // The logo and the two policies belong to the server; they are not copied into this browser.
  const {
    companyLogo: _logo,
    lateDeductionPolicy: _late,
    permissionPolicy: _perm,
    ...local
  } = config;
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(local));
  } catch {
    // Browser storage can be unavailable
  }
  window.dispatchEvent(new Event('maxr:company-config-updated'));
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
  const [savedExtended, setSavedExtended] =
    useState<ExtendedCompanyConfig>(loadStoredExtendedConfig);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const initDraft = useCallback(
    (s: CompanySettings, policies: LeavePolicy[] = []): SettingsDraft => {
      const ext = { ...loadStoredExtendedConfig(), ...serverBackedConfig(s) };

      let effectiveLeaveTypes: CustomLeaveType[] = ext.customLeaveTypes ?? [];
      if (policies && policies.length > 0) {
        effectiveLeaveTypes = policies.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          quota: p.annualDays,
          annualEntitlement: p.annualDays,
          isPaid: p.hasBalance,
          allowHalfDay: p.allowHalfDay,
          maxBackdateDays: p.maxBackdateDays,
          carryForwardEnabled: p.carryForwardMax > 0,
          carryForwardMax: p.carryForwardMax,
          isActive: p.isActive,
          category:
            p.code === 'PM' ||
            p.code === 'PERMISSION' ||
            p.name.toLowerCase().includes('permission')
              ? 'permission'
              : 'general',
          frequency: 'yearly',
          accrualMethod: p.hasBalance ? 'yearly' : 'manual',
        }));
      }

      const merged = { ...ext, customLeaveTypes: effectiveLeaveTypes };
      setSavedExtended(merged);
      return {
        companyName: s.companyName,
        timezone: s.timezone,
        workWeekStart: s.workWeek.start,
        workWeekEnd: s.workWeek.end,
        integrations: { ...s.integrations },
        ...merged,
      };
    },
    [],
  );

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, policies] = await Promise.all([
        getSettings(),
        fetchLeavePolicies().catch(() => [] as LeavePolicy[]),
      ]);
      setSettings(data);
      setDraft(initDraft(data, policies));
      try {
        localStorage.setItem('maxr_company_settings', JSON.stringify(cacheable(data)));
      } catch {
        // Browser storage can be unavailable while API settings remain usable.
      }
      if (data.integrations?.payrollExport !== undefined) {
        setStaffPayslipsEnabled(data.integrations.payrollExport);
      }
    } catch (err) {
      // Only the development demo may show cached or invented settings. In production a failed
      // load is an error: stale values would look current and an Admin could save over real ones.
      let fallbackSettings: CompanySettings | null = null;
      try {
        const stored = isDemoDataEnabled() ? localStorage.getItem('maxr_company_settings') : null;
        if (stored) {
          fallbackSettings = JSON.parse(stored);
        }
      } catch {
        // Browser storage access error
      }

      if (!fallbackSettings && isDemoDataEnabled()) {
        fallbackSettings = {
          companyName: 'MAXR Global Technologies',
          timezone: 'Asia/Kolkata',
          workWeek: {
            start: 'Monday',
            end: 'Friday',
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          },
          integrations: {
            email: true,
            sms: false,
            calendarSync: true,
            payrollExport: false,
          },
          companyLogo: null,
          lateDeductionPolicy: null,
          permissionPolicy: null,
          updatedAt: new Date().toISOString(),
        };
      }

      if (fallbackSettings) {
        setSettings(fallbackSettings);
        setDraft(initDraft(fallbackSettings));
      } else {
        if (err instanceof SettingsApiError) {
          setError(err.message);
        } else {
          setError('Failed to load company settings');
        }
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
    const server = serverBackedConfig(settings);
    if ((draft.companyLogo ?? null) !== server.companyLogo) return true;
    if ((draft.shiftStartTime ?? '09:00') !== (savedExtended.shiftStartTime ?? '09:00'))
      return true;
    if ((draft.shiftEndTime ?? '18:00') !== (savedExtended.shiftEndTime ?? '18:00')) return true;
    if ((draft.standardDailyHours ?? 8) !== (savedExtended.standardDailyHours ?? 8)) return true;
    if ((draft.breakMinutes ?? 60) !== (savedExtended.breakMinutes ?? 60)) return true;
    if ((draft.graceMinutes ?? 15) !== (savedExtended.graceMinutes ?? 15)) return true;
    if ((draft.halfDayCutoffMinutes ?? 120) !== (savedExtended.halfDayCutoffMinutes ?? 120))
      return true;
    if ((draft.autoCheckoutHours ?? 14) !== (savedExtended.autoCheckoutHours ?? 14)) return true;
    if ((draft.annualLeaveDays ?? 18) !== (savedExtended.annualLeaveDays ?? 18)) return true;
    if ((draft.casualLeaveDays ?? 12) !== (savedExtended.casualLeaveDays ?? 12)) return true;
    if ((draft.sickLeaveDays ?? 12) !== (savedExtended.sickLeaveDays ?? 12)) return true;
    if (
      (draft.leaveApprovalFlow ?? 'lead_only') !== (savedExtended.leaveApprovalFlow ?? 'lead_only')
    )
      return true;
    if ((draft.advanceNoticeDays ?? 2) !== (savedExtended.advanceNoticeDays ?? 2)) return true;
    if (
      (draft.excludeWeekendsFromLeave ?? true) !== (savedExtended.excludeWeekendsFromLeave ?? true)
    )
      return true;

    // Custom leave types, permission policies, and late deduction policy
    if (
      JSON.stringify(draft.customLeaveTypes || []) !==
      JSON.stringify(savedExtended.customLeaveTypes || [])
    )
      return true;
    if (JSON.stringify(draft.permissionPolicy) !== JSON.stringify(server.permissionPolicy))
      return true;
    if (JSON.stringify(draft.lateDeductionPolicy) !== JSON.stringify(server.lateDeductionPolicy))
      return true;

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

    const server = serverBackedConfig(settings);
    if ((draft.companyLogo ?? null) !== server.companyLogo) {
      payload.companyLogo = draft.companyLogo ?? null;
    }
    if (
      draft.lateDeductionPolicy &&
      JSON.stringify(draft.lateDeductionPolicy) !== JSON.stringify(server.lateDeductionPolicy)
    ) {
      payload.lateDeductionPolicy = draft.lateDeductionPolicy;
    }
    if (
      draft.permissionPolicy &&
      JSON.stringify(draft.permissionPolicy) !== JSON.stringify(server.permissionPolicy)
    ) {
      payload.permissionPolicy = draft.permissionPolicy;
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
        try {
          updatedSettings = await updateSettings(payload);
          setSettings(updatedSettings);
        } catch (apiErr) {
          if (!isDemoDataEnabled()) throw apiErr;
          if (settings) {
            updatedSettings = {
              ...settings,
              ...payload,
              workWeek: payload.workWeek
                ? {
                    start: payload.workWeek.start,
                    end: payload.workWeek.end,
                    days: calculateWorkDays(payload.workWeek.start, payload.workWeek.end),
                  }
                : settings.workWeek,
              integrations: payload.integrations
                ? { ...settings.integrations, ...payload.integrations }
                : settings.integrations,
              updatedAt: new Date().toISOString(),
            };
            setSettings(updatedSettings);
          }
        }
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
        customLeaveTypes: draft.customLeaveTypes ?? [],
        leavePolicies: draft.leavePolicies ?? [],
        permissionPolicy: draft.permissionPolicy ?? DEFAULT_PERMISSION_POLICY,
        lateDeductionPolicy: draft.lateDeductionPolicy ?? DEFAULT_LATE_DEDUCTION,
      };

      persistExtendedConfig(newExtended);
      setSavedExtended(newExtended);

      // Synchronize configured leave types with the backend leave_policies table
      if (draft.customLeaveTypes && draft.customLeaveTypes.length > 0) {
        try {
          const currentBackend = await fetchLeavePolicies().catch(() => [] as LeavePolicy[]);
          for (const item of draft.customLeaveTypes) {
            const existing = currentBackend.find(
              (bp) =>
                bp.id === item.id ||
                (item.code && bp.code.toUpperCase() === item.code.toUpperCase()),
            );
            const isPerm =
              item.category === 'permission' ||
              item.code === 'PM' ||
              item.code === 'PERMISSION' ||
              item.name.toLowerCase().includes('permission');
            const hasBal = isPerm ? false : (item.isPaid ?? true);
            const annualDays = hasBal ? item.quota || 0 : 0;
            const carryForwardMax =
              hasBal && item.carryForwardEnabled ? item.carryForwardMax || 0 : 0;

            if (existing) {
              const hasDiff =
                existing.name !== item.name ||
                existing.annualDays !== annualDays ||
                existing.carryForwardMax !== carryForwardMax ||
                existing.allowHalfDay !== (item.allowHalfDay ?? true) ||
                existing.maxBackdateDays !== (item.maxBackdateDays ?? 0) ||
                existing.isActive !== (item.isActive ?? true);
              if (hasDiff) {
                await updateLeavePolicy(existing.id, {
                  name: item.name,
                  annualDays,
                  carryForwardMax,
                  allowHalfDay: isPerm ? false : (item.allowHalfDay ?? true),
                  maxBackdateDays: item.maxBackdateDays ?? 0,
                  isActive: item.isActive ?? true,
                  version: existing.version,
                }).catch(() => {});
              }
            } else {
              const rawCode =
                (item.code || item.name.slice(0, 4))
                  .trim()
                  .toUpperCase()
                  .replace(/[^A-Z0-9_]/g, '') || 'LV';
              const cleanCode = rawCode.length >= 2 ? rawCode : `${rawCode}X`;
              await createLeavePolicy({
                code: cleanCode,
                name: item.name,
                hasBalance: hasBal,
                annualDays,
                carryForwardMax,
                allowHalfDay: isPerm ? false : (item.allowHalfDay ?? true),
                maxBackdateDays: item.maxBackdateDays ?? (isPerm ? 2 : 0),
              }).catch(() => {});
            }
          }
        } catch {
          // Leave policy sync is best-effort alongside company settings
        }
      }

      if (updatedSettings) {
        setDraft(initDraft(updatedSettings));
        try {
          localStorage.setItem('maxr_company_settings', JSON.stringify(cacheable(updatedSettings)));
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
