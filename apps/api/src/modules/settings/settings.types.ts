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

export interface CompanySettings extends BasicSettings {
  integrations: IntegrationToggles;
  updatedAt: string;
}

export interface UpdateSettingsDto {
  companyName?: string;
  timezone?: string;
  workWeek?: { start: DayName; end: DayName };
  integrations?: Partial<IntegrationToggles>;
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
