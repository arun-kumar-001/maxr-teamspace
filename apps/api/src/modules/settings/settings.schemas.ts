import { z } from 'zod';
import { DAY_NAMES } from './settings.types';

/**
 * IANA names only: `UTC` or `Area/City` such as `Asia/Kolkata`. Abbreviations like `IST` are
 * ambiguous (India, Israel, Ireland) even though the runtime accepts them. The runtime's tz
 * database decides whether the name exists.
 */
export function isValidTimeZone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){1,2}$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const dayName = z.enum(DAY_NAMES);

export const timezoneSchema = z
  .string()
  .trim()
  .max(100)
  .refine(isValidTimeZone, { message: 'Must be an IANA timezone such as Asia/Kolkata' });

export const updateSettingsSchema = z
  .object({
    companyName: z.string().trim().min(1).max(255).optional(),
    timezone: timezoneSchema.optional(),
    workWeek: z
      .object({ start: dayName, end: dayName })
      .strict()
      .refine((week) => week.start !== week.end, {
        message: 'A work week needs a start day that differs from its end day',
      })
      .optional(),
    integrations: z
      .object({
        email: z.boolean(),
        sms: z.boolean(),
        calendarSync: z.boolean(),
        payrollExport: z.boolean(),
      })
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, {
        message: 'At least one toggle is required',
      })
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const workWeekSchema = z
  .object({ start: dayName, end: dayName, days: z.array(dayName) })
  .meta({ id: 'WorkWeek' });

export const basicSettingsSchema = z
  .object({ companyName: z.string(), timezone: z.string(), workWeek: workWeekSchema })
  .meta({ id: 'BasicSettings' });

export const companySettingsSchema = basicSettingsSchema
  .extend({
    integrations: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      calendarSync: z.boolean(),
      payrollExport: z.boolean(),
    }),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'CompanySettings' });
