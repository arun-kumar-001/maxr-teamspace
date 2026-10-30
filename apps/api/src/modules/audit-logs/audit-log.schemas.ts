import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

const identifier = /^[a-z][a-z0-9_]*$/;
const dated = z.string().datetime({ offset: true });

/** Query for `GET /audit-logs`. Unknown keys are rejected so a typo cannot silently widen the result. */
export const auditLogQueryObject = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
    actorId: z.string().uuid().optional(),
    action: z
      .string()
      .max(100)
      .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'Use module.verb, for example leave.approve')
      .optional(),
    module: z.string().max(64).regex(identifier).optional(),
    entityType: z.string().max(64).regex(identifier).optional(),
    entityId: z.string().min(1).max(128).optional(),
    outcome: z.enum(['success', 'denied', 'failure']).optional(),
    from: dated.optional(),
    to: dated.optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export const auditLogQuerySchema = auditLogQueryObject
  .refine((q) => !(q.action && q.module), { message: 'Use either action or module, not both' })
  .refine((q) => !(q.from && q.to) || new Date(q.from) < new Date(q.to), {
    message: 'from must be earlier than to',
  });

const actorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  role: z.string().nullable(),
});

export const auditLogItemSchema = z
  .object({
    id: z.string().uuid(),
    occurredAt: z.string().datetime(),
    action: z.string(),
    outcome: z.enum(['success', 'denied', 'failure']),
    actor: actorSchema.nullable(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    requestId: z.string().nullable(),
    changes: z.record(z.string(), z.unknown()).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
  })
  .meta({ id: 'AuditLogEntry' });
