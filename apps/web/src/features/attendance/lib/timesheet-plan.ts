export interface PlannedHours {
  /** Working days so far this week that the person was expected to work. */
  plannedDays: number;
  plannedHours: number;
}

/**
 * What a person was expected to work in a week up to `today` (or the whole week once it is over):
 * the company work week, minus holidays, minus the days of approved leave, at the full-day hours.
 * Days that have not happened yet are not counted, so a Monday does not look like 40 hours short.
 */
export function plannedFor(input: {
  /** The 7 dates of the week, YYYY-MM-DD, Monday first. */
  weekDates: readonly string[];
  today: string;
  /** Company work week as ISO weekdays: 1 = Monday ... 7 = Sunday. */
  workWeek: readonly number[];
  holidays: ReadonlySet<string>;
  leaveDates: ReadonlySet<string>;
  fullDayMinutes: number;
}): PlannedHours {
  let plannedDays = 0;
  for (const date of input.weekDates) {
    if (date > input.today) continue;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
    if (!input.workWeek.includes(weekday)) continue;
    if (input.holidays.has(date) || input.leaveDates.has(date)) continue;
    plannedDays += 1;
  }
  return {
    plannedDays,
    plannedHours: Math.round(((plannedDays * input.fullDayMinutes) / 60) * 10) / 10,
  };
}

/** Worked against planned: positive is overtime, negative a shortfall; one decimal. */
export function varianceHours(workedHours: number, plannedHours: number): number {
  return Math.round((workedHours - plannedHours) * 10) / 10;
}
