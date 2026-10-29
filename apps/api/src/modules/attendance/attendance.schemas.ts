import { listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const attendanceStatusSchema = z.enum([
  'PRESENT',
  'LATE',
  'HALF_DAY',
  'EARLY_DEPARTURE',
  'ON_LEAVE',
]);

export const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().trim().max(255).optional(),
  })
  .strict();

export const attendanceRecordSchema = z.object({
  id: z.string().uuid(),
  employeeId: z.string().uuid(),
  workDate: z.string(), // YYYY-MM-DD
  checkInTime: z.string().datetime(),
  checkOutTime: z.string().datetime().nullable(),
  durationMinutes: z.number().int().nonnegative().nullable(),
  status: attendanceStatusSchema,
  location: locationSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const checkInSchema = z
  .object({
    location: locationSchema.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const checkOutSchema = z
  .object({
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const listAttendanceQuerySchema = listQuerySchema({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .optional(),
  status: attendanceStatusSchema.optional(),
});

export const SORTABLE_ATTENDANCE_FIELDS = {
  checkInTime: 'checkInTime',
  workDate: 'workDate',
  createdAt: 'createdAt',
} as const;
