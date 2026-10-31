import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { makeApp } from '../../../test/helpers';
import { createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, listRoutes, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeDetail } from '../detail';
import { MemoryEmployeeDetailRepository } from '../detail/detail.repository.memory';
import { EmployeeDetail } from '../detail/detail.types';
import { createEmployeeProfile } from './index';

const DEPT = '92000000-0000-4000-8000-000000000001';
const DESIG = '93000000-0000-4000-8000-000000000001';

const person = (id: string, role: Role): EmployeeDetail => ({
  id,
  employeeCode: `E-${role}`,
  firstName: role,
  lastName: 'Tester',
  email: `${role}@x.test`,
  phone: '+91 90000 00000',
  department: { id: DEPT, name: 'Engineering', code: 'ENG' },
  designation: { id: DESIG, title: 'Engineer', code: 'ENG-1' },
  manager: null,
  status: 'active',
  joiningDate: '2026-01-15',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  version: 1,
  account: { userId: `u-${role}`, isActive: true, lastLoginAt: null, roles: [role] },
});

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryEmployeeDetailRepository(
    ALL_ROLES.map((role) => ({
      detail: person(kit.users[role].employeeId, role),
      // Every non-lead reports to the team lead, as in a real team.
      managerId: role === 'team_lead' ? null : kit.users.team_lead.employeeId,
    })),
  );
  repo.references.designation = { isActive: true, departmentId: DEPT };
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  // Same order as the composition root: profile first, then the detail router (`/:id`).
  app.use(
    '/api/v1/employees',
    createEmployeeProfile({ platform, authenticate: kit.auth.authenticate, repository: repo })
      .router,
  );
  app.use(
    '/api/v1/employees',
    createEmployeeDetail({ platform, authenticate: kit.auth.authenticate, repository: repo })
      .router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo, auditStore, kit };
}

const stored = (s: Awaited<ReturnType<typeof setup>>, role: Role) =>
  s.repo.employees.find((e) => e.detail.id === s.kit.users[role].employeeId)!.detail;

describe('GET /employees/me', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/employees/me')).status).toBe(401);
  });

  it.each(ALL_ROLES)('%s reads their own profile', async (role) => {
    const s = await setup();
    const res = await s.as[role].get('/api/v1/employees/me');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ employeeCode: `E-${role}`, email: `${role}@x.test` });
  });

  it('works for a Team Lead, whose own record is outside their employees.read team scope', async () => {
    const s = await setup();
    const id = s.kit.users.team_lead.employeeId;
    expect((await s.as.team_lead.get('/api/v1/employees/me')).status).toBe(200);
    // The same record through the id route is outside a Team Lead's scope.
    expect((await s.as.team_lead.get(`/api/v1/employees/${id}`)).status).toBe(404);
  });

  it('is not read as an employee id by the detail router that follows', async () => {
    const s = await setup();
    expect((await s.as.staff.get('/api/v1/employees/me')).status).toBe(200);
  });

  it('shows login information to Admin and HR only', async () => {
    const s = await setup();
    expect((await s.as.admin.get('/api/v1/employees/me')).body.data.account).toBeDefined();
    expect((await s.as.hr_manager.get('/api/v1/employees/me')).body.data.account).toBeDefined();
    expect((await s.as.staff.get('/api/v1/employees/me')).body.data.account).toBeUndefined();
    expect((await s.as.team_lead.get('/api/v1/employees/me')).body.data.account).toBeUndefined();
  });
});

