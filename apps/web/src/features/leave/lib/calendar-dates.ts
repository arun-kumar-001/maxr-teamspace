/** Calendar dates are plain YYYY-MM-DD strings, so no time zone can move a leave onto another day. */

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

export function todayIso(now: Date = new Date()): string {
  return isoDate(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Weekday of the 1st, 0 = Sunday. */
export function firstWeekday(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

export interface MonthCell {
  day: number | null;
  iso: string | null;
}

/** The month as full weeks (Sunday first); cells outside the month have no day. */
export function monthCells(year: number, monthIndex: number): MonthCell[] {
  const lead = firstWeekday(year, monthIndex);
  const total = daysInMonth(year, monthIndex);
  const cells: MonthCell[] = [];
  for (let i = 0; i < lead; i += 1) cells.push({ day: null, iso: null });
  for (let day = 1; day <= total; day += 1) {
    cells.push({ day, iso: isoDate(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
  return cells;
}

export function monthRange(year: number, monthIndex: number): { from: string; to: string } {
  return {
    from: isoDate(year, monthIndex, 1),
    to: isoDate(year, monthIndex, daysInMonth(year, monthIndex)),
  };
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const weekday = WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${d} ${MONTH_NAMES[m - 1]?.slice(0, 3)} ${y}`;
}
