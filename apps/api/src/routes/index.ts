import { Router } from 'express';
import { getPool } from '../db/client';
import { IdempotencyStore } from '../http/idempotency';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { AuthServices } from '../modules/auth';
import { createAttendanceRouter } from '../modules/attendance';
import {
  createDepartmentRouter,
  createDesignationRouter,
  createEmployeeDirectoryRouter,
} from '../modules/employees';
import { PdfExporter, ReportRegistry, createReports } from '../modules/reports';
import { publicRoute } from '../modules/rbac';
import { createApprovals } from '../modules/approvals';
import { createEmployeeCreation } from '../modules/employees/creation';
import { createEmployeeDeactivation } from '../modules/employees/deactivation';
import { createEmployeeDetail } from '../modules/employees/detail';
import { registerEmployeeReports } from '../modules/employees/reports/employee-reports';
import { createAuditLogs } from '../modules/audit-logs';
import { createSettings } from '../modules/settings';
import { createUsers } from '../modules/users';
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
  const settings = createSettings({ platform, authenticate: auth.authenticate });
  router.use('/settings', settings.router);
  router.use(
    '/attendance',
    createAttendanceRouter({
      authenticate: auth.authenticate,
      audit: platform.audit,
      settingsReader: settings.reader,
    }),
  );

  // A registry passed in (tests) is used as given; the default app gets the employee reports.
  const registry = reportRegistry ?? new ReportRegistry();
  if (!reportRegistry) {
    registerEmployeeReports(registry, { getPool, settings: settings.reader });
  }
  router.use('/approvals', createApprovals({ platform, authenticate: auth.authenticate }).router);
  const users = createUsers({ platform, authenticate: auth.authenticate });
  router.use('/users', users.usersRouter);
  router.use('/roles', users.rolesRouter);
  router.use('/permissions', users.permissionsRouter);
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
    '/employees',
    createEmployeeDirectoryRouter({
      authenticate: auth.authenticate,
    }),
  );
  router.use(
    '/employees',
    createEmployeeCreation({
      platform,
      authenticate: auth.authenticate,
      idempotencyStore,
    }).router,
  );
  router.use(
    '/employees',
    createEmployeeDetail({ platform, authenticate: auth.authenticate }).router,
  );
  router.use(
    '/employees',
    createEmployeeDeactivation({
      platform,
      authenticate: auth.authenticate,
      sessions: auth.sessions,
    }).router,
  );
  router.use(
    '/reports',
    createReports({
      audit: platform.audit,
      authenticate: auth.authenticate,
      registry,
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
