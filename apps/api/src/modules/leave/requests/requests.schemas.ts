import { MAX_PAGE_SIZE } from '@maxr/shared';
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

const status = z.enum(['applied', 'pending', 'approved', 'rejected', 'cancelled']);

export const leaveRequestIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const applyForLeaveSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    startDate: calendarDate,
    endDate: calendarDate,
    halfDay: z.boolean().default(false),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    message: 'The end date must be on or after the start date',
    path: ['endDate'],
  })
  .refine((v) => !v.halfDay || v.startDate === v.endDate, {
    message: 'A half day is a single date',
    path: ['halfDay'],
  });

const listFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
  status: status.optional(),
  leaveTypeId: z.string().uuid().optional(),
  /** Requests that touch this range (both ends included). */
  from: calendarDate.optional(),
  to: calendarDate.optional(),
};

export const listMyLeaveRequestsQuerySchema = z.object(listFields).strict();

export const listLeaveRequestsQuerySchema = z
  .object({ ...listFields, employeeId: z.string().uuid().optional() })
  .strict();

export const leaveRequestSchema = z
  .object({
    id: z.string().uuid(),
    employeeId: z.string().uuid(),
    employeeName: z.string(),
    leaveTypeId: z.string().uuid(),
    leaveTypeCode: z.string(),
    leaveTypeName: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    halfDay: z.boolean(),
    days: z.number(),
    reason: z.string().nullable(),
    status,
    approvalId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({ id: 'LeaveRequest' });

export type ApplyForLeaveInput = z.infer<typeof applyForLeaveSchema>;
export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsQuerySchema>;
export type ListMyLeaveRequestsQuery = z.infer<typeof listMyLeaveRequestsQuerySchema>;
