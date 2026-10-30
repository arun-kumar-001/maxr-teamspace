import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { InMemoryAttendanceRepository } from './attendance.repository.memory';
import { createAttendanceRouter } from './attendance.routes';
import { AttendanceService } from './attendance.service';

/**
 * Access and RBAC verification for Attendance module (Issue #34, D-13, docs/architecture/rbac.md).
 * Staff reports to Team Lead. Admin and HR Manager are outside that team.
 */
async function setup() {
  const { platform } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const kit = createTestAuth(platform.audit);
  const { users } = kit;

  // Manager mapping: Staff reports to Team Lead, everyone else has no manager.
  const managerOf = (employeeId: string) =>
    employeeId === users.staff.employeeId ? users.team_lead.employeeId : null;
  const repo = new InMemoryAttendanceRepository(managerOf);
  const service = new AttendanceService(repo, platform.audit);

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/attendance',
    createAttendanceRouter({
      authenticate: kit.auth.authenticate,
      audit: platform.audit,
      repository: repo,
      service,
    }),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) {
    as[role] = await signInAs(app, kit, role);
  }

  // Seed attendance for each role's employee
  const today = new Date().toISOString().slice(0, 10);
  for (const role of ALL_ROLES) {
    await repo.createCheckIn(
      users[role].employeeId,
      today,
      { notes: `seed for ${role}` },
      new Date().toISOString(),
    );
  }

  return { app, as, kit, repo };
}

describe('attendance module access & RBAC (Issue #34)', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/attendance'],
      ['get', '/api/v1/attendance/active'],
      ['get', '/api/v1/attendance/today'],
      ['get', '/api/v1/attendance/me'],
      ['post', '/api/v1/attendance/check-in'],
      ['post', '/api/v1/attendance/check-out'],
    ] as const) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ] as Array<[Role, number]>)(
    '%s reading active session gets %i (attendance.read_own)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/attendance/active');
      expect(res.status).toBe(status);
      expect(res.body.data).toBeDefined();
    },
  );

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ] as Array<[Role, number]>)(
    '%s reading today summary gets %i (attendance.read_own)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/attendance/today');
      expect(res.status).toBe(status);
      expect(res.body.data.sessionsCount).toBe(1);
    },
  );

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ] as Array<[Role, number]>)(
    '%s reading own history gets %i (attendance.read_own)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/attendance/me');
      expect(res.status).toBe(status);
      expect(res.body.data).toHaveLength(1);
    },
  );

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ] as Array<[Role, number]>)(
    '%s checking out gets %i (attendance.check_out)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].post('/api/v1/attendance/check-out').send({ notes: 'done' });
      expect(res.status).toBe(status);
      expect(res.body.data.checkOutTime).not.toBeNull();
    },
  );

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 403],
  ] as Array<[Role, number]>)(
    '%s listing others gets %i (attendance.list)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/attendance');
      expect(res.status).toBe(status);
    },
  );

  it('enforces scope on GET /attendance: team lead sees only direct reports', async () => {
    const { as, kit } = await setup();
    const res = await as.team_lead.get('/api/v1/attendance');
    expect(res.status).toBe(200);
    // Team lead sees direct report (staff), not admin or hr or self
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].employeeId).toBe(kit.users.staff.employeeId);
  });

  it('admin and hr_manager see all records on GET /attendance', async () => {
    const { as } = await setup();
    const adminRes = await as.admin.get('/api/v1/attendance');
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(4);

    const hrRes = await as.hr_manager.get('/api/v1/attendance');
    expect(hrRes.status).toBe(200);
    expect(hrRes.body.data).toHaveLength(4);
  });

  it('prevents IDOR: team lead cannot query attendance of employee outside their team', async () => {
    const { as, kit } = await setup();
    const res = await as.team_lead.get(
      `/api/v1/attendance?employeeId=${kit.users.admin.employeeId}`,
    );
    expect(res.status).toBe(200);
    // Out of scope query returns empty list without error or leaking records
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });
});
