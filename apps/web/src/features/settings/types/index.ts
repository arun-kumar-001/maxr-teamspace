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

export interface CompanySettings extends BasicCompanySettings {
  integrations: IntegrationToggles;
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
