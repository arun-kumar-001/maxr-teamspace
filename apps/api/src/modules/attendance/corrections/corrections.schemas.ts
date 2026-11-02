import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

/** An instant with an explicit offset or `Z`; a bare local time is refused because it is ambiguous. */
const instant = z.string().datetime({ offset: true });

export const requestCorrectionSchema = z
  .object({
    attendanceRecordId: z.string().uuid(),
    requestedCheckIn: instant,
    requestedCheckOut: instant,
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const correctionIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const listCorrectionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  })
  .strict();

export const correctionSchema = z
  .object({
    id: z.string().uuid(),
    attendanceRecordId: z.string().uuid(),
    employeeId: z.string().uuid(),
    workDate: z.string(),
    originalCheckIn: z.string().datetime(),
    originalCheckOut: z.string().datetime().nullable(),
    requestedCheckIn: z.string().datetime(),
    requestedCheckOut: z.string().datetime(),
    reason: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    approvalId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'AttendanceCorrection' });

export type RequestCorrectionInput = z.infer<typeof requestCorrectionSchema>;
export type ListCorrectionsQuery = z.infer<typeof listCorrectionsQuerySchema>;
