import { Router } from 'express';
import { IdempotencyStore } from '../http/idempotency';
import { createApprovalsRouter } from '../modules/approvals/approvals.routes';
import { createAttendanceRouter } from '../modules/attendance/attendance.routes';
import { createShiftsRouter } from '../modules/shifts/shifts.routes';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { AuthServices } from '../modules/auth';
import { ReportRegistry, createReports } from '../modules/reports';
import { publicRoute } from '../modules/rbac';
import { Platform } from '../platform';
import { createFilesRouter } from '../platform/storage/files.routes';
import { buildOpenApiDocument } from '../openapi/build-spec';

export interface ApiRouterOptions {
  idempotencyStore: IdempotencyStore;
  platform: Platform;
  auth: AuthServices;
  /** Report definitions supplied by the modules; empty until a module registers one. */
  reportRegistry?: ReportRegistry;
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
  exposeDevRoutes,
}: ApiRouterOptions): Router {
  const router = Router();

  router.use('/auth', auth.router);
  router.use(
    '/reports',
    createReports({
      audit: platform.audit,
      authenticate: auth.authenticate,
      registry: reportRegistry,
    }).router,
  );

  // File downloads by signed link (see docs/architecture/shared-services.md).
  router.use('/files', createFilesRouter(platform.storage));

  // Attendance and time tracking module (Issue #34, D2-02; Issue #35, D2-03)
  router.use('/attendance', createAttendanceRouter(idempotencyStore, platform, auth.authenticate));

  // Shifts and Attendance Policies (Issue #33, D2-01)
  router.use('/shifts', createShiftsRouter(idempotencyStore, platform, auth.authenticate));

  // Approvals Engine (Issue #37, D2-05)
  router.use('/approvals', createApprovalsRouter(idempotencyStore, platform, auth.authenticate));

  if (exposeDevRoutes) {
    router.use('/templates', createTemplateRouter(idempotencyStore, platform, auth.authenticate));
    router.get('/openapi.json', publicRoute(), (_req, res) => {
      res.status(200).json(buildOpenApiDocument());
    });
  }

  return router;
}
