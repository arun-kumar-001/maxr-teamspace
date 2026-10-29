import { Router } from 'express';
import { IdempotencyStore } from '../http/idempotency';
import { createAttendanceRouter } from '../modules/attendance/attendance.routes';
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

  // Attendance and time tracking module (Issue #34, D2-02)
  router.use('/attendance', createAttendanceRouter(idempotencyStore, platform));

  if (exposeDevRoutes) {
    router.use('/templates', createTemplateRouter(idempotencyStore, platform));
    router.get('/openapi.json', (_req, res) => {
      res.status(200).json(buildOpenApiDocument());
    });
  }

  return router;
}
