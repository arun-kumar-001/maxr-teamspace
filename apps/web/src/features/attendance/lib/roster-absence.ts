/**
 * Whether an employee with no attendance record on a day should show as Absent in the roster: a
 * past working day (not a weekly off, not a company holiday), after they joined, with no leave
 * applied for. Today and the future are never absent.
 */
export function isAbsentDay(day: {
  dateStr: string;
  isPast: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  hasLeave: boolean;
  joiningDate?: string | null;
}): boolean {
  if (!day.isPast || day.isWeekend || day.isHoliday || day.hasLeave) return false;
  return !day.joiningDate || day.dateStr >= day.joiningDate.slice(0, 10);
}
