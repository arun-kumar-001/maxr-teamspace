import { listQuerySchema } from '@maxr/shared';
import { z } from 'zod';

export const approvalStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const approvalSubjectTypeSchema = z.enum(['LEAVE', 'ATTENDANCE_CORRECTION', 'EXPENSE']);

export const approvalSchema = z.object({
  id: z.string().uuid(),
  subjectType: approvalSubjectTypeSchema,
  subjectId: z.string().uuid(),
  requesterId: z.string().uuid(),
  approverId: z.string().uuid().nullable(),
  status: approvalStatusSchema,
  comment: z.string().nullable().optional(),
  decidedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const decisionSchema = z
  .object({
    comment: z.string().trim().max(500).optional(),
  })
  .strict();

export const createApprovalSchema = z
  .object({
    subjectType: approvalSubjectTypeSchema,
    subjectId: z.string().uuid(),
    requesterId: z.string().uuid(),
  })
  .strict();

export const listApprovalsQuerySchema = listQuerySchema({
  status: approvalStatusSchema.optional(),
  subjectType: approvalSubjectTypeSchema.optional(),
});

export const SORTABLE_APPROVAL_FIELDS = {
  createdAt: 'createdAt',
  decidedAt: 'decidedAt',
  status: 'status',
} as const;
