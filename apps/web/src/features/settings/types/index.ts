export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type DayName = (typeof DAY_NAMES)[number];

export interface IntegrationToggles {
  email: boolean;
  sms: boolean;
  calendarSync: boolean;
  payrollExport: boolean;
}

export interface WorkWeek {
  start: DayName;
  end: DayName;
  days: DayName[];
}

export interface BasicCompanySettings {
  companyName: string;
  timezone: string;
  workWeek: WorkWeek;
}

export interface PermissionPolicyConfig {
  enabled: boolean;
  maxPermissionsPerMonth: number;
  maxHoursPerPermission: number;
  totalMonthlyPermissionHours?: number;
  advanceNoticeHours?: number;
  requiresCompensation?: boolean;
  approvalFlow?: 'lead_only' | 'hr_only' | 'auto_approved';
  allowLateArrival?: boolean;
  allowEarlyDeparture?: boolean;
}

export interface LateDeductionConfig {
  enabled: boolean;
  graceMinutes: number;
  deductionType: 'fixed_amount' | 'half_day_salary' | 'hourly_rate' | 'none';
  deductionAmount: number;
  freeLateLimitCount: number;
  halfDayCutoffMinutes: number;
}

export interface CompanySettings extends BasicCompanySettings {
  integrations: IntegrationToggles;
  /** A PNG, JPEG or WebP data URL kept on the server, or null. */
  companyLogo: string | null;
  /** null until an Admin has saved one; the screen then shows its defaults. */
  lateDeductionPolicy: LateDeductionConfig | null;
  permissionPolicy: PermissionPolicyConfig | null;
  updatedAt: string;
}

export interface UpdateSettingsPayload {
  companyName?: string;
  timezone?: string;
  workWeek?: {
    start: DayName;
    end: DayName;
  };
  integrations?: Partial<IntegrationToggles>;
  /** null removes the logo. */
  companyLogo?: string | null;
  lateDeductionPolicy?: LateDeductionConfig;
  permissionPolicy?: PermissionPolicyConfig;
}

/**
 * Calculates days from start to end inclusive, wrapping past Sunday.
 */
export function calculateWorkDays(start: DayName, end: DayName): DayName[] {
  const from = DAY_NAMES.indexOf(start);
  const to = DAY_NAMES.indexOf(end);
  if (from === -1 || to === -1) return [];

  const out: DayName[] = [];
  for (let i = from; ; i = (i + 1) % DAY_NAMES.length) {
    out.push(DAY_NAMES[i]!);
    if (i === to) {
      return out;
    }
  }
}
