import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK_DAYS, countLeaveDays } from '../lib/leave-days';

const base = { halfDay: false, workDays: DEFAULT_WORK_DAYS, holidays: [] as string[] };

describe('countLeaveDays (same rules as the API)', () => {
  it('counts only the company working days, and skips holidays', () => {
    // 2 to 8 November 2026 is Monday to Sunday; the 4th is a holiday.
    expect(
      countLeaveDays({
        ...base,
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        holidays: ['2026-11-04'],
      }),
    ).toEqual({ days: 4, excluded: 3 });
  });

  it('follows a company week that includes Saturday', () => {
    const sixDays = [...DEFAULT_WORK_DAYS, 'Saturday'];
    expect(
      countLeaveDays({
        ...base,
        workDays: sixDays,
        startDate: '2026-11-02',
        endDate: '2026-11-08',
      }),
    ).toEqual({ days: 6, excluded: 1 });
  });

  it('counts a half day as 0.5, and as 0 on a day that is not a working day', () => {
    expect(
      countLeaveDays({ ...base, halfDay: true, startDate: '2026-11-03', endDate: '2026-11-03' })
        .days,
    ).toBe(0.5);
    expect(
      countLeaveDays({ ...base, halfDay: true, startDate: '2026-11-07', endDate: '2026-11-07' })
        .days,
    ).toBe(0);
  });
});
