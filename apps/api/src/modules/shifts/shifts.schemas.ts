import { z } from 'zod';

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hour)');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, 'Not a real calendar date');

const code = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/, 'Letters, digits, - and _ (2 to 30 characters)');
const name = z.string().trim().min(1).max(100);
const grace = z.number().int().min(0).max(240);

export const shiftIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const employeeIdParamsSchema = z.object({ employeeId: z.string().uuid() }).strict();

export const createShiftSchema = z
  .object({
    code,
    name,
    startTime: timeOfDay,
    endTime: timeOfDay,
    graceMinutes: grace.default(15),
  })
  .strict()
  .refine((s) => s.startTime !== s.endTime, {
    message: 'A shift cannot start and end at the same time',
    path: ['endTime'],
  });

/** The code never changes; times are re-checked against the stored shift by the service. */
export const updateShiftSchema = z
  .object({
    name: name.optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    graceMinutes: grace.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((s) => Object.keys(s).length > 0, { message: 'Send at least one field to change' });

export const listShiftsQuerySchema = z
  .object({
    isActive: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict();

export const assignShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    shiftId: z.string().uuid(),
    effectiveFrom: isoDate,
    effectiveTo: isoDate.nullable().default(null),
  })
  .strict()
  .refine((a) => a.effectiveTo === null || a.effectiveTo >= a.effectiveFrom, {
    message: 'effectiveTo must not be before effectiveFrom',
    path: ['effectiveTo'],
  });

export const updatePolicySchema = z
  .object({
    fullDayMinutes: z.number().int().min(2).max(1440).optional(),
    halfDayMinutes: z.number().int().min(1).max(1439).optional(),
    defaultShiftId: z.string().uuid().optional(),
  })
  .strict()
  .refine((p) => Object.keys(p).length > 0, { message: 'Send at least one field to change' });

export const shiftSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    graceMinutes: z.number().int(),
    crossesMidnight: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'Shift' });

const shiftSummary = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  graceMinutes: z.number().int(),
  crossesMidnight: z.boolean(),
});

export const shiftAssignmentSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    shift: shiftSummary,
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'ShiftAssignment' });

export const attendancePolicySchema = z
  .object({
    fullDayMinutes: z.number().int(),
    halfDayMinutes: z.number().int(),
    defaultShift: shiftSummary,
    timezone: z.string(),
    workWeek: z.object({ start: z.string(), end: z.string(), days: z.array(z.string()) }),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'AttendancePolicy' });
