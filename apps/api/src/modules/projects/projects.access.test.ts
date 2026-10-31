import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../http/idempotency';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import {
  ALL_ROLES,
  SignedIn,
  expectNoExistenceLeak,
  listRoutes,
  signInAs,
} from '../rbac/rbac.testing';
import { createProjects } from './index';
import { MemoryProjectsRepository } from './projects.repository.memory';

const MISSING = '87000000-0000-4000-8000-000000000999';
const AWAY = '87000000-0000-4000-8000-000000000050';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;
  const repo = new MemoryProjectsRepository();
  repo.people = {
    [id('staff')]: { name: 'Sam Staff', managerId: id('team_lead'), active: true, canOwn: false },
    [id('team_lead')]: { name: 'Lee Lead', managerId: null, active: true, canOwn: true },
    [id('hr_manager')]: { name: 'Hana HR', managerId: null, active: true, canOwn: false },
    [id('admin')]: { name: 'Ada Admin', managerId: null, active: true, canOwn: true },
    [AWAY]: { name: 'Al Away', managerId: id('team_lead'), active: false, canOwn: false },
  };
  const projects = createProjects({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    repository: repo,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/projects', projects.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const create = (who: Role, body: object) =>
    as[who].post('/api/v1/projects', body).set('Idempotency-Key', `project-${who}-${++n}-abcdefgh`);
  const body = (extra: object = {}) => ({ code: `P${++n}`, name: 'Website relaunch', ...extra });
  return { app, as, kit, id, repo, auditStore, create, body, reader: projects.reader };
}

describe('projects API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/projects'],
      ['post', '/api/v1/projects'],
      ['get', `/api/v1/projects/${MISSING}`],
      ['put', `/api/v1/projects/${MISSING}`],
      ['post', `/api/v1/projects/${MISSING}/members`],
      ['delete', `/api/v1/projects/${MISSING}/members/${MISSING}`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.startsWith('/api/v1/projects'));
    expect(routes).toHaveLength(6);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe('creating', () => {
    it.each([
      ['admin', 201],
      ['team_lead', 201],
      ['hr_manager', 403],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s creating a project gets %i', async (role, status) => {
      const { create, body } = await setup();
      expect((await create(role, body())).status).toBe(status);
    });

    it('makes the Team Lead the owner and a member, upper-cases the code, and audits it', async () => {
      const { create, id, auditStore } = await setup();
      const res = await create('team_lead', {
        code: 'web-2026',
        name: 'Website relaunch',
        description: 'New marketing site',
        startDate: '2026-11-01',
        endDate: '2026-12-31',
      });
      expect(res.body.data).toMatchObject({
        code: 'WEB-2026',
        status: 'active',
        ownerEmployeeId: id('team_lead'),
        ownerName: 'Lee Lead',
        memberCount: 1,
        version: 1,
      });
      expect(res.body.data.members.map((m: { employeeId: string }) => m.employeeId)).toEqual([
        id('team_lead'),
      ]);
      expect(auditStore.find((e) => e.action === 'project.create')).toHaveLength(1);
    });

    it('adds the named members once each, never twice, with the owner among them', async () => {
      const { create, id, body } = await setup();
      const res = await create(
        'team_lead',
        body({ memberIds: [id('staff'), id('staff'), id('team_lead')] }),
      );
      expect(res.status).toBe(201);
      expect(res.body.data.memberCount).toBe(2);
    });

    it('refuses members who are not the owner’s direct reports, or not active, with 422', async () => {
      const { create, id, body, repo } = await setup();
      for (const member of [id('hr_manager'), AWAY, MISSING]) {
        const res = await create('team_lead', body({ memberIds: [member] }));
        expect(res.status, member).toBe(422);
        expect(res.body.error.details[0].message).toBe(member);
      }
      expect(repo.projects).toHaveLength(0);
    });

    it('lets only an Admin name another owner, who must be an active Team Lead or Admin', async () => {
      const { create, id, body } = await setup();
      expect((await create('team_lead', body({ ownerEmployeeId: id('admin') }))).status).toBe(403);
      expect((await create('team_lead', body({ ownerEmployeeId: id('team_lead') }))).status).toBe(
        201,
      );
      const named = await create(
        'admin',
        body({ ownerEmployeeId: id('team_lead'), memberIds: [id('staff')] }),
      );
      expect(named.status).toBe(201);
      expect(named.body.data.ownerEmployeeId).toBe(id('team_lead'));
      // Members are checked against the owner, not the Admin who made the project.
      expect(named.body.data.memberCount).toBe(2);
      expect((await create('admin', body({ ownerEmployeeId: id('staff') }))).status).toBe(422);
      expect((await create('admin', body({ ownerEmployeeId: MISSING }))).status).toBe(422);
    });

    it('refuses a repeated code with 409, whatever its letter case', async () => {
      const { create, body } = await setup();
      expect((await create('team_lead', body({ code: 'ALPHA' }))).status).toBe(201);
      expect((await create('admin', body({ code: 'alpha' }))).status).toBe(409);
    });

    it('needs an Idempotency-Key, and a retry with the same key creates one project', async () => {
      const { as, body, repo } = await setup();
      const payload = body();
      expect((await as.team_lead.post('/api/v1/projects', payload)).status).toBe(400);
      const send = () =>
        as.team_lead
          .post('/api/v1/projects', payload)
          .set('Idempotency-Key', 'retry-key-123456789');
      const first = await send();
      const second = await send();
      expect(second.body).toEqual(first.body);
      expect(repo.projects).toHaveLength(1);
    });

    it.each([
      ['a code that starts with a digit', { code: '1ST' }],
      ['a one-letter code', { code: 'A' }],
      ['a blank name', { name: '  ' }],
      ['a name over 150 characters', { name: 'x'.repeat(151) }],
      ['an end before the start', { startDate: '2026-12-01', endDate: '2026-11-01' }],
      ['a day that does not exist', { startDate: '2026-02-30' }],
      ['more than 200 members', { memberIds: Array.from({ length: 201 }, () => MISSING) }],
      ['a member id that is not a uuid', { memberIds: ['x'] }],
      ['an unknown field', { status: 'archived' }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { create, body } = await setup();
      expect((await create('team_lead', body(patch))).status).toBe(400);
    });
  });

  describe('reading', () => {
    it('shows each person the projects they own or belong to, and an Admin all of them', async () => {
      const { as, create, id, body } = await setup();
      const mine = await create('team_lead', body({ code: 'ALPHA', memberIds: [id('staff')] }));
      await create('admin', body({ code: 'BETA' })); // owned by the Admin alone
      const codes = async (who: Role) =>
        (await as[who].get('/api/v1/projects')).body.data
          .map((p: { code: string }) => p.code)
          .sort();
      expect(await codes('staff')).toEqual(['ALPHA']);
      expect(await codes('team_lead')).toEqual(['ALPHA']);
      expect(await codes('hr_manager')).toEqual([]);
      expect(await codes('admin')).toEqual(['ALPHA', 'BETA']);
      expect((await as.staff.get(`/api/v1/projects/${mine.body.data.id}`)).status).toBe(200);
    });

    it('answers 404, identical to a missing project, for one you neither own nor belong to', async () => {
      const { as, create, body } = await setup();
      const hidden = await create('admin', body());
      expectNoExistenceLeak(
        await as.staff.get(`/api/v1/projects/${hidden.body.data.id}`),
        await as.staff.get(`/api/v1/projects/${MISSING}`),
      );
      expect((await as.team_lead.get(`/api/v1/projects/${hidden.body.data.id}`)).status).toBe(404);
      expect((await as.admin.get(`/api/v1/projects/${hidden.body.data.id}`)).status).toBe(200);
      expect((await as.staff.get('/api/v1/projects/not-a-uuid')).status).toBe(400);
    });

    it('filters by status and by name or code, and pages', async () => {
      const { as, create, body } = await setup();
      await create('admin', body({ code: 'ALPHA', name: 'Alpha site' }));
      await create('admin', body({ code: 'BETA', name: 'Beta app' }));
      const archived = await create('admin', body({ code: 'OLD', name: 'Old thing' }));
      await as.admin.put(`/api/v1/projects/${archived.body.data.id}`, {
        status: 'archived',
        version: 1,
      });
      const names = async (query: string) =>
        (await as.admin.get(`/api/v1/projects${query}`)).body.data.map(
          (p: { code: string }) => p.code,
        );
      expect(await names('?status=archived')).toEqual(['OLD']);
      expect(await names('?q=beta')).toEqual(['BETA']);
      expect(await names('?q=ALP')).toEqual(['ALPHA']);
      expect(await names('?pageSize=1&page=2')).toHaveLength(1);
      expect((await as.admin.get('/api/v1/projects?status=gone')).status).toBe(400);
      expect((await as.admin.get('/api/v1/projects?pageSize=1000')).status).toBe(400);
    });
  });

  describe('changing', () => {
    it('lets the owner and an Admin change a project, bumps the version and audits the change', async () => {
      const { as, create, body, auditStore } = await setup();
      const made = await create('team_lead', body({ name: 'Old name' }));
      const url = `/api/v1/projects/${made.body.data.id}`;
      const ok = await as.team_lead.put(url, {
        name: 'New name',
        endDate: '2027-01-31',
        version: 1,
      });
      expect(ok.body.data).toMatchObject({ name: 'New name', endDate: '2027-01-31', version: 2 });
      expect(
        (await as.admin.put(url, { description: 'Admin note', version: 2 })).body.data.version,
      ).toBe(3);
      const entry = auditStore.find((e) => e.action === 'project.update')[0];
      expect(entry?.changes).toEqual({
        name: { from: 'Old name', to: 'New name' },
        endDate: { from: null, to: '2027-01-31' },
      });
    });

    it('does not let a plain member change the project they belong to', async () => {
      const { as, create, id, body } = await setup();
      const made = await create('team_lead', body({ memberIds: [id('staff')] }));
      const url = `/api/v1/projects/${made.body.data.id}`;
      expect((await as.staff.get(url)).status).toBe(200);
      expect((await as.staff.put(url, { name: 'x', version: 1 })).status).toBe(403);
      expect((await as.staff.post(`${url}/members`, { employeeId: id('staff') })).status).toBe(403);
    });

    it('does not let a Team Lead change a project they cannot even see', async () => {
      const { as, create, body } = await setup();
      const hidden = await create('admin', body());
      expect(
        (
          await as.team_lead.put(`/api/v1/projects/${hidden.body.data.id}`, {
            name: 'x',
            version: 1,
          })
        ).status,
      ).toBe(404);
    });

    it('a Team Lead who is a member of an Admin-owned project may read it but not change it (403)', async () => {
      const { as, create, id, body, repo } = await setup();
      const made = await create('admin', body());
      repo.members.push({
        projectId: made.body.data.id,
        employeeId: id('team_lead'),
        addedAt: new Date().toISOString(),
      });
      const url = `/api/v1/projects/${made.body.data.id}`;
      expect((await as.team_lead.get(url)).status).toBe(200);
      expect((await as.team_lead.put(url, { name: 'x', version: 1 })).status).toBe(403);
      expect((await as.team_lead.post(`${url}/members`, { employeeId: id('staff') })).status).toBe(
        403,
      );
    });

    it('refuses a stale version with 409, an empty change and a missing version with 400', async () => {
      const { as, create, body } = await setup();
      const made = await create('team_lead', body());
      const url = `/api/v1/projects/${made.body.data.id}`;
      await as.team_lead.put(url, { name: 'First', version: 1 });
      expect((await as.team_lead.put(url, { name: 'Second', version: 1 })).status).toBe(409);
      expect((await as.team_lead.put(url, { version: 2 })).status).toBe(400);
      expect((await as.team_lead.put(url, { name: 'Third' })).status).toBe(400);
      expect(
        (await as.team_lead.put(`/api/v1/projects/${MISSING}`, { name: 'x', version: 1 })).status,
      ).toBe(404);
    });

    it('writes nothing, and no audit entry, when nothing differs', async () => {
      const { as, create, body, auditStore } = await setup();
      const made = await create('team_lead', body({ name: 'Same' }));
      const res = await as.team_lead.put(`/api/v1/projects/${made.body.data.id}`, {
        name: 'Same',
        version: 1,
      });
      expect(res.body.data.version).toBe(1);
      expect(auditStore.find((e) => e.action === 'project.update')).toHaveLength(0);
    });

    it('refuses dates out of order against the stored ones with 422, and lets a date be cleared', async () => {
      const { as, create, body } = await setup();
      const made = await create(
        'team_lead',
        body({ startDate: '2026-11-10', endDate: '2026-12-10' }),
      );
      const url = `/api/v1/projects/${made.body.data.id}`;
      expect((await as.team_lead.put(url, { endDate: '2026-11-01', version: 1 })).status).toBe(422);
      const cleared = await as.team_lead.put(url, { endDate: null, version: 1 });
      expect(cleared.body.data.endDate).toBeNull();
    });

    it('archives and reactivates; an archived project is read-only', async () => {
      const { as, create, id, body, auditStore } = await setup();
      const made = await create('team_lead', body({ memberIds: [id('staff')] }));
      const url = `/api/v1/projects/${made.body.data.id}`;
      expect(
        (await as.team_lead.put(url, { status: 'archived', version: 1 })).body.data.status,
      ).toBe('archived');
      expect((await as.team_lead.put(url, { name: 'Renamed', version: 2 })).status).toBe(422);
      expect((await as.team_lead.post(`${url}/members`, { employeeId: id('staff') })).status).toBe(
        422,
      );
      expect((await as.team_lead.delete(`${url}/members/${id('staff')}`)).status).toBe(422);
      expect((await as.staff.get(url)).status).toBe(200); // still readable
      const back = await as.team_lead.put(url, {
        status: 'active',
        name: 'Back again',
        version: 2,
      });
      expect(back.body.data).toMatchObject({ status: 'active', name: 'Back again' });
      expect(auditStore.find((e) => e.action === 'project.archive')).toHaveLength(1);
      expect(auditStore.find((e) => e.action === 'project.reactivate')).toHaveLength(1);
    });
  });

  describe('members', () => {
    it('adds a direct report, once, and removes them', async () => {
      const { as, create, id, body, auditStore } = await setup();
      const made = await create('team_lead', body());
      const url = `/api/v1/projects/${made.body.data.id}`;
      const added = await as.team_lead.post(`${url}/members`, { employeeId: id('staff') });
      expect(added.status).toBe(200);
      expect(added.body.data.memberCount).toBe(2);
      expect((await as.staff.get('/api/v1/projects')).body.data).toHaveLength(1);
      // Adding again changes nothing and leaves no second audit entry.
      expect(
        (await as.team_lead.post(`${url}/members`, { employeeId: id('staff') })).body.data
          .memberCount,
      ).toBe(2);
      expect(auditStore.find((e) => e.action === 'project.member_add')).toHaveLength(1);

      const removed = await as.team_lead.delete(`${url}/members/${id('staff')}`);
      expect(removed.body.data.memberCount).toBe(1);
      expect((await as.staff.get('/api/v1/projects')).body.data).toHaveLength(0);
      expect((await as.staff.get(url)).status).toBe(404);
      expect(auditStore.find((e) => e.action === 'project.member_remove')).toHaveLength(1);
    });

    it('refuses someone who is not a direct report, is not active, or is already gone', async () => {
      const { as, create, id, body } = await setup();
      const made = await create('team_lead', body());
      const url = `/api/v1/projects/${made.body.data.id}`;
      expect(
        (await as.team_lead.post(`${url}/members`, { employeeId: id('hr_manager') })).status,
      ).toBe(422);
      expect((await as.team_lead.post(`${url}/members`, { employeeId: 'e-away' })).status).toBe(
        400,
      ); // not a uuid
      expect((await as.team_lead.post(`${url}/members`, { employeeId: MISSING })).status).toBe(422);
      expect((await as.team_lead.delete(`${url}/members/${id('staff')}`)).status).toBe(404);
    });

    it('cannot remove the owner', async () => {
      const { as, create, id, body } = await setup();
      const made = await create('team_lead', body());
      const res = await as.team_lead.delete(
        `/api/v1/projects/${made.body.data.id}/members/${id('team_lead')}`,
      );
      expect(res.status).toBe(422);
    });

    it('is out of reach of someone who cannot see the project', async () => {
      const { as, create, id, body } = await setup();
      const hidden = await create('admin', body());
      const url = `/api/v1/projects/${hidden.body.data.id}`;
      expect((await as.team_lead.post(`${url}/members`, { employeeId: id('staff') })).status).toBe(
        404,
      );
      expect((await as.team_lead.delete(`${url}/members/${id('staff')}`)).status).toBe(404);
    });
  });

  it('tells other modules who can work on a project, without exposing the tables', async () => {
    const { create, id, body, reader } = await setup();
    const made = await create('team_lead', body({ memberIds: [id('staff')] }));
    const access = await reader.access(made.body.data.id);
    expect(access).toMatchObject({ status: 'active', ownerEmployeeId: id('team_lead') });
    expect(access?.memberEmployeeIds.sort()).toEqual([id('staff'), id('team_lead')].sort());
    expect(await reader.access(MISSING)).toBeNull();
  });
});
