import { z } from 'zod';
import { DAY_NAMES, DEDUCTION_TYPES, PERMISSION_APPROVAL_FLOWS } from './settings.types';

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

/** Same rules as the database CHECK: a small raster image, never SVG (it can carry script). */
export const MAX_LOGO_LENGTH = 300_000;
export const logoSchema = z
  .string()
  .max(MAX_LOGO_LENGTH, { message: 'The logo is too large (about 200 KB at most)' })
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, {
    message: 'The logo must be a PNG, JPEG or WebP image',
  });

export const lateDeductionPolicySchema = z
  .object({
    enabled: z.boolean(),
    graceMinutes: z.number().int().min(0).max(240),
    deductionType: z.enum(DEDUCTION_TYPES),
    deductionAmount: z.number().min(0).max(1_000_000),
    freeLateLimitCount: z.number().int().min(0).max(31),
    halfDayCutoffMinutes: z.number().int().min(0).max(720),
  })
  .strict()
  .meta({ id: 'LateDeductionPolicy' });

export const permissionPolicySchema = z
  .object({
    enabled: z.boolean(),
    maxPermissionsPerMonth: z.number().int().min(0).max(31),
    maxHoursPerPermission: z.number().min(0).max(12),
    totalMonthlyPermissionHours: z.number().min(0).max(200).optional(),
    advanceNoticeHours: z.number().min(0).max(168).optional(),
    requiresCompensation: z.boolean().optional(),
    approvalFlow: z.enum(PERMISSION_APPROVAL_FLOWS).optional(),
    allowLateArrival: z.boolean().optional(),
    allowEarlyDeparture: z.boolean().optional(),
  })
  .strict()
  .meta({ id: 'PermissionPolicy' });

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
    companyLogo: logoSchema.nullable().optional(),
    lateDeductionPolicy: lateDeductionPolicySchema.optional(),
    permissionPolicy: permissionPolicySchema.optional(),
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
    companyLogo: z.string().nullable(),
    lateDeductionPolicy: lateDeductionPolicySchema.nullable(),
    permissionPolicy: permissionPolicySchema.nullable(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'CompanySettings' });

export const companyLogoSchema = z
  .object({ companyLogo: z.string().nullable() })
  .meta({ id: 'CompanyLogo' });
