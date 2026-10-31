import { describe, expect, it } from 'vitest';
import { countLeaveDays, weekdayOf } from './leave-days';

const MON_FRI = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SUN_THU = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const count = (
  startDate: string,
  endDate: string,
  extra: Partial<Parameters<typeof countLeaveDays>[0]> = {},
) =>
  countLeaveDays({ startDate, endDate, halfDay: false, workDays: MON_FRI, holidays: [], ...extra });

describe('weekdayOf', () => {
  it('names the weekday of a calendar date, including a leap day', () => {
    expect(weekdayOf('2026-11-02')).toBe('Monday');
    expect(weekdayOf('2026-11-01')).toBe('Sunday');
    expect(weekdayOf('2028-02-29')).toBe('Tuesday');
  });
});

describe('countLeaveDays (D-12: working days only)', () => {
  it.each([
    ['one working day', '2026-11-02', '2026-11-02', 1],
    ['a working week', '2026-11-02', '2026-11-06', 5],
    ['Monday to the next Sunday: the weekend is not counted', '2026-11-02', '2026-11-08', 5],
    ['Friday to Monday spans a weekend', '2026-11-06', '2026-11-09', 2],
    ['a Saturday and Sunday only', '2026-11-07', '2026-11-08', 0],
    ['two full weeks', '2026-11-02', '2026-11-13', 10],
    ['across the end of a month', '2026-10-29', '2026-11-03', 4],
    ['across a leap day', '2028-02-28', '2028-03-01', 3],
  ])('%s', (_name, start, end, expected) => {
    expect(count(start, end)).toBe(expected);
  });

  it('skips holidays, and a holiday on a weekend is not subtracted twice', () => {
    expect(count('2026-11-02', '2026-11-06', { holidays: ['2026-11-04'] })).toBe(4);
    expect(count('2026-11-02', '2026-11-06', { holidays: ['2026-11-04', '2026-11-05'] })).toBe(3);
    expect(count('2026-11-02', '2026-11-08', { holidays: ['2026-11-07', '2026-11-08'] })).toBe(5);
  });

  it('counts the company week, not a fixed Monday to Friday', () => {
    // Sunday 1 Nov to Saturday 7 Nov in a Sunday to Thursday week: Sun, Mon, Tue, Wed, Thu.
    expect(count('2026-11-01', '2026-11-07', { workDays: SUN_THU })).toBe(5);
    expect(count('2026-11-06', '2026-11-07', { workDays: SUN_THU })).toBe(0);
  });

  it('counts a half day as 0.5 on a working day and 0 otherwise', () => {
    expect(count('2026-11-02', '2026-11-02', { halfDay: true })).toBe(0.5);
    expect(count('2026-11-07', '2026-11-07', { halfDay: true })).toBe(0);
    expect(count('2026-11-04', '2026-11-04', { halfDay: true, holidays: ['2026-11-04'] })).toBe(0);
  });

  it('does not depend on the machine timezone around midnight', () => {
    const original = process.env.TZ;
    for (const tz of ['Pacific/Kiritimati', 'America/Los_Angeles', 'UTC']) {
      process.env.TZ = tz;
      expect(count('2026-11-02', '2026-11-06')).toBe(5);
      expect(weekdayOf('2026-11-02')).toBe('Monday');
    }
    process.env.TZ = original;
  });
});
