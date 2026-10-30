import { Router } from 'express';
import { IdempotencyStore } from '../http/idempotency';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { AuthServices } from '../modules/auth';
import { createDepartmentRouter, createDesignationRouter } from '../modules/employees';
import { PdfExporter, ReportRegistry, createReports } from '../modules/reports';
import { publicRoute } from '../modules/rbac';
import { createAuditLogs } from '../modules/audit-logs';
import { createSettings } from '../modules/settings';
import { Platform } from '../platform';
import { createFilesRouter } from '../platform/storage/files.routes';
import { buildOpenApiDocument } from '../openapi/build-spec';

export interface ApiRouterOptions {
  idempotencyStore: IdempotencyStore;
  platform: Platform;
  auth: AuthServices;
  /** Report definitions supplied by the modules; empty until a module registers one. */
  reportRegistry?: ReportRegistry;
  /** Replaces the PDF renderer (tests). */
  reportPdfExporter?: PdfExporter;
  /** Sample module and OpenAPI document are development aids: never exposed in production. */
  exposeDevRoutes: boolean;
}

/**
 * The single /api/v1 router. Every module is mounted here, so the surface of the API can be
 * read in one place. Authentication (`auth.authenticate`) and authorization (`requirePermission`) are applied per route;
 * a test lists every route and fails when one declares neither a permission nor an explicit public/authenticated marker.
 */
export function createApiRouter({
  idempotencyStore,
  platform,
  auth,
  reportRegistry,
  reportPdfExporter,
  exposeDevRoutes,
}: ApiRouterOptions): Router {
  const router = Router();

  router.use('/auth', auth.router);
  router.use('/audit-logs', createAuditLogs({ authenticate: auth.authenticate }).router);
  router.use('/settings', createSettings({ platform, authenticate: auth.authenticate }).router);
  router.use(
    '/departments',
    createDepartmentRouter({
      idempotencyStore,
      platform,
      authenticate: auth.authenticate,
    }),
  );
  router.use(
    '/designations',
    createDesignationRouter({
      idempotencyStore,
      platform,
      authenticate: auth.authenticate,
    }),
  );
  router.use(
    '/reports',
    createReports({
      audit: platform.audit,
      authenticate: auth.authenticate,
      registry: reportRegistry,
      pdfExporter: reportPdfExporter,
    }).router,
  );

  // File downloads by signed link (see docs/architecture/shared-services.md).
  router.use('/files', createFilesRouter(platform.storage));

  if (exposeDevRoutes) {
    router.use('/templates', createTemplateRouter(idempotencyStore, platform, auth.authenticate));
    router.get('/openapi.json', publicRoute(), (_req, res) => {
      res.status(200).json(buildOpenApiDocument());
    });
  }

  return router;
}
