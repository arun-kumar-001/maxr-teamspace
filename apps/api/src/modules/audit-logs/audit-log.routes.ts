import { RequestHandler, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate, validated } from '../../http/validate';
import { requirePermission } from '../rbac';
import { auditLogQuerySchema } from './audit-log.schemas';
import { AuditLogService } from './audit-log.service';

/** Mounted at /api/v1/audit-logs. Read only: there is no route that writes. */
export function createAuditLogRouter(
  service: AuditLogService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('audit_logs.list'),
    validate({ query: auditLogQuerySchema }),
    asyncHandler(async (req, res) => {
      const { query } = validated(req, { query: auditLogQuerySchema });
      res.status(200).json(await service.list(query));
    }),
  );

  return router;
}
