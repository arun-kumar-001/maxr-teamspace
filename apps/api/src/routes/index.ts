import { Router } from 'express';
import { getPool } from '../db/client';
import { IdempotencyStore } from '../http/idempotency';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { AuthServices } from '../modules/auth';
import { createAttendanceRouter } from '../modules/attendance';
import { createAttendanceCorrections } from '../modules/attendance/corrections';
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
import { createEmployeeHierarchy } from '../modules/employees/hierarchy';
import { createEmployeeProfile } from '../modules/employees/profile';
import { registerAttendanceReports } from '../modules/attendance/reports/attendance-reports';
import { registerEmployeeReports } from '../modules/employees/reports/employee-reports';
import { registerLeaveReports } from '../modules/leave/reports/leave-reports';
import { registerTaskReports } from '../modules/tasks/reports/task-reports';
import { createAuditLogs } from '../modules/audit-logs';
import { createSettings } from '../modules/settings';
import { createLeaveSetup } from '../modules/leave';
import { createNotifications, loadNotificationsConfig } from '../modules/notifications';
import { createProjects } from '../modules/projects';
import { createTasks } from '../modules/tasks';
import { createShifts } from '../modules/shifts';
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
  const shifts = createShifts({
    platform,
    authenticate: auth.authenticate,
    idempotencyStore,
    settings: settings.reader,
  });
  router.use('/shifts', shifts.shiftsRouter);
  // Before the attendance router, which owns `/attendance/...`.
  router.use('/attendance/policies', shifts.policyRouter);
  const approvals = createApprovals({ platform, authenticate: auth.authenticate });
  // Before the attendance router, which owns `/attendance/...`.
  router.use(
    '/attendance/corrections',
    createAttendanceCorrections({
      platform,
      authenticate: auth.authenticate,
      idempotencyStore,
      approvals: approvals.service,
      settings: settings.reader,
      shiftResolver: shifts.resolver,
    }).router,
  );
  router.use(
    '/attendance',
    createAttendanceRouter({
      authenticate: auth.authenticate,
      audit: platform.audit,
      settingsReader: settings.reader,
      shiftResolver: shifts.resolver,
    }),
  );

  // A registry passed in (tests) is used as given; the default app gets the employee reports.
  const registry = reportRegistry ?? new ReportRegistry();
  if (!reportRegistry) {
    registerEmployeeReports(registry, { getPool, settings: settings.reader });
    const reportDeps = { getPool, settings: settings.reader };
    registerAttendanceReports(registry, reportDeps);
    registerLeaveReports(registry, reportDeps);
    registerTaskReports(registry, reportDeps);
  }
  router.use('/approvals', approvals.router);
  const leave = createLeaveSetup({
    platform,
    approvals: approvals.service,
    authenticate: auth.authenticate,
    idempotencyStore,
    settings: settings.reader,
  });
  router.use('/leave-policies', leave.policiesRouter);
  router.use('/holidays', leave.holidaysRouter);
  router.use('/leave-balances', leave.balancesRouter);
  router.use('/leave-requests', leave.requestsRouter);
  const projects = createProjects({ platform, authenticate: auth.authenticate, idempotencyStore });
  router.use('/projects', projects.router);
  router.use(
    '/tasks',
    createTasks({
      platform,
      authenticate: auth.authenticate,
      idempotencyStore,
      settings: settings.reader,
      projects: projects.reader,
    }).router,
  );
  router.use(
    '/notifications',
    createNotifications({
      platform,
      authenticate: auth.authenticate,
      idempotencyStore,
      appUrl: loadNotificationsConfig().appUrl,
    }).router,
  );
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
      afterCreate: (tx, employee) =>
        leave.initializeBalances(tx, employee.id, employee.joiningDate),
    }).router,
  );
  // Before the detail router: `/employees/me` and `/employees/org-roots` must not be read as ids.
  router.use(
    '/employees',
    createEmployeeProfile({ platform, authenticate: auth.authenticate }).router,
  );
  router.use(
    '/employees',
    createEmployeeHierarchy({ platform, authenticate: auth.authenticate }).router,
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
