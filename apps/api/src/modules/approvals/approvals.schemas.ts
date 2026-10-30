import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const approvalIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

/** Query for `GET /approvals`. Unknown keys are rejected so a typo cannot silently widen the result. */
export const approvalQueryObject = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    subjectType: z
      .string()
      .max(50)
      .regex(/^[a-z][a-z_]*$/)
      .optional(),
    awaitingMyDecision: booleanQuery.optional(),
  })
  .strict();

const comment = z.string().trim().min(1).max(500);

export const approveBodySchema = z.object({ comment: comment.optional() }).strict();

/** A rejection always says why (D-12). */
export const rejectBodySchema = z.object({ comment }).strict();

const decisionSchema = z.object({
  stage: z.number().int(),
  decidedByEmployeeId: z.string().uuid(),
  outcome: z.enum(['approved', 'rejected']),
  comment: z.string().nullable(),
  decidedAt: z.string().datetime(),
});

export const approvalSchema = z
  .object({
    id: z.string().uuid(),
    subjectType: z.string(),
    subjectId: z.string().uuid(),
    requesterEmployeeId: z.string().uuid(),
    requesterName: z.string(),
    stages: z.array(z.enum(['manager', 'hr'])),
    currentStage: z.number().int(),
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
    decisions: z.array(decisionSchema),
    createdAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable(),
  })
  .meta({ id: 'Approval' });
