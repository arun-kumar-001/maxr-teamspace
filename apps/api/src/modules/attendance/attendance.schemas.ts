import { listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const attendanceLocationSchema = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    address: z.string().max(255).optional(),
    workMode: z.enum(['office', 'remote']).optional(),
  })
  .strict();

export const checkInSchema = z
  .object({
    location: attendanceLocationSchema.optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

export const checkOutSchema = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .strict();

export const listAttendanceQuerySchema = listQuerySchema({
  employeeId: z.string().uuid().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  status: z
    .enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'])
    .optional(),
});

export const ATTENDANCE_SORTABLE_FIELDS = {
  workDate: 'workDate',
  checkInTime: 'checkInTime',
  createdAt: 'createdAt',
} as const;

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
