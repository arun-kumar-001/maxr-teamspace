const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The weekday name of a `YYYY-MM-DD` calendar date. */
export function weekdayOf(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] as string;
}

/**
 * Leave days between two dates, both included (D-12): only working days of the company week,
 * and not holidays. A half day is a single date and counts 0.5 (0 when that date is not a working
 * day). Dates are calendar dates with no timezone.
 */
export function countLeaveDays(options: {
  startDate: string;
  endDate: string;
  halfDay: boolean;
  workDays: readonly string[];
  holidays: readonly string[];
}): number {
  const { startDate, endDate, halfDay, workDays } = options;
  const skipped = new Set(options.holidays);
  const first = Date.parse(`${startDate}T00:00:00Z`);
  const last = Date.parse(`${endDate}T00:00:00Z`);
  let working = 0;
  for (let t = first; t <= last; t += MS_PER_DAY) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (workDays.includes(weekdayOf(date)) && !skipped.has(date)) working += 1;
  }
  return halfDay ? working * 0.5 : working;
}
