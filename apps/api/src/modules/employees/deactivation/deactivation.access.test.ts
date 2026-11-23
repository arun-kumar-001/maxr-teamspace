import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { TEST_PASSWORD, createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeDeactivation } from './index';
import { MemoryDeactivationRepository, MemoryPerson } from './deactivation.repository.memory';

/**
 * `mirrorAccount` copies the switch-off into the test auth fake, as the real database does.
 * Without it, only ending the sessions can lock the employee out, which is what the second test proves.
 */
async function setup(mirrorAccount: boolean) {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staff = kit.users.staff;
  const people: MemoryPerson[] = ALL_ROLES.map((role) => {
    const u = kit.users[role];
    return {
      employeeId: u.employeeId,
      status: 'active',
      userId: u.id,
      userActive: true,
      holdsAdminRole: role === ROLES.ADMIN,
      managerId: role === ROLES.STAFF ? kit.users.team_lead.employeeId : null,
      employeeCode: `E-${role}`,
      name: role,
      version: 1,
      deactivatedAt: null,
    };
  });
  // A second Admin, so the first is not "the last".
  people.push({
    employeeId: 'e-second-admin',
    status: 'active',
    userId: 'u-second-admin',
    userActive: true,
    holdsAdminRole: true,
    managerId: null,
    employeeCode: 'E-admin-2',
    name: 'second admin',
    version: 1,
    deactivatedAt: null,
  });
  const repo = new MemoryDeactivationRepository(people);
  if (mirrorAccount) {
    repo.onAccountDeactivated = (userId) => {
      const user = kit.repo.users.get(userId);
      if (user) {
        user.isActive = false;
        user.employeeStatus = 'deactivated';
      }
    };
  }
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/employees',
    createEmployeeDeactivation({
      platform,
      authenticate: kit.auth.authenticate,
      sessions: kit.auth.sessions,
      repository: repo,
    }).router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo, kit, auditStore, staffEmployee: staff.employeeId };
}

const url = (id: string) => `/api/v1/employees/${id}/deactivate`;

describe('POST /employees/{id}/deactivate: access', () => {
  it('answers 401 without a session', async () => {
    const { app, staffEmployee } = await setup(true);
    expect((await request(app).post(url(staffEmployee)).send({})).status).toBe(401);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s deactivating the staff member gets %i', async (role, status) => {
    const s = await setup(true);
    const res = await s.as[role].post(url(s.staffEmployee));
    expect(res.status).toBe(status);
    const stored = s.repo.people.find((p) => p.employeeId === s.staffEmployee);
    expect(stored?.status).toBe(status === 200 ? 'deactivated' : 'active');
  });

  it('an Admin cannot deactivate themselves', async () => {
    const s = await setup(true);
    const res = await s.as.admin.post(url(s.as.admin.employeeId));
    expect(res.status).toBe(422);
  });

  it('answers 404 for an unknown employee and 400 for a malformed id', async () => {
    const { as } = await setup(true);
    expect((await as.admin.post(url('94000000-0000-4000-8000-0000000000ff'))).status).toBe(404);
    expect((await as.admin.post(url('nope'))).status).toBe(400);
  });

  it('accepts no body fields at all', async () => {
    const s = await setup(true);
    const res = await s.as.admin.post(url(s.staffEmployee), { status: 'active', reason: 'x' });
    expect(res.status).toBe(400);
    expect(s.repo.people.find((p) => p.employeeId === s.staffEmployee)?.status).toBe('active');
  });

  it('returns the result without credentials, and a repeat is a 200', async () => {
    const s = await setup(true);
    const first = await s.as.admin.post(url(s.staffEmployee));
    expect(first.body.data).toMatchObject({ status: 'deactivated', alreadyDeactivated: false });
    expect(JSON.stringify(first.body)).not.toMatch(/password|hash/i);
    const second = await s.as.admin.post(url(s.staffEmployee));
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyDeactivated).toBe(true);
  });
});

describe('a deactivated employee loses access at once', () => {
  it('their open session is rejected on the next request; other people are unaffected', async () => {
    const s = await setup(true);
    expect((await s.as.staff.get('/api/v1/auth/me')).status).toBe(200);
    expect((await s.as.admin.post(url(s.staffEmployee))).status).toBe(200);
    expect((await s.as.staff.get('/api/v1/auth/me')).status).toBe(401);
    expect((await s.as.hr_manager.get('/api/v1/auth/me')).status).toBe(200);
    expect((await s.as.team_lead.get('/api/v1/auth/me')).status).toBe(200);
  });

  it('ending the sessions alone locks them out, even if the account looked active', async () => {
    const s = await setup(false);
    expect((await s.as.staff.get('/api/v1/auth/me')).status).toBe(200);
    expect((await s.as.admin.post(url(s.staffEmployee))).status).toBe(200);
    expect((await s.as.staff.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('cannot sign in again, with the same correct password that worked before', async () => {
    const s = await setup(true);
    const login = () =>
      request(s.app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email: s.kit.users.staff.email, password: TEST_PASSWORD });
    expect((await login()).status).toBe(200);
    await s.as.admin.post(url(s.staffEmployee));
    expect((await login()).status).toBe(401);
  });

  it('is audited once, with the sessions that ended', async () => {
    const s = await setup(true);
    await s.as.admin.post(url(s.staffEmployee));
    await s.as.admin.post(url(s.staffEmployee));
    expect(s.auditStore.find((e) => e.action === 'employee.deactivate')).toHaveLength(1);
    expect(s.auditStore.find((e) => e.action === 'session.revoke_all')).toMatchObject([
      { metadata: { reason: 'deactivation', sessions: 1 } },
    ]);
  });
});
