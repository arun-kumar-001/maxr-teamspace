const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface PlannedHours {
  /** Working days so far this week that the person was expected to work (a half day counts 0.5). */
  plannedDays: number;
  plannedHours: number;
}

/**
 * What a person was expected to work in a week up to `today` (or the whole week once it is over):
 * the company work week, minus holidays, minus approved leave (half a day for a half day), at
 * the full-day hours.
 * Days that have not happened yet are not counted, so a Monday does not look like 40 hours short.
 */
export function plannedFor(input: {
  /** The 7 dates of the week, YYYY-MM-DD, Monday first. */
  weekDates: readonly string[];
  today: string;
  /** The company work week as day names, for example `Monday`. */
  workDays: readonly string[];
  holidays: ReadonlySet<string>;
  /** Approved leave by date: 1 for a whole day, 0.5 for a half day. */
  leaveFractions: ReadonlyMap<string, number>;
  fullDayMinutes: number;
}): PlannedHours {
  let plannedDays = 0;
  for (const date of input.weekDates) {
    if (date > input.today) continue;
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as string;
    if (!input.workDays.includes(weekday)) continue;
    if (input.holidays.has(date)) continue;
    plannedDays += 1 - Math.min(1, input.leaveFractions.get(date) ?? 0);
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
