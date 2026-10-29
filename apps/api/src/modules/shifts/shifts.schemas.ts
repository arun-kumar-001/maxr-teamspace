import { listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const shiftSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
  breakMinutes: z.number().int().min(0).max(480).default(60),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const createShiftSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    code: z.string().trim().min(1).max(50),
    startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
    endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:MM or HH:MM:SS'),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateShiftSchema = createShiftSchema.partial();

export const listShiftsQuerySchema = listQuerySchema({
  isActive: z.enum(['true', 'false']).optional(),
});

export const attendancePolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  gracePeriodMinutes: z.number().int().min(0).max(120),
  halfDayThresholdMinutes: z.number().int().min(60).max(720),
  fullDayThresholdMinutes: z.number().int().min(120).max(1440),
  timezone: z.string().trim().min(1).max(50),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateAttendancePolicySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    gracePeriodMinutes: z.number().int().min(0).max(120).optional(),
    halfDayThresholdMinutes: z.number().int().min(60).max(720).optional(),
    fullDayThresholdMinutes: z.number().int().min(120).max(1440).optional(),
    timezone: z.string().trim().min(1).max(50).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const assignEmployeeShiftSchema = z
  .object({
    employeeId: z.string().uuid(),
    shiftId: z.string().uuid(),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    effectiveTo: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional(),
  })
  .strict();

export const employeeShiftSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SORTABLE_SHIFT_FIELDS = {
  name: 'name',
  code: 'code',
  startTime: 'startTime',
  createdAt: 'createdAt',
} as const;
