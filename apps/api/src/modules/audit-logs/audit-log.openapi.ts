import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import { auditLogItemSchema, auditLogQueryObject } from './audit-log.schemas';

registerRoute({
  method: 'get',
  path: '/audit-logs',
  tags: ['Audit logs'],
  summary:
    'Search the audit trail (Admin; read only). Filters: actor, action or module, entity, outcome, date range',
  permission: 'audit_logs.list',
  query: auditLogQueryObject,
  success: {
    status: 200,
    description: 'A page of audit entries, newest first by default',
    schema: z.object({
      data: z.array(auditLogItemSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});
