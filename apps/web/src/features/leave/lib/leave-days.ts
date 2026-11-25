const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The company work week the API falls back to nowhere: used until the real one has loaded. */
export const DEFAULT_WORK_DAYS: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
];

/**
 * Leave days between two dates, both included, counted the way the API counts them (D-12): only
 * working days of the company week, and not holidays. A half day is a single date and counts 0.5
 * (0 when that date is not a working day). `excluded` is how many days in the range were skipped.
 */
export function countLeaveDays(options: {
  startDate: string;
  endDate: string;
  halfDay: boolean;
  workDays: readonly string[];
  holidays: readonly string[];
}): { days: number; excluded: number } {
  const skipped = new Set(options.holidays);
  const first = Date.parse(`${options.startDate}T00:00:00Z`);
  const last = Date.parse(`${options.endDate}T00:00:00Z`);
  let working = 0;
  let excluded = 0;
  for (let t = first; t <= last; t += MS_PER_DAY) {
    const date = new Date(t);
    const iso = date.toISOString().slice(0, 10);
    if (options.workDays.includes(WEEKDAYS[date.getUTCDay()] as string) && !skipped.has(iso)) {
      working += 1;
    } else {
      excluded += 1;
    }
  }
  return { days: options.halfDay ? working * 0.5 : working, excluded };
}
