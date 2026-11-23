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

/** Optional integrations an Admin can switch on or off (the adapters decide what "on" means). */
export interface IntegrationToggles {
  email: boolean;
  sms: boolean;
  calendarSync: boolean;
  payrollExport: boolean;
}

export interface WorkWeek {
  start: DayName;
  end: DayName;
  /** Every working day from `start` to `end`, wrapping over the weekend (Sunday to Thursday works). */
  days: DayName[];
}

/** What every module may read: no integration or Admin-only data. */
export interface BasicSettings {
  companyName: string;
  /** IANA timezone, for example `Asia/Kolkata`. All timestamps are stored in UTC and shown in this zone. */
  timezone: string;
  workWeek: WorkWeek;
}

export const DEDUCTION_TYPES = ['fixed_amount', 'half_day_salary', 'hourly_rate', 'none'] as const;
export const PERMISSION_APPROVAL_FLOWS = ['lead_only', 'hr_only', 'auto_approved'] as const;

/** What happens to pay when someone arrives late. Stored as configured; payroll reads it later. */
export interface LateDeductionPolicy {
  enabled: boolean;
  graceMinutes: number;
  deductionType: (typeof DEDUCTION_TYPES)[number];
  deductionAmount: number;
  freeLateLimitCount: number;
  halfDayCutoffMinutes: number;
}

/** Short absences (a few hours) that are not leave. */
export interface PermissionPolicy {
  enabled: boolean;
  maxPermissionsPerMonth: number;
  maxHoursPerPermission: number;
  totalMonthlyPermissionHours?: number;
  advanceNoticeHours?: number;
  requiresCompensation?: boolean;
  approvalFlow?: (typeof PERMISSION_APPROVAL_FLOWS)[number];
  allowLateArrival?: boolean;
  allowEarlyDeparture?: boolean;
}

export interface CompanySettings extends BasicSettings {
  integrations: IntegrationToggles;
  /** A `data:image/png|jpeg|webp;base64,...` URL, or null when none was uploaded. */
  companyLogo: string | null;
  /** null until an Admin saves one. */
  lateDeductionPolicy: LateDeductionPolicy | null;
  permissionPolicy: PermissionPolicy | null;
  updatedAt: string;
}

export interface UpdateSettingsDto {
  companyName?: string;
  timezone?: string;
  workWeek?: { start: DayName; end: DayName };
  integrations?: Partial<IntegrationToggles>;
  /** null removes the logo. */
  companyLogo?: string | null;
  lateDeductionPolicy?: LateDeductionPolicy;
  permissionPolicy?: PermissionPolicy;
}

/** The single company settings row. A database CHECK keeps it the only one. */
export const COMPANY_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

/** Days from `start` to `end` inclusive, wrapping past Sunday. */
export function workDays(start: DayName, end: DayName): DayName[] {
  const from = DAY_NAMES.indexOf(start);
  const to = DAY_NAMES.indexOf(end);
  const out: DayName[] = [];
  for (let i = from; ; i = (i + 1) % DAY_NAMES.length) {
    out.push(DAY_NAMES[i] as DayName);
    if (i === to) {
      return out;
    }
  }
}
