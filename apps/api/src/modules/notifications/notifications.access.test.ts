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
import { createNotifications } from './index';
import { MemoryNotificationsRepository } from './notifications.repository.memory';

const MISSING = '85000000-0000-4000-8000-000000000999';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore, outbox } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryNotificationsRepository();
  for (const role of ALL_ROLES) {
    repo.employees[kit.users[role].employeeId] = {
      email: `${role}@maxr.internal`,
      managerId: null,
      isHrApprover: false,
      active: true,
    };
  }
  const notifications = createNotifications({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    repository: repo,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/notifications', notifications.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const give = (role: Role, title = 'Leave request approved') =>
    repo.insert({
      recipientEmployeeId: kit.users[role].employeeId,
      type: 'approval.approved',
      title,
      body: 'Open it to see the details.',
      link: '/approvals/x',
      dedupeKey: `k${++n}`,
    });
  const announce = (who: Role, body: object) =>
    as[who]
      .post('/api/v1/notifications/announcements', body)
      .set('Idempotency-Key', `announce-${who}-${++n}-abcdefgh`);
  return { app, as, kit, repo, give, announce, auditStore, outbox };
}

describe('notifications API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/notifications'],
      ['post', '/api/v1/notifications/read-all'],
      ['post', '/api/v1/notifications/announcements'],
      ['post', `/api/v1/notifications/${MISSING}/read`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.startsWith('/api/v1/notifications'));
    expect(routes).toHaveLength(4);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe('reading', () => {
    it.each(ALL_ROLES)('%s reads only their own notifications', async (role) => {
      const { as, give } = await setup();
      for (const other of ALL_ROLES) await give(other, `For ${other}`);
      const res = await as[role].get('/api/v1/notifications');
      expect(res.status).toBe(200);
      expect(res.body.data.map((x: { title: string }) => x.title)).toEqual([`For ${role}`]);
      expect(res.body.meta).toMatchObject({ total: 1, unread: 1 });
    });

    it('lists newest first, pages, and filters unread', async () => {
      const { as, give, repo } = await setup();
      let tick = 0;
      repo.now = () => new Date(Date.UTC(2026, 10, 1, 0, 0, tick++));
      const first = await give('staff', 'first');
      await give('staff', 'second');
      await give('staff', 'third');
      await as.staff.post(`/api/v1/notifications/${first?.id}/read`);
      const all = await as.staff.get('/api/v1/notifications');
      expect(all.body.data.map((x: { title: string }) => x.title)).toEqual([
        'third',
        'second',
        'first',
      ]);
      expect(all.body.meta).toMatchObject({ total: 3, unread: 2 });
      const unread = await as.staff.get('/api/v1/notifications?unread=true');
      expect(unread.body.data.map((x: { title: string }) => x.title)).toEqual(['third', 'second']);
      expect(unread.body.meta).toMatchObject({ total: 2, unread: 2 });
      const page = await as.staff.get('/api/v1/notifications?pageSize=1&page=2');
      expect(page.body.data.map((x: { title: string }) => x.title)).toEqual(['second']);
    });

    it.each([
      ['an unknown filter', '?status=read'],
      ['a page size over the maximum', '?pageSize=1000'],
      ['page zero', '?page=0'],
      ['a bad unread value', '?unread=maybe'],
    ])('rejects %s with 400', async (_name, query) => {
      const { as } = await setup();
      expect((await as.staff.get(`/api/v1/notifications${query}`)).status).toBe(400);
    });
  });

  describe('marking read', () => {
    it('marks one of your own read, and repeating it keeps the first time', async () => {
      const { as, give, repo } = await setup();
      const made = await give('staff');
      repo.now = () => new Date('2026-11-01T00:00:00Z');
      const first = await as.staff.post(`/api/v1/notifications/${made?.id}/read`);
      expect(first.status).toBe(200);
      expect(first.body.data.readAt).toBe('2026-11-01T00:00:00.000Z');
      repo.now = () => new Date('2026-11-02T00:00:00Z');
      const again = await as.staff.post(`/api/v1/notifications/${made?.id}/read`);
      expect(again.body.data.readAt).toBe('2026-11-01T00:00:00.000Z');
      expect((await as.staff.get('/api/v1/notifications')).body.meta.unread).toBe(0);
    });

    it('someone else\\u2019s notification is a 404 identical to a missing one, and stays unread', async () => {
      const { as, give, repo } = await setup();
      const leads = await give('team_lead');
      expectNoExistenceLeak(
        await as.staff.post(`/api/v1/notifications/${leads?.id}/read`),
        await as.staff.post(`/api/v1/notifications/${MISSING}/read`),
      );
      expect(repo.rows.find((r) => r.id === leads?.id)?.readAt).toBeNull();
      expect((await as.staff.post('/api/v1/notifications/not-a-uuid/read')).status).toBe(400);
    });

    it('marks all of your own read and nobody else\\u2019s', async () => {
      const { as, give } = await setup();
      await give('staff');
      await give('staff');
      await give('team_lead');
      const res = await as.staff.post('/api/v1/notifications/read-all');
      expect(res.body.data).toEqual({ updated: 2 });
      expect((await as.staff.get('/api/v1/notifications')).body.meta.unread).toBe(0);
      expect((await as.team_lead.get('/api/v1/notifications')).body.meta.unread).toBe(1);
      expect((await as.staff.post('/api/v1/notifications/read-all')).body.data).toEqual({
        updated: 0,
      });
    });
  });

  describe('announcements', () => {
    const body = {
      title: 'Office closed on Friday',
      message: 'The office is closed for maintenance.',
    };

    it.each([
      ['admin', 201],
      ['hr_manager', 403],
      ['team_lead', 403],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s sending an announcement gets %i', async (role, status) => {
      const { announce } = await setup();
      expect((await announce(role, body)).status).toBe(status);
    });

    it('reaches every active employee in the app and is not e-mailed', async () => {
      const { as, announce, repo, kit, outbox } = await setup();
      const gone = repo.employees[kit.users.staff.employeeId];
      if (gone) gone.active = false;
      const res = await announce('admin', body);
      expect(res.body.data).toEqual({ recipients: ALL_ROLES.length - 1 });
      const mine = await as.team_lead.get('/api/v1/notifications');
      expect(mine.body.data[0]).toMatchObject({
        type: 'announcement',
        title: body.title,
        body: body.message,
        link: null,
      });
      expect((await as.staff.get('/api/v1/notifications')).body.data).toHaveLength(0);
      expect(await outbox.claimDue(10, new Date(Date.now() + 60_000), 60_000)).toHaveLength(0);
    });

    it('is audited without its text, and a retry with the same key sends it once', async () => {
      const { as, auditStore, repo } = await setup();
      const send = () =>
        as.admin
          .post('/api/v1/notifications/announcements', body)
          .set('Idempotency-Key', 'announce-retry-12345678');
      const first = await send();
      const second = await send();
      expect(second.body).toEqual(first.body);
      expect(repo.rows).toHaveLength(ALL_ROLES.length);
      const entries = auditStore.find((e) => e.action === 'notification.announce');
      expect(entries).toHaveLength(1);
      expect(entries[0]?.metadata).toEqual({ recipients: ALL_ROLES.length });
      expect(JSON.stringify(entries[0])).not.toContain('maintenance');
    });

    it('needs an Idempotency-Key', async () => {
      const { as } = await setup();
      expect((await as.admin.post('/api/v1/notifications/announcements', body)).status).toBe(400);
    });

    it.each([
      ['a blank title', { title: '  ' }],
      ['a title over 100 characters', { title: 'x'.repeat(101) }],
      ['a message over 1000 characters', { message: 'x'.repeat(1001) }],
      ['no message', { message: undefined }],
      ['an unknown field', { recipients: ['x'] }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { announce } = await setup();
      expect((await announce('admin', { ...body, ...patch })).status).toBe(400);
    });
  });
});
