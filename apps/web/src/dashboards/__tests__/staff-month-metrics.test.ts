import { describe, expect, it } from 'vitest';
import { computeMonthMetrics } from '../staff-month-metrics';

const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

describe('computeMonthMetrics', () => {
  // 2026-11-02 is a Monday. Up to Friday the 6th that is 5 working days.
  const base = { today: '2026-11-06', workDays: week, holidays: [] as string[] };

  it('counts present and leave days against the working days so far', () => {
    const result = computeMonthMetrics({
      ...base,
      attendedDates: new Set(['2026-11-02', '2026-11-03', '2026-11-05']),
      approvedLeaves: [{ startDate: '2026-11-04', endDate: '2026-11-04' }],
    });
    expect(result).toEqual({
      workingDays: 5,
      presentDays: 3,
      leaveDays: 1,
      attendancePct: 60,
      leavePct: 20,
    });
  });

  it('skips weekends and holidays, and a punch on a weekend does not count', () => {
    const result = computeMonthMetrics({
      today: '2026-11-09',
      workDays: week,
      holidays: ['2026-11-04'],
      attendedDates: new Set(['2026-11-07', '2026-11-09']),
      approvedLeaves: [],
    });
    // Working days: 2, 3, 5, 6 and 9 (the 4th is a holiday; 7 and 8 are the weekend).
    expect(result.workingDays).toBe(5);
    expect(result.presentDays).toBe(1);
  });

  it('counts a day of approved leave as leave, not present, even with a punch', () => {
    const result = computeMonthMetrics({
      ...base,
      attendedDates: new Set(['2026-11-03']),
      approvedLeaves: [{ startDate: '2026-11-03', endDate: '2026-11-03' }],
    });
    expect(result.presentDays).toBe(0);
    expect(result.leaveDays).toBe(1);
  });

  it('has no percentages before the month has a working day', () => {
    const result = computeMonthMetrics({
      today: '2026-11-01',
      workDays: week,
      holidays: [],
      attendedDates: new Set(),
      approvedLeaves: [],
    });
    expect(result).toMatchObject({ workingDays: 0, attendancePct: null, leavePct: null });
  });
});
