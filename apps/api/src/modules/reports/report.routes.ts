import { RequestHandler, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../http/async-handler';
import { validate, validated } from '../../http/validate';
import { contentDisposition } from '../../platform/storage/filename';
import { requirePermission } from '../rbac';
import { REPORT_NAME } from './report-definition';
import { ReportContext, ReportService } from './report.service';

export const reportNameParam = z.object({ name: z.string().regex(REPORT_NAME).max(64) }).strict();

function contextOf(req: Parameters<RequestHandler>[0]): ReportContext {
  const { actor } = req;
  if (!actor) {
    throw new Error('authenticate() did not run before this handler');
  }
  return {
    actor: { id: actor.id, employeeId: actor.employeeId, roles: actor.roles },
    requestId: req.id,
  };
}

/** Mounted at /api/v1/reports. Query filters are validated per report by the service. */
export function createReportsRouter(service: ReportService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('reports.read'),
    asyncHandler(async (req, res) => {
      res.status(200).json({ data: service.list(contextOf(req).actor) });
    }),
  );

  router.get(
    '/:name',
    requirePermission('reports.read'),
    validate({ params: reportNameParam }),
    asyncHandler(async (req, res) => {
      const { params } = validated(req, { params: reportNameParam });
      res.status(200).json(await service.preview(params.name, req.query, contextOf(req)));
    }),
  );

  router.get(
    '/:name/export',
    requirePermission('reports.export'),
    validate({ params: reportNameParam }),
    asyncHandler(async (req, res) => {
      const { params } = validated(req, { params: reportNameParam });
      const file = await service.export(params.name, req.query, contextOf(req));
      res.status(200);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', contentDisposition(file.filename));
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(file.body);
    }),
  );

  return router;
}
