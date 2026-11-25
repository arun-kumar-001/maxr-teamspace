import { describe, expect, it } from 'vitest';
import { plannedFor, varianceHours } from '../lib/timesheet-plan';

// Monday 2 to Sunday 8 November 2026.
const weekDates = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
];
const base = {
  weekDates,
  workWeek: [1, 2, 3, 4, 5],
  holidays: new Set<string>(),
  leaveDates: new Set<string>(),
  fullDayMinutes: 480,
};

describe('plannedFor', () => {
  it('is the whole work week once the week is over', () => {
    expect(plannedFor({ ...base, today: '2026-11-20' })).toEqual({
      plannedDays: 5,
      plannedHours: 40,
    });
  });

  it('counts only the days so far this week', () => {
    expect(plannedFor({ ...base, today: '2026-11-04' })).toEqual({
      plannedDays: 3,
      plannedHours: 24,
    });
  });

  it('leaves out holidays and approved leave days', () => {
    expect(
      plannedFor({
        ...base,
        today: '2026-11-20',
        holidays: new Set(['2026-11-04']),
        leaveDates: new Set(['2026-11-06']),
      }),
    ).toEqual({ plannedDays: 3, plannedHours: 24 });
  });

  it('follows the company work week and the full-day minutes', () => {
    expect(
      plannedFor({
        ...base,
        today: '2026-11-20',
        workWeek: [1, 2, 3, 4, 5, 6],
        fullDayMinutes: 450,
      }),
    ).toEqual({ plannedDays: 6, plannedHours: 45 });
  });
});

describe('varianceHours', () => {
  it('is positive for overtime and negative for a shortfall', () => {
    expect(varianceHours(42.5, 40)).toBe(2.5);
    expect(varianceHours(30, 40)).toBe(-10);
    expect(varianceHours(40, 40)).toBe(0);
  });
});
