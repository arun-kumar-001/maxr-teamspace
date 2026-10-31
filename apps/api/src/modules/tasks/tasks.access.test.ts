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
import type { ProjectAccess } from '../projects';
import {
  ALL_ROLES,
  SignedIn,
  expectNoExistenceLeak,
  listRoutes,
  signInAs,
} from '../rbac/rbac.testing';
import { createTasks } from './index';
import { MemoryTasksRepository } from './tasks.repository.memory';

const MISSING = '89000000-0000-4000-8000-000000000999';
const AWAY = '89000000-0000-4000-8000-000000000050';
const PROJECT = '89000000-0000-4000-8000-000000000101';
const ARCHIVED = '89000000-0000-4000-8000-000000000102';
const NOW = new Date('2026-10-31T10:00:00Z');

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;
  const repo = new MemoryTasksRepository();
  repo.people = {
    [id('staff')]: { name: 'Sam Staff', status: 'active', managerId: id('team_lead') },
    [id('team_lead')]: { name: 'Lee Lead', status: 'active', managerId: null },
    [id('hr_manager')]: { name: 'Hana HR', status: 'active', managerId: null },
    [id('admin')]: { name: 'Ada Admin', status: 'active', managerId: null },
    [AWAY]: { name: 'Al Away', status: 'deactivated', managerId: id('team_lead') },
  };
  const projects = new Map<string, ProjectAccess>([
    [
      PROJECT,
      {
        status: 'active',
        ownerEmployeeId: id('team_lead'),
        memberEmployeeIds: [id('team_lead'), id('staff')],
      },
    ],
    [
      ARCHIVED,
      {
        status: 'archived',
        ownerEmployeeId: id('team_lead'),
        memberEmployeeIds: [id('team_lead'), id('staff')],
      },
    ],
  ]);
  const events: Array<{ type: string; payload: unknown }> = [];
  for (const type of ['tasks.assigned', 'tasks.status_changed']) {
    platform.events.subscribe(
      type,
      (event) => void events.push({ type: event.type, payload: event.payload }),
    );
  }
  const tasks = createTasks({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () => ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
      }),
    },
    projects: { access: async (projectId) => projects.get(projectId) ?? null },
    repository: repo,
    clock: () => NOW,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/tasks', tasks.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const create = (who: Role, body: object) =>
    as[who].post('/api/v1/tasks', body).set('Idempotency-Key', `task-${who}-${++n}-abcdefgh`);
  const body = (assignee: Role, extra: object = {}) => ({
    title: 'Prepare the report',
    assigneeEmployeeId: id(assignee),
    ...extra,
  });
  const move = (who: Role, taskId: string, status: string) =>
    as[who].post(`/api/v1/tasks/${taskId}/status`, { status });
  return { app, as, id, repo, auditStore, events, create, body, move, projects };
}

