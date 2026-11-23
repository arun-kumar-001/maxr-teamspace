import { z } from 'zod';

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a real calendar date')
  .refine(
    (value) => value >= '2000-01-01' && value <= '2100-12-31',
    'Use a year from 2000 to 2100',
  );

export const holidayIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createHolidaySchema = z
  .object({ date: calendarDate, name: z.string().trim().min(1).max(100) })
  .strict();

export const listHolidaysQuerySchema = z
  .object({ year: z.coerce.number().int().min(2000).max(2100).optional() })
  .strict();

export const holidaySchema = z
  .object({ id: z.string().uuid(), date: z.string(), name: z.string() })
  .meta({ id: 'Holiday' });

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