describe('PUT /employees/me', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect(
      (await request(app).put('/api/v1/employees/me').send({ version: 1, phone: null })).status,
    ).toBe(401);
  });

  it.each(ALL_ROLES)('%s changes their own phone, and only theirs', async (role) => {
    const s = await setup();
    const res = await s.as[role].put('/api/v1/employees/me', {
      version: 1,
      phone: '+91 98888 88888',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ phone: '+91 98888 88888', version: 2 });
    expect(stored(s, role).phone).toBe('+91 98888 88888');
    for (const other of ALL_ROLES.filter((r) => r !== role)) {
      expect(stored(s, other).phone).toBe('+91 90000 00000');
    }
  });

  it('clears the phone with null', async () => {
    const s = await setup();
    const res = await s.as.staff.put('/api/v1/employees/me', { version: 1, phone: null });
    expect(res.body.data.phone).toBeNull();
  });

  it.each([
    ['a role', { role: 'admin' }],
    ['roles', { roles: ['admin'] }],
    ['the manager', { managerId: '94000000-0000-4000-8000-000000000001' }],
    ['the employee code', { employeeCode: 'EMP-HACK' }],
    ['the status', { status: 'active' }],
    ['the department', { departmentId: '92000000-0000-4000-8000-000000000009' }],
    ['the designation', { designationId: '93000000-0000-4000-8000-000000000009' }],
    ['the email', { email: 'new@x.test' }],
    ['the name', { firstName: 'Mallory' }],
    ['the joining date', { joiningDate: '2020-01-01' }],
    ['a user id', { userId: '94000000-0000-4000-8000-000000000001' }],
    ['an employee id', { id: '94000000-0000-4000-8000-000000000001' }],
    ['an is-active flag', { isActive: true }],
  ])('rejects an attempt to set %s with 400 and changes nothing', async (_name, extra) => {
    const s = await setup();
    const res = await s.as.staff.put('/api/v1/employees/me', {
      version: 1,
      phone: '+91 91111 11111',
      ...extra,
    });
    expect(res.status).toBe(400);
    expect(stored(s, 'staff')).toMatchObject({ phone: '+91 90000 00000', version: 1 });
    expect(s.auditStore.find((e) => e.action === 'employee.update')).toHaveLength(0);
  });

  it.each([
    ['no phone', { version: 1 }],
    ['no version', { phone: null }],
    ['version 0', { version: 0, phone: null }],
    ['a bad phone', { version: 1, phone: 'call me' }],
    ['an empty body', {}],
  ])('rejects %s with 400', async (_name, body) => {
    const s = await setup();
    expect((await s.as.staff.put('/api/v1/employees/me', body)).status).toBe(400);
  });

  it('answers 409 for a stale version', async () => {
    const s = await setup();
    expect((await s.as.staff.put('/api/v1/employees/me', { version: 1, phone: null })).status).toBe(
      200,
    );
    expect(
      (await s.as.staff.put('/api/v1/employees/me', { version: 1, phone: '+91 92222 22222' }))
        .status,
    ).toBe(409);
  });

  it('writes one audit entry that names the field and never the number', async () => {
    const s = await setup();
    await s.as.staff.put('/api/v1/employees/me', { version: 1, phone: '+91 93333 33333' });
    const entries = s.auditStore.find((e) => e.action === 'employee.update');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      outcome: 'success',
      actorId: s.kit.users.staff.id,
      changes: { fields: ['phone'] },
    });
    expect(JSON.stringify(entries[0])).not.toContain('93333');
  });

  it('writes nothing, and no audit entry, when the phone is already this value', async () => {
    const s = await setup();
    const res = await s.as.staff.put('/api/v1/employees/me', {
      version: 1,
      phone: '+91 90000 00000',
    });
    expect(res.body.data.version).toBe(1);
    expect(s.auditStore.find((e) => e.action === 'employee.update')).toHaveLength(0);
  });
});

describe('the composed app', () => {
  const routes = listRoutes(makeApp().app);
  const at = (method: string, path: string) =>
    routes.findIndex((r) => r.method === method && r.path === path);

  it('serves /employees/me with the profile permissions', () => {
    expect(routes[at('GET', '/api/v1/employees/me')]?.access).toEqual([
      { type: 'permission', permission: 'profile.read' },
    ]);
    expect(routes[at('PUT', '/api/v1/employees/me')]?.access).toEqual([
      { type: 'permission', permission: 'profile.update' },
    ]);
  });

  it('registers the fixed /employees paths before /employees/:id, so they are not read as ids', () => {
    const idRoute = at('GET', '/api/v1/employees/:id');
    expect(idRoute).toBeGreaterThan(-1);
    expect(at('GET', '/api/v1/employees/me')).toBeLessThan(idRoute);
    expect(at('PUT', '/api/v1/employees/me')).toBeLessThan(at('PUT', '/api/v1/employees/:id'));
    expect(at('GET', '/api/v1/employees/org-roots')).toBeLessThan(idRoute);
  });
});
