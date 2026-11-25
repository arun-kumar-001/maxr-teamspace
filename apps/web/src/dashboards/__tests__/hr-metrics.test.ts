import { describe, expect, it } from 'vitest';
import { departmentBreakdown, joinedThisMonth, presentOn, weekTrend } from '../hr-metrics';

const record = (employeeId: string, workDate: string, checkInTime: string | null = '09:00') => ({
  employeeId,
  workDate,
  checkInTime,
});

describe('hr-metrics', () => {
  it('counts the people who joined this month', () => {
    const employees = [
      { id: 'a', joiningDate: '2026-11-03', departmentName: 'Eng' },
      { id: 'b', joiningDate: '2026-10-30', departmentName: 'Eng' },
      { id: 'c', joiningDate: '2026-11-24', departmentName: 'HR' },
    ];
    expect(joinedThisMonth(employees, '2026-11-25')).toBe(2);
  });

  it('counts each person once per day, and only with a check-in', () => {
    const records = [
      record('a', '2026-11-25'),
      record('a', '2026-11-25'),
      record('b', '2026-11-25', null),
      record('c', '2026-11-24'),
    ];
    expect([...presentOn(records, '2026-11-25')]).toEqual(['a']);
  });

  it('builds the week from Monday to today with the share of the headcount', () => {
    // 25 November 2026 is a Wednesday.
    const trend = weekTrend(
      [record('a', '2026-11-23'), record('b', '2026-11-23'), record('a', '2026-11-25')],
      4,
      '2026-11-25',
    );
    expect(trend.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed']);
    expect(trend.map((d) => d.present)).toEqual([2, 0, 1]);
    expect(trend.map((d) => d.rate)).toEqual([50, 0, 25]);
  });

  it('has no rate when there is no headcount', () => {
    expect(weekTrend([], 0, '2026-11-23')[0]?.rate).toBeNull();
  });

  it('lists departments by size with who is in today', () => {
    const employees = [
      { id: 'a', joiningDate: '2026-01-01', departmentName: 'Eng' },
      { id: 'b', joiningDate: '2026-01-01', departmentName: 'Eng' },
      { id: 'c', joiningDate: '2026-01-01', departmentName: 'HR' },
      { id: 'd', joiningDate: '2026-01-01', departmentName: 'Eng' },
    ];
    expect(departmentBreakdown(employees, new Set(['a', 'c']))).toEqual([
      { name: 'Eng', headcount: 3, share: 75, presentToday: 1 },
      { name: 'HR', headcount: 1, share: 25, presentToday: 1 },
    ]);
  });
});
