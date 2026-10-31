import { z } from 'zod';
import { validationError } from '../../http/errors';
import type { DayName } from '../settings';

/** A real calendar date, `YYYY-MM-DD`. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Not a real calendar date');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A date range must run forwards and span fewer than `maxDays` days. Checked inside `run`
 * because the framework reuses a filter object's `shape`, which would drop a refinement.
 */
export function assertRange(from: string, to: string, maxDays: number): void {
  const days =
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS;
  if (days < 0) {
    throw validationError([{ field: 'from', message: 'from must not be after to', rule: 'range' }]);
  }
  if (days >= maxDays) {
    throw validationError([
      { field: 'to', message: `Use a range of at most ${maxDays} days`, rule: 'range' },
    ]);
  }
}

const DAY_NUMBERS: Record<DayName, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/** PostgreSQL day-of-week numbers (`EXTRACT(DOW ...)`, Sunday = 0) of the company's working days. */
export const workDayNumbers = (days: readonly DayName[]): number[] =>
  days.map((day) => DAY_NUMBERS[day]);

/** The company's calendar date for an instant, `YYYY-MM-DD`. */
export const companyDate = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
