import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import { PERMISSION_KEYS } from '../rbac';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { createUsers } from './index';
import { MemoryUsersRepository } from './users.repository.memory';
import { RoleSummary, UserAccount } from './users.types';

const id = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const account = (n: number, roles: Role[], overrides: Partial<UserAccount> = {}): UserAccount => ({
  id: id(n),
  employeeId: id(n + 1000),
  employeeCode: `EMP${String(n).padStart(3, '0')}`,
  name: `Person ${String(n).padStart(2, '0')}`,
  email: `person${n}@maxr.internal`,
  isActive: true,
  roles,
  lastLoginAt: null,
  createdAt: new Date(Date.UTC(2026, 0, n)).toISOString(),
  ...overrides,
});

const roleSummaries: RoleSummary[] = Object.values(ROLES).map((key, i) => ({
  id: id(900 + i),
  key,
  name: key,
  description: null,
  activeUsers: 0,
}));

/** Copies the accounts: the in-memory repository mutates what it holds, and tests share fixtures. */
async function setup(given: UserAccount[]) {
  const users = given.map((u) => ({ ...u, roles: [...u.roles] }));
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryUsersRepository(users, roleSummaries);
  const mounted = createUsers({
    platform,
    authenticate: kit.auth.authenticate,
    repository: repo,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/users', mounted.usersRouter);
  app.use('/api/v1/roles', mounted.rolesRouter);
  app.use('/api/v1/permissions', mounted.permissionsRouter);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo, auditStore };
}

const target = account(1, [ROLES.STAFF]);
const lonelyAdmin = account(2, [ROLES.ADMIN]);

describe('users and roles API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup([target]);
    for (const [method, path] of [
      ['get', '/api/v1/users'],
      ['get', `/api/v1/users/${target.id}`],
      ['put', `/api/v1/users/${target.id}/roles`],
      ['get', '/api/v1/roles'],
      ['get', '/api/v1/permissions'],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it.each([
    ['admin', 200, 200, 200],
    ['hr_manager', 200, 403, 403],
    ['team_lead', 403, 403, 403],
    ['staff', 403, 403, 403],
  ] as const)('%s: users %i, roles %i, permissions %i', async (role, users, roles, perms) => {
    const { as } = await setup([target]);
    expect((await as[role].get('/api/v1/users')).status).toBe(users);
    expect((await as[role].get(`/api/v1/users/${target.id}`)).status).toBe(users);
    expect((await as[role].get('/api/v1/roles')).status).toBe(roles);
    expect((await as[role].get('/api/v1/permissions')).status).toBe(perms);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s changing roles gets %i', async (role, status) => {
    const { as, repo } = await setup([target]);
    const res = await as[role].put(`/api/v1/users/${target.id}/roles`, {
      roles: [ROLES.TEAM_LEAD],
    });
    expect(res.status).toBe(status);
    if (status === 403) expect(repo.users[0]?.roles).toEqual([ROLES.STAFF]);
  });
});

describe('users and roles API: reading', () => {
  it('lists accounts with a stable page meta and never exposes credentials', async () => {
    const users = Array.from({ length: 5 }, (_, i) => account(i + 1, [ROLES.STAFF]));
    const { as } = await setup(users);
    const res = await as.admin.get('/api/v1/users?pageSize=2&page=3');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 3, pageSize: 2, total: 5, totalPages: 3 });
    expect(res.body.data).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  it('pages without repeating accounts that tie on the sort column', async () => {
    const users = Array.from({ length: 5 }, (_, i) =>
      account(i + 1, [ROLES.STAFF], { name: 'Same Name' }),
    );
    const { as } = await setup(users);
    const ids: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await as.admin.get(`/api/v1/users?pageSize=2&page=${page}`);
      ids.push(...res.body.data.map((u: UserAccount) => u.id));
    }
    expect(new Set(ids).size).toBe(5);
  });

  it('filters by search, role and active state', async () => {
    const { as } = await setup([
      account(1, [ROLES.STAFF], { name: 'Asha Rao' }),
      account(2, [ROLES.TEAM_LEAD], { name: 'Ben Cole' }),
      account(3, [ROLES.STAFF], { name: 'Cara Dev', isActive: false }),
    ]);
    const names = async (qs: string) =>
      (await as.admin.get(`/api/v1/users?${qs}`)).body.data.map((u: UserAccount) => u.name);
    expect(await names('search=asha')).toEqual(['Asha Rao']);
    expect(await names(`role=${ROLES.TEAM_LEAD}`)).toEqual(['Ben Cole']);
    expect(await names('isActive=false')).toEqual(['Cara Dev']);
    expect(await names('isActive=true&role=staff')).toEqual(['Asha Rao']);
  });

  it.each(['role=owner', 'isActive=yes', 'sortBy=password', 'pageSize=1000', 'bogus=1'])(
    'rejects the query %s',
    async (qs) => {
      const { as } = await setup([target]);
      expect((await as.admin.get(`/api/v1/users?${qs}`)).status).toBe(400);
    },
  );

  it('answers 404 for an unknown account and 400 for a malformed id', async () => {
    const { as } = await setup([target]);
    expect((await as.admin.get(`/api/v1/users/${id(99)}`)).status).toBe(404);
    expect((await as.admin.get('/api/v1/users/not-a-uuid')).status).toBe(400);
  });

  it('lists the four roles', async () => {
    const { as } = await setup([target]);
    const res = await as.admin.get('/api/v1/roles');
    expect(res.body.data.map((r: RoleSummary) => r.key).sort()).toEqual(
      Object.values(ROLES).sort(),
    );
  });

  it('lists every catalog permission with its grants, and users.assign_role is Admin only', async () => {
    const { as } = await setup([target]);
    const res = await as.admin.get('/api/v1/permissions');
    expect(res.body.data.map((p: { key: string }) => p.key)).toEqual(PERMISSION_KEYS);
    const assign = res.body.data.find((p: { key: string }) => p.key === 'users.assign_role');
    expect(assign).toMatchObject({
      module: 'users',
      action: 'assign_role',
      grants: { admin: 'all' },
    });
    expect(Object.keys(assign.grants)).toEqual(['admin']);
  });
});

describe('users and roles API: changing roles', () => {
  it('replaces the roles and audits who changed what, from and to', async () => {
    const { as, auditStore } = await setup([target, lonelyAdmin]);
    const res = await as.admin.put(`/api/v1/users/${target.id}/roles`, {
      roles: [ROLES.TEAM_LEAD, ROLES.STAFF],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual([ROLES.STAFF, ROLES.TEAM_LEAD]);
    const [entry, ...rest] = auditStore.find((e) => e.action === 'users.assign_role');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityType: 'user',
      entityId: target.id,
      actorId: as.admin.userId,
      changes: { roles: { from: [ROLES.STAFF], to: [ROLES.STAFF, ROLES.TEAM_LEAD] } },
    });
  });

  it('does nothing and writes no audit entry when the roles are already these', async () => {
    const { as, auditStore } = await setup([target]);
    const res = await as.admin.put(`/api/v1/users/${target.id}/roles`, { roles: [ROLES.STAFF] });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: target.id, roles: [ROLES.STAFF] });
    expect(auditStore.find((e) => e.action === 'users.assign_role')).toHaveLength(0);
  });

  it('refuses to remove the last active Admin and records the refusal', async () => {
    const { as, repo, auditStore } = await setup([lonelyAdmin, target]);
    const res = await as.admin.put(`/api/v1/users/${lonelyAdmin.id}/roles`, {
      roles: [ROLES.STAFF],
    });
    expect(res.status).toBe(422);
    expect(repo.users[0]?.roles).toEqual([ROLES.ADMIN]);
    expect(auditStore.find((e) => e.action === 'users.assign_role')).toMatchObject([
      { outcome: 'failure', entityId: lonelyAdmin.id },
    ]);
  });

  it('does not count an inactive Admin as a remaining Admin', async () => {
    const { as } = await setup([lonelyAdmin, account(3, [ROLES.ADMIN], { isActive: false })]);
    const res = await as.admin.put(`/api/v1/users/${lonelyAdmin.id}/roles`, {
      roles: [ROLES.STAFF],
    });
    expect(res.status).toBe(422);
  });

  it('allows removing an Admin while another active Admin remains', async () => {
    const { as, repo } = await setup([lonelyAdmin, account(3, [ROLES.ADMIN])]);
    const res = await as.admin.put(`/api/v1/users/${lonelyAdmin.id}/roles`, {
      roles: [ROLES.STAFF],
    });
    expect(res.status).toBe(200);
    expect(repo.users[0]?.roles).toEqual([ROLES.STAFF]);
  });

  it('answers 404 for an unknown account', async () => {
    const { as } = await setup([target]);
    expect(
      (await as.admin.put(`/api/v1/users/${id(99)}/roles`, { roles: [ROLES.STAFF] })).status,
    ).toBe(404);
  });

  it.each([
    ['no roles', { roles: [] }],
    ['a repeated role', { roles: [ROLES.STAFF, ROLES.STAFF] }],
    ['an unknown role', { roles: ['owner'] }],
    ['a missing field', {}],
    ['an unexpected field', { roles: [ROLES.STAFF], isActive: false }],
  ])('rejects %s with 400 and leaves the account alone', async (_name, body) => {
    const { as, repo } = await setup([target]);
    const res = await as.admin.put(`/api/v1/users/${target.id}/roles`, body);
    expect(res.status).toBe(400);
    expect(repo.users[0]?.roles).toEqual([ROLES.STAFF]);
  });
});
