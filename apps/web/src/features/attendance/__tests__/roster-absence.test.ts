import { describe, expect, it } from 'vitest';
import { isAbsentDay } from '../lib/roster-absence';

const workday = {
  dateStr: '2026-11-10',
  isPast: true,
  isWeekend: false,
  isHoliday: false,
  hasLeave: false,
  joiningDate: '2026-01-05',
};

describe('isAbsentDay', () => {
  it('is absent on a past working day with nothing recorded', () => {
    expect(isAbsentDay(workday)).toBe(true);
  });

  it.each([
    ['today or the future', { isPast: false }],
    ['a weekly off', { isWeekend: true }],
    ['a company holiday', { isHoliday: true }],
    ['a day with leave applied for', { hasLeave: true }],
    ['a day before the employee joined', { joiningDate: '2026-11-11' }],
  ])('is not absent on %s', (_name, change) => {
    expect(isAbsentDay({ ...workday, ...change })).toBe(false);
  });

  it('is absent from the joining day itself', () => {
    expect(isAbsentDay({ ...workday, joiningDate: '2026-11-10' })).toBe(true);
  });
});
