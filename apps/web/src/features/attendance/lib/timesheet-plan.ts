import { isPermissionLeave } from '../../leave/lib/leave-type';

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

/**
 * One person's approved leave by date within a week: 1 for a whole day, 0.5 for a half day. A
 * permission (a few hours) is not a day off, and leave that is only pending does not count yet.
 */
export function leaveFractionsFor(
  leaves: ReadonlyArray<{
    employeeId: string;
    status: string;
    leaveTypeCode: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    halfDay: boolean;
  }>,
  employeeId: string,
  weekDates: readonly string[],
): Map<string, number> {
  const fractions = new Map<string, number>();
  for (const leave of leaves) {
    if (leave.employeeId !== employeeId || leave.status !== 'approved') continue;
    if (isPermissionLeave({ code: leave.leaveTypeCode, name: leave.leaveTypeName })) continue;
    for (const date of weekDates) {
      if (date >= leave.startDate && date <= leave.endDate) {
        fractions.set(date, Math.min(1, (fractions.get(date) ?? 0) + (leave.halfDay ? 0.5 : 1)));
      }
    }
  }
  return fractions;
}
