import { Router } from 'express';
import { IdempotencyStore } from '../http/idempotency';
import { createApprovalsRouter } from '../modules/approvals/approvals.routes';
import { createAttendanceRouter } from '../modules/attendance/attendance.routes';
import { createShiftsRouter } from '../modules/shifts/shifts.routes';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { Platform } from '../platform';
import { createFilesRouter } from '../platform/storage/files.routes';
import { buildOpenApiDocument } from '../openapi/build-spec';

export interface ApiRouterOptions {
  idempotencyStore: IdempotencyStore;
  platform: Platform;
  /** Sample module and OpenAPI document are development aids: never exposed in production. */
  exposeDevRoutes: boolean;
}

/**
 * The single /api/v1 router. Every module is mounted here, so the surface of the API can be
 * read in one place. Authentication and authorization are applied per module router (#7, #8).
 */
export function createApiRouter({
  idempotencyStore,
  platform,
  exposeDevRoutes,
}: ApiRouterOptions): Router {
  const router = Router();

  // File downloads by signed link (see docs/architecture/shared-services.md).
  router.use('/files', createFilesRouter(platform.storage));

  // Attendance and time tracking module (Issue #34, D2-02; Issue #35, D2-03)
  router.use('/attendance', createAttendanceRouter(idempotencyStore, platform));

  // Shifts and Attendance Policies (Issue #33, D2-01)
  router.use('/shifts', createShiftsRouter(idempotencyStore, platform));

  // Approvals Engine (Issue #37, D2-05)
  router.use('/approvals', createApprovalsRouter(idempotencyStore, platform));

  if (exposeDevRoutes) {
    router.use('/templates', createTemplateRouter(idempotencyStore, platform));
    router.get('/openapi.json', (_req, res) => {
      res.status(200).json(buildOpenApiDocument());
    });
  }

  return router;
}
