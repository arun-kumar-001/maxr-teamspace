export interface MonthMetrics {
  /** Working days from the 1st of the month up to and including today. */
  workingDays: number;
  /** Working days with attendance recorded (and no leave). */
  presentDays: number;
  /** Working days covered by leave applied for and approved. */
  leaveDays: number;
  /** Whole percent of working days so far; null when there are none yet. */
  attendancePct: number | null;
  leavePct: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * This month's attendance and leave as a share of the working days so far (the company work week,
 * not holidays). A day on approved leave counts as leave even if there is a punch; any other day
 * with a record counts as present.
 */
export function computeMonthMetrics(input: {
  /** YYYY-MM-DD, the company's today. */
  today: string;
  workDays: readonly string[];
  holidays: readonly string[];
  /** Dates (YYYY-MM-DD) that have an attendance record. */
  attendedDates: ReadonlySet<string>;
  approvedLeaves: ReadonlyArray<{ startDate: string; endDate: string }>;
}): MonthMetrics {
  const first = Date.parse(`${input.today.slice(0, 7)}-01T00:00:00Z`);
  const last = Date.parse(`${input.today}T00:00:00Z`);
  const holidays = new Set(input.holidays);
  let workingDays = 0;
  let presentDays = 0;
  let leaveDays = 0;
  for (let t = first; t <= last; t += MS_PER_DAY) {
    const date = new Date(t);
    const iso = date.toISOString().slice(0, 10);
    if (!input.workDays.includes(WEEKDAYS[date.getUTCDay()] as string) || holidays.has(iso)) {
      continue;
    }
    workingDays += 1;
    if (input.approvedLeaves.some((l) => iso >= l.startDate && iso <= l.endDate)) {
      leaveDays += 1;
    } else if (input.attendedDates.has(iso)) {
      presentDays += 1;
    }
  }
  const pct = (n: number) => (workingDays > 0 ? Math.round((n / workingDays) * 100) : null);
  return {
    workingDays,
    presentDays,
    leaveDays,
    attendancePct: pct(presentDays),
    leavePct: pct(leaveDays),
  };
}