describe('tasks API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['post', '/api/v1/tasks'],
      ['get', '/api/v1/tasks'],
      ['get', '/api/v1/tasks/me'],
      ['get', `/api/v1/tasks/${MISSING}`],
      ['put', `/api/v1/tasks/${MISSING}`],
      ['post', `/api/v1/tasks/${MISSING}/status`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.startsWith('/api/v1/tasks'));
    expect(routes).toHaveLength(6);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe('creating and assigning', () => {
    it.each([
      ['admin', 201],
      ['team_lead', 201],
      ['hr_manager', 403],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s creating a task gets %i', async (role, status) => {
      const { create, body } = await setup();
      expect((await create(role, body('staff'))).status).toBe(status);
    });

    it('creates a todo task with medium priority, records the assigner from the session, and announces it', async () => {
      const { create, body, id, events, auditStore } = await setup();
      const res = await create(
        'team_lead',
        body('staff', { description: 'Q3 numbers', dueDate: '2026-11-15' }),
      );
      expect(res.body.data).toMatchObject({
        status: 'todo',
        priority: 'medium',
        assigneeEmployeeId: id('staff'),
        assigneeName: 'Sam Staff',
        assignerEmployeeId: id('team_lead'),
        dueDate: '2026-11-15',
        isOverdue: false,
        completedAt: null,
        version: 1,
      });
      expect(events.map((e) => e.type)).toEqual(['tasks.assigned']);
      const entry = auditStore.find((e) => e.action === 'task.create')[0];
      expect(JSON.stringify(entry)).not.toContain('Prepare the report');
    });

    it('lets a Team Lead assign to themselves and their reports, never outside the team (403)', async () => {
      const { create, body } = await setup();
      expect((await create('team_lead', body('team_lead'))).status).toBe(201);
      expect((await create('team_lead', body('staff'))).status).toBe(201);
      const outside = await create('team_lead', body('hr_manager'));
      expect(outside.status).toBe(403);
      expect((await create('team_lead', body('admin'))).status).toBe(403);
    });

    it('lets an Admin assign to any active employee', async () => {
      const { create, body } = await setup();
      for (const who of ['staff', 'team_lead', 'hr_manager'] as Role[]) {
        expect((await create('admin', body(who))).status, who).toBe(201);
      }
    });

    it('refuses an assignee who is not active or does not exist with 422, even to an Admin', async () => {
      const { create, body } = await setup();
      for (const assigneeEmployeeId of [AWAY, MISSING]) {
        expect((await create('admin', { ...body('staff'), assigneeEmployeeId })).status).toBe(422);
        expect((await create('team_lead', { ...body('staff'), assigneeEmployeeId })).status).toBe(
          422,
        );
      }
    });

    it('refuses a due date in the past with 422 and accepts today', async () => {
      const { create, body } = await setup();
      expect((await create('team_lead', body('staff', { dueDate: '2026-10-30' }))).status).toBe(
        422,
      );
      expect((await create('team_lead', body('staff', { dueDate: '2026-10-31' }))).status).toBe(
        201,
      );
    });

    describe('with a project', () => {
      it('accepts an active project the assigner belongs to and whose member the assignee is', async () => {
        const { create, body } = await setup();
        const res = await create('team_lead', body('staff', { projectId: PROJECT }));
        expect(res.status).toBe(201);
        expect(res.body.data.projectId).toBe(PROJECT);
      });

      it.each([
        ['an unknown project', { projectId: MISSING }],
        ['an archived project', { projectId: ARCHIVED }],
      ])('refuses %s with 422', async (_name, patch) => {
        const { create, body } = await setup();
        expect((await create('team_lead', body('staff', patch))).status).toBe(422);
      });

      it('refuses an assignee who is not a member of the project', async () => {
        const { create, body } = await setup();
        const res = await create('admin', body('hr_manager', { projectId: PROJECT }));
        expect(res.status).toBe(422);
        expect(res.body.error.message).toContain('not a member');
      });

      it('refuses a project the Team Lead neither owns nor belongs to, but not an Admin', async () => {
        const { create, body, projects, id } = await setup();
        const other = '89000000-0000-4000-8000-000000000103';
        projects.set(other, {
          status: 'active',
          ownerEmployeeId: id('admin'),
          memberEmployeeIds: [id('admin'), id('staff')],
        });
        expect((await create('team_lead', body('staff', { projectId: other }))).status).toBe(422);
        expect((await create('admin', body('staff', { projectId: other }))).status).toBe(201);
      });
    });

    it('needs an Idempotency-Key, and a retry with the same key creates one task', async () => {
      const { as, body, repo } = await setup();
      expect((await as.team_lead.post('/api/v1/tasks', body('staff'))).status).toBe(400);
      const send = () =>
        as.team_lead
          .post('/api/v1/tasks', body('staff'))
          .set('Idempotency-Key', 'retry-key-123456789');
      const first = await send();
      const second = await send();
      expect(second.body).toEqual(first.body);
      expect(repo.tasks).toHaveLength(1);
    });

    it.each([
      ['a blank title', { title: '  ' }],
      ['a title over 200 characters', { title: 'x'.repeat(201) }],
      ['a description over 2000 characters', { description: 'x'.repeat(2001) }],
      ['an unknown priority', { priority: 'critical' }],
      ['a due date that does not exist', { dueDate: '2026-02-30' }],
      ['a status of the new task', { status: 'completed' }],
      ['an assigner named in the body', { assignerEmployeeId: MISSING }],
      ['an assignee that is not a uuid', { assigneeEmployeeId: 'sam' }],
      ['a project that is not a uuid', { projectId: 'x' }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { create, body } = await setup();
      expect((await create('team_lead', body('staff', patch))).status).toBe(400);
    });
  });

  describe('moving through the lifecycle', () => {
    it('walks a task from todo to completed, with the assignee and the assigner each doing their part', async () => {
      const { create, body, move } = await setup();
      const made = await create('team_lead', body('staff'));
      const taskId = made.body.data.id as string;
      expect((await move('staff', taskId, 'in_progress')).body.data.status).toBe('in_progress');
      expect((await move('staff', taskId, 'in_review')).body.data.status).toBe('in_review');
      const done = await move('team_lead', taskId, 'completed');
      expect(done.body.data.status).toBe('completed');
      expect(done.body.data.completedAt).toEqual(expect.any(String));
      const reopened = await move('team_lead', taskId, 'in_progress');
      expect(reopened.body.data).toMatchObject({ status: 'in_progress', completedAt: null });
    });

    it('does not let the assignee complete or reopen: the assignee moves it to review (403)', async () => {
      const { create, body, move } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      await move('staff', taskId, 'in_review');
      expect((await move('staff', taskId, 'completed')).status).toBe(403);
      await move('team_lead', taskId, 'completed');
      expect((await move('staff', taskId, 'in_progress')).status).toBe(403);
    });

    it('lets an Admin complete and reopen any task', async () => {
      const { create, body, move } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      await move('staff', taskId, 'in_review');
      expect((await move('admin', taskId, 'completed')).status).toBe(200);
      expect((await move('admin', taskId, 'in_progress')).status).toBe(200);
    });

    it.each([
      ['todo', 'completed'],
      ['todo', 'in_review'],
      ['todo', 'blocked'],
      ['in_progress', 'completed'],
    ])('answers 422 for the illegal move %s to %s, naming what is open', async (from, to) => {
      const { create, body, move, repo } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      const stored = repo.tasks.find((t) => t.id === taskId);
      if (stored) stored.status = from as never;
      const res = await move('team_lead', taskId, to);
      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain('can become');
      expect(repo.tasks[0]?.status).toBe(from);
    });

    it('supports blocked and back, and a step back from review', async () => {
      const { create, body, move } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      expect((await move('staff', taskId, 'blocked')).body.data.status).toBe('blocked');
      expect((await move('staff', taskId, 'in_progress')).body.data.status).toBe('in_progress');
      await move('staff', taskId, 'in_review');
      expect((await move('staff', taskId, 'in_progress')).body.data.status).toBe('in_progress');
      expect((await move('staff', taskId, 'todo')).body.data.status).toBe('todo');
    });

    it('answers 200 and changes nothing when the task already has the status, with no audit entry or event', async () => {
      const { create, body, move, auditStore, events } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      const before = {
        audit: auditStore.find((e) => e.action === 'task.status').length,
        events: events.length,
      };
      const again = await move('staff', taskId, 'in_progress');
      expect(again.status).toBe(200);
      expect(again.body.data.version).toBe(2);
      expect(auditStore.find((e) => e.action === 'task.status')).toHaveLength(before.audit);
      expect(events).toHaveLength(before.events);
    });

    it('audits and announces each move', async () => {
      const { create, body, move, auditStore, events } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      expect(auditStore.find((e) => e.action === 'task.status')[0]?.changes).toEqual({
        status: { from: 'todo', to: 'in_progress' },
      });
      expect(events.at(-1)).toMatchObject({
        type: 'tasks.status_changed',
        payload: { taskId, from: 'todo', to: 'in_progress' },
      });
    });

    it('lets a manager who did not assign the task see it but not move it (403), and a stranger neither (404)', async () => {
      const { create, body, move } = await setup();
      const taskId = (await create('admin', body('staff'))).body.data.id as string;
      expect((await move('team_lead', taskId, 'in_progress')).status).toBe(403); // manages the assignee
      expect((await move('hr_manager', taskId, 'in_progress')).status).toBe(404);
      expect((await move('staff', taskId, 'in_progress')).status).toBe(200);
    });

    it('rejects an unknown status and a body with more than the status with 400', async () => {
      const { as, create, body } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      const url = `/api/v1/tasks/${taskId}/status`;
      expect((await as.staff.post(url, { status: 'done' })).status).toBe(400);
      expect(
        (await as.staff.post(url, { status: 'in_progress', assigneeEmployeeId: MISSING })).status,
      ).toBe(400);
      expect(
        (await as.staff.post(`/api/v1/tasks/${MISSING}/status`, { status: 'in_progress' })).status,
      ).toBe(404);
    });
  });

  describe('editing', () => {
    it('lets the assigner edit, bumps the version, keeps text out of the audit trail', async () => {
      const { as, create, body, auditStore } = await setup();
      const made = await create('team_lead', body('staff'));
      const url = `/api/v1/tasks/${made.body.data.id}`;
      const res = await as.team_lead.put(url, {
        title: 'A secret client name',
        priority: 'urgent',
        dueDate: '2026-12-01',
        version: 1,
      });
      expect(res.body.data).toMatchObject({
        title: 'A secret client name',
        priority: 'urgent',
        version: 2,
      });
      const entry = auditStore.find((e) => e.action === 'task.update')[0];
      expect(entry?.changes).toMatchObject({
        priority: { from: 'medium', to: 'urgent' },
        title: { from: '[changed]' },
      });
      expect(JSON.stringify(entry)).not.toContain('secret client');
    });

    it('does not let the assignee, or a manager who did not assign it, edit (403)', async () => {
      const { as, create, body } = await setup();
      const adminsTask = (await create('admin', body('staff'))).body.data.id as string;
      expect(
        (await as.team_lead.put(`/api/v1/tasks/${adminsTask}`, { title: 'x', version: 1 })).status,
      ).toBe(403);
      const leadsTask = (await create('team_lead', body('staff'))).body.data.id as string;
      expect(
        (await as.staff.put(`/api/v1/tasks/${leadsTask}`, { title: 'x', version: 1 })).status,
      ).toBe(403);
      expect(
        (await as.admin.put(`/api/v1/tasks/${leadsTask}`, { title: 'x', version: 1 })).status,
      ).toBe(200);
    });

    it('restarts a reassigned task as todo for the new person, within the team, and announces it', async () => {
      const { as, create, body, move, id, events } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      await move('staff', taskId, 'in_progress');
      const res = await as.team_lead.put(`/api/v1/tasks/${taskId}`, {
        assigneeEmployeeId: id('team_lead'),
        version: 2,
      });
      expect(res.body.data).toMatchObject({ assigneeEmployeeId: id('team_lead'), status: 'todo' });
      expect(events.filter((e) => e.type === 'tasks.assigned')).toHaveLength(2);
      const outside = await as.team_lead.put(`/api/v1/tasks/${taskId}`, {
        assigneeEmployeeId: id('hr_manager'),
        version: 3,
      });
      expect(outside.status).toBe(403);
    });

    it('refuses a stale version with 409, a completed task with 422, and nothing to change with 400', async () => {
      const { as, create, body, move } = await setup();
      const taskId = (await create('team_lead', body('staff'))).body.data.id as string;
      const url = `/api/v1/tasks/${taskId}`;
      await as.team_lead.put(url, { title: 'First', version: 1 });
      expect((await as.team_lead.put(url, { title: 'Second', version: 1 })).status).toBe(409);
      expect((await as.team_lead.put(url, { version: 2 })).status).toBe(400);
      await move('staff', taskId, 'in_progress');
      await move('staff', taskId, 'in_review');
      await move('team_lead', taskId, 'completed');
      expect((await as.team_lead.put(url, { title: 'Late', version: 5 })).status).toBe(422);
    });

    it('writes nothing when nothing differs, and refuses a new due date in the past', async () => {
      const { as, create, body, auditStore } = await setup();
      const made = await create(
        'team_lead',
        body('staff', { title: 'Same', dueDate: '2026-11-20' }),
      );
      const url = `/api/v1/tasks/${made.body.data.id}`;
      const same = await as.team_lead.put(url, {
        title: 'Same',
        dueDate: '2026-11-20',
        version: 1,
      });
      expect(same.body.data.version).toBe(1);
      expect(auditStore.find((e) => e.action === 'task.update')).toHaveLength(0);
      expect((await as.team_lead.put(url, { dueDate: '2026-10-01', version: 1 })).status).toBe(422);
      const cleared = await as.team_lead.put(url, { dueDate: null, version: 1 });
      expect(cleared.body.data.dueDate).toBeNull();
    });
  });

  describe('reading', () => {
    it('/me lists only tasks assigned to the caller, open work first and soonest due first', async () => {
      const { as, create, body, move } = await setup();
      await create('team_lead', body('staff', { title: 'Later', dueDate: '2026-12-10' }));
      await create('team_lead', body('staff', { title: 'Sooner', dueDate: '2026-11-05' }));
      await create('team_lead', body('staff', { title: 'Undated' }));
      const done = await create(
        'team_lead',
        body('staff', { title: 'Done', dueDate: '2026-11-01' }),
      );
      await create('team_lead', body('team_lead', { title: 'Not Sam’s' }));
      for (const status of ['in_progress', 'in_review'])
        await move('staff', done.body.data.id, status);
      await move('team_lead', done.body.data.id, 'completed');
      const res = await as.staff.get('/api/v1/tasks/me');
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual([
        'Sooner',
        'Later',
        'Undated',
        'Done',
      ]);
      expect(res.body.meta.total).toBe(4);
    });

    it('flags and filters overdue tasks on the company date, and not completed ones', async () => {
      const { as, create, body, repo } = await setup();
      const due = await create('team_lead', body('staff', { title: 'Due', dueDate: '2026-11-05' }));
      await create('team_lead', body('staff', { title: 'Fine', dueDate: '2026-11-30' }));
      const stored = repo.tasks.find((t) => t.id === due.body.data.id);
      if (stored) stored.dueDate = '2026-10-30'; // it has gone past due since it was made
      const all = await as.staff.get('/api/v1/tasks/me');
      expect(all.body.data.find((t: { title: string }) => t.title === 'Due').isOverdue).toBe(true);
      expect(all.body.data.find((t: { title: string }) => t.title === 'Fine').isOverdue).toBe(
        false,
      );
      const overdue = await as.staff.get('/api/v1/tasks/me?overdue=true');
      expect(overdue.body.data.map((t: { title: string }) => t.title)).toEqual(['Due']);
    });

    it('filters by status, priority and project, and pages', async () => {
      const { as, create, body, move } = await setup();
      const a = await create(
        'team_lead',
        body('staff', { title: 'A', priority: 'high', projectId: PROJECT }),
      );
      await create('team_lead', body('staff', { title: 'B', priority: 'low' }));
      await move('staff', a.body.data.id, 'in_progress');
      const titles = async (q: string) =>
        (await as.staff.get(`/api/v1/tasks/me${q}`)).body.data.map(
          (t: { title: string }) => t.title,
        );
      expect(await titles('?status=in_progress')).toEqual(['A']);
      expect(await titles('?priority=low')).toEqual(['B']);
      expect(await titles(`?projectId=${PROJECT}`)).toEqual(['A']);
      expect(await titles('?pageSize=1&page=2')).toHaveLength(1);
      expect((await as.staff.get('/api/v1/tasks/me?status=done')).status).toBe(400);
      expect((await as.staff.get('/api/v1/tasks/me?assigneeEmployeeId=x')).status).toBe(400);
    });

    it.each([
      ['admin', 200],
      ['team_lead', 200],
      ['hr_manager', 403],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s reading the team board gets %i', async (role, status) => {
      const { as } = await setup();
      expect((await as[role].get('/api/v1/tasks')).status).toBe(status);
    });

    it('shows a Team Lead the tasks they assigned and their reports’ tasks, and an Admin every task', async () => {
      const { as, create, body, id } = await setup();
      await create('team_lead', body('staff', { title: 'By lead for staff' }));
      await create('team_lead', body('team_lead', { title: 'By lead for lead' }));
      await create('admin', body('staff', { title: 'By admin for staff' }));
      await create('admin', body('hr_manager', { title: 'By admin for HR' }));
      const titles = async (who: Role) =>
        (await as[who].get('/api/v1/tasks')).body.data
          .map((t: { title: string }) => t.title)
          .sort();
      expect(await titles('team_lead')).toEqual([
        'By admin for staff',
        'By lead for lead',
        'By lead for staff',
      ]);
      expect(await titles('admin')).toHaveLength(4);
      const forStaff = await as.team_lead.get(`/api/v1/tasks?assigneeEmployeeId=${id('staff')}`);
      expect(forStaff.body.data).toHaveLength(2);
    });

    it('shows one task to its assignee, its assigner, the assignee’s manager and an Admin, and to nobody else', async () => {
      const { as, create, body } = await setup();
      const hrTask = (await create('admin', body('hr_manager'))).body.data.id as string;
      expect((await as.hr_manager.get(`/api/v1/tasks/${hrTask}`)).status).toBe(200);
      expect((await as.admin.get(`/api/v1/tasks/${hrTask}`)).status).toBe(200);
      expectNoExistenceLeak(
        await as.team_lead.get(`/api/v1/tasks/${hrTask}`),
        await as.team_lead.get(`/api/v1/tasks/${MISSING}`),
      );
      expect((await as.staff.get(`/api/v1/tasks/${hrTask}`)).status).toBe(404);
      const staffTask = (await create('team_lead', body('staff'))).body.data.id as string;
      for (const who of ['staff', 'team_lead', 'admin'] as Role[]) {
        expect((await as[who].get(`/api/v1/tasks/${staffTask}`)).status, who).toBe(200);
      }
      expect((await as.hr_manager.get(`/api/v1/tasks/${staffTask}`)).status).toBe(404);
      expect((await as.staff.get('/api/v1/tasks/not-a-uuid')).status).toBe(400);
    });
  });
});
