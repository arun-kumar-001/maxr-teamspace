import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, expectNoExistenceLeak, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeDetail } from './index';
import { MemoryEmployeeDetailRepository } from './detail.repository.memory';
import { EmployeeDetail } from './detail.types';

const OUTSIDER = '94000000-0000-4000-8000-000000000001';
const DEPT = '92000000-0000-4000-8000-000000000001';
const DESIG = '93000000-0000-4000-8000-000000000001';

const person = (id: string, code: string, email: string): EmployeeDetail => ({
  id,
  employeeCode: code,
  firstName: 'Test',
  lastName: code,
  email,
  phone: null,
  department: { id: DEPT, name: 'Engineering', code: 'ENG' },
  designation: { id: DESIG, title: 'Engineer', code: 'ENG-1' },
  manager: null,
  status: 'active',
  joiningDate: '2026-01-15',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  version: 1,
  account: { userId: `u-${id}`, isActive: true, lastLoginAt: null, roles: [ROLES.STAFF] },
});

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staffId = kit.users.staff.employeeId;
  const leadId = kit.users.team_lead.employeeId;
  const repo = new MemoryEmployeeDetailRepository([
    { detail: person(staffId, 'EMP-STAFF', 'staff@x.test'), managerId: leadId },
    { detail: person(OUTSIDER, 'EMP-OUT', 'out@x.test'), managerId: null },
  ]);
  repo.references.designation = { isActive: true, departmentId: DEPT };
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/employees',
    createEmployeeDetail({ platform, authenticate: kit.auth.authenticate, repository: repo })
      .router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo, auditStore, staffId, leadId };
}

describe('GET /employees/{id}: access', () => {
  it('answers 401 without a session', async () => {
    const { app, staffId } = await setup();
    expect((await request(app).get(`/api/v1/employees/${staffId}`)).status).toBe(401);
  });

  it.each([
    ['admin', 200, 200],
    ['hr_manager', 200, 200],
    ['team_lead', 200, 404],
    ['staff', 200, 404],
  ] as const)('%s reads the staff member: %i, an outsider: %i', async (role, own, outsider) => {
    const s = await setup();
    expect((await s.as[role].get(`/api/v1/employees/${s.staffId}`)).status).toBe(own);
    expect((await s.as[role].get(`/api/v1/employees/${OUTSIDER}`)).status).toBe(outsider);
  });

  it('an out-of-scope employee looks exactly like one that does not exist', async () => {
    const s = await setup();
    const hidden = await s.as.team_lead.get(`/api/v1/employees/${OUTSIDER}`);
    const missing = await s.as.team_lead.get(
      '/api/v1/employees/94000000-0000-4000-8000-0000000000ff',
    );
    expectNoExistenceLeak(hidden, missing);
  });

  it('shows the login information to Admin and HR only', async () => {
    const s = await setup();
    for (const role of ['admin', 'hr_manager'] as const) {
      const res = await s.as[role].get(`/api/v1/employees/${s.staffId}`);
      expect(res.body.data.account).toMatchObject({ isActive: true, roles: [ROLES.STAFF] });
    }
    for (const role of ['team_lead', 'staff'] as const) {
      const res = await s.as[role].get(`/api/v1/employees/${s.staffId}`);
      expect(res.body.data.account).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash|lastLoginAt/i);
    }
  });

  it('returns the version to send back', async () => {
    const s = await setup();
    expect((await s.as.hr_manager.get(`/api/v1/employees/${s.staffId}`)).body.data.version).toBe(1);
  });

  it('answers 400 for a malformed id', async () => {
    const { as } = await setup();
    expect((await as.admin.get('/api/v1/employees/not-a-uuid')).status).toBe(400);
  });
});

describe('PUT /employees/{id}: access and rules', () => {
  it('answers 401 without a session', async () => {
    const { app, staffId } = await setup();
    expect(
      (await request(app).put(`/api/v1/employees/${staffId}`).send({ version: 1, phone: null }))
        .status,
    ).toBe(401);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s editing the staff member gets %i', async (role, status) => {
    const s = await setup();
    const res = await s.as[role].put(`/api/v1/employees/${s.staffId}`, {
      version: 1,
      firstName: 'Renamed',
    });
    expect(res.status).toBe(status);
    const stored = s.repo.employees[0]!.detail;
    expect(stored.firstName).toBe(status === 200 ? 'Renamed' : 'Test');
  });

  it('a Team Lead and Staff cannot edit even themselves through this route', async () => {
    const s = await setup();
    expect(
      (await s.as.staff.put(`/api/v1/employees/${s.staffId}`, { version: 1, phone: null })).status,
    ).toBe(403);
  });

  it('HR cannot change the code or the email, an Admin can', async () => {
    const s = await setup();
    const url = `/api/v1/employees/${s.staffId}`;
    expect((await s.as.hr_manager.put(url, { version: 1, employeeCode: 'EMP-NEW' })).status).toBe(
      403,
    );
    expect((await s.as.hr_manager.put(url, { version: 1, email: 'n@x.test' })).status).toBe(403);
    const ok = await s.as.admin.put(url, {
      version: 1,
      employeeCode: 'EMP-NEW',
      email: 'n@x.test',
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ employeeCode: 'EMP-NEW', email: 'n@x.test', version: 2 });
  });

  it('answers 409 for a stale version', async () => {
    const s = await setup();
    const url = `/api/v1/employees/${s.staffId}`;
    expect((await s.as.hr_manager.put(url, { version: 1, firstName: 'A' })).status).toBe(200);
    const stale = await s.as.admin.put(url, { version: 1, firstName: 'B' });
    expect(stale.status).toBe(409);
    expect(s.repo.employees[0]!.detail.firstName).toBe('A');
    expect((await s.as.admin.put(url, { version: 2, firstName: 'B' })).status).toBe(200);
  });

  it('answers 404 for an unknown employee and 400 for a malformed id', async () => {
    const { as } = await setup();
    expect(
      (
        await as.admin.put('/api/v1/employees/94000000-0000-4000-8000-0000000000ff', {
          version: 1,
          phone: null,
        })
      ).status,
    ).toBe(404);
    expect((await as.admin.put('/api/v1/employees/nope', { version: 1, phone: null })).status).toBe(
      400,
    );
  });

  it.each([
    ['status', { status: 'active' }],
    ['the manager', { managerId: '94000000-0000-4000-8000-000000000001' }],
    ['a role', { role: 'admin' }],
    ['a user id', { userId: '94000000-0000-4000-8000-000000000001' }],
    ['the version bumped by hand', { updatedAt: '2026-01-01T00:00:00.000Z' }],
    ['no field at all', {}],
    ['an empty name', { firstName: '   ' }],
    ['a bad phone', { phone: 'call me' }],
    ['a date that does not exist', { joiningDate: '2026-02-30' }],
    ['a malformed department id', { departmentId: 'abc' }],
  ])('rejects %s with 400 and changes nothing', async (_name, change) => {
    const s = await setup();
    const res = await s.as.admin.put(`/api/v1/employees/${s.staffId}`, { version: 1, ...change });
    expect(res.status).toBe(400);
    expect(s.repo.employees[0]!.detail.version).toBe(1);
  });

  it('requires the version', async () => {
    const s = await setup();
    expect((await s.as.admin.put(`/api/v1/employees/${s.staffId}`, { phone: null })).status).toBe(
      400,
    );
    expect(
      (await s.as.admin.put(`/api/v1/employees/${s.staffId}`, { version: 0, phone: null })).status,
    ).toBe(400);
  });

  it('audits an edit once, with field names only', async () => {
    const s = await setup();
    await s.as.hr_manager.put(`/api/v1/employees/${s.staffId}`, { version: 1, firstName: 'Zed' });
    const entries = s.auditStore.find((e) => e.action === 'employee.update');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ outcome: 'success', changes: { fields: ['firstName'] } });
    expect(JSON.stringify(entries[0])).not.toContain('Zed');
  });
});
