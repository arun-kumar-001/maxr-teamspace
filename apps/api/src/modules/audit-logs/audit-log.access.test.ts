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
import { createAuditLogs } from './index';
import { MemoryAuditLogRepository } from './audit-log.repository.memory';
import { AuditLogItem } from './audit-log.types';

const actorId = '60000000-0000-4000-8000-000000000001';
const row = (n: number, overrides: Partial<AuditLogItem> = {}): AuditLogItem => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  occurredAt: new Date(Date.UTC(2026, 9, 30, 8, n)).toISOString(),
  action: 'leave.approve',
  outcome: 'success',
  actor: { id: actorId, name: 'Priya Sharma', role: 'hr_manager' },
  entityType: 'leave_request',
  entityId: `req-${n}`,
  requestId: `rid-${n}`,
  changes: { status: { from: 'pending', to: 'approved' } },
  metadata: null,
  ...overrides,
});

async function setup(rows: AuditLogItem[] = []) {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryAuditLogRepository(rows);
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/audit-logs',
    createAuditLogs({ authenticate: kit.auth.authenticate, repository: repo }).router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo };
}

describe('audit log viewer: access', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/audit-logs')).status).toBe(401);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s reading the audit trail gets %i', async (role, status) => {
    const { as } = await setup([row(1)]);
    expect((await as[role].get('/api/v1/audit-logs')).status).toBe(status);
  });

  it('has no way to write: every other method is a plain 404, even for the Admin', async () => {
    const { as, repo } = await setup([row(1)]);
    const before = JSON.stringify(repo.rows);
    for (const res of [
      await as.admin.post('/api/v1/audit-logs', { action: 'x.y' }),
      await as.admin.put('/api/v1/audit-logs', { action: 'x.y' }),
      await as.admin.delete('/api/v1/audit-logs'),
      await as.admin.put(`/api/v1/audit-logs/${row(1).id}`, {}),
      await as.admin.delete(`/api/v1/audit-logs/${row(1).id}`),
    ]) {
      expect(res.status).toBe(404);
    }
    expect(JSON.stringify(repo.rows)).toBe(before);
  });
});

describe('audit log viewer: filters, paging and output', () => {
  it('returns entries newest first with the actor and a stable page meta', async () => {
    const { as } = await setup([row(1), row(2), row(3)]);
    const res = await as.admin.get('/api/v1/audit-logs?pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data.map((e: AuditLogItem) => e.entityId)).toEqual(['req-3', 'req-2']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(res.body.data[0].actor).toEqual({
      id: actorId,
      name: 'Priya Sharma',
      role: 'hr_manager',
    });
  });

  it('pages without repeating or skipping entries that share a timestamp', async () => {
    const same = new Date(Date.UTC(2026, 9, 30, 9, 0)).toISOString();
    const { as } = await setup(
      Array.from({ length: 5 }, (_, i) => row(i + 1, { occurredAt: same })),
    );
    const ids: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await as.admin.get(`/api/v1/audit-logs?pageSize=2&page=${page}`);
      ids.push(...res.body.data.map((e: AuditLogItem) => e.id));
    }
    expect(new Set(ids).size).toBe(5);
  });

  it('filters by actor, exact action, module, entity, outcome and date range', async () => {
    const other = '60000000-0000-4000-8000-000000000002';
    const { as } = await setup([
      row(1),
      row(2, { action: 'leave.reject', outcome: 'denied' }),
      row(3, {
        action: 'employee.update',
        entityType: 'employee',
        entityId: 'emp-9',
        actor: { id: other, name: null, role: 'admin' },
      }),
      row(4, { action: 'audit_logs.list' }),
    ]);
    const ids = async (qs: string) =>
      (await as.admin.get(`/api/v1/audit-logs?${qs}`)).body.data
        .map((e: AuditLogItem) => e.entityId)
        .sort();
    expect(await ids(`actorId=${other}`)).toEqual(['emp-9']);
    expect(await ids('action=leave.reject')).toEqual(['req-2']);
    expect(await ids('module=leave')).toEqual(['req-1', 'req-2']);
    expect(await ids('module=audit_logs')).toEqual(['req-4']);
    expect(await ids('entityType=employee&entityId=emp-9')).toEqual(['emp-9']);
    expect(await ids('outcome=denied')).toEqual(['req-2']);
    // from is inclusive, to is exclusive: 08:02 up to (not including) 08:04
    expect(await ids('from=2026-10-30T08:02:00Z&to=2026-10-30T08:04:00Z')).toEqual([
      'emp-9',
      'req-2',
    ]);
  });

  it('never returns a sensitive value, even one stored unredacted', async () => {
    const { as } = await setup([
      row(1, {
        metadata: { password: 'hunter2', note: 'ok' },
        changes: { bankAccount: '123456', status: 'x' },
      }),
    ]);
    const body = JSON.stringify((await as.admin.get('/api/v1/audit-logs')).body);
    expect(body).not.toContain('hunter2');
    expect(body).not.toContain('123456');
    expect(body).toContain('"note":"ok"');
  });

  it.each([
    ['unknown key', 'bogus=1'],
    ['bad page size', 'pageSize=101'],
    ['zero page', 'page=0'],
    ['bad actor id', 'actorId=not-a-uuid'],
    ['bad action', 'action=Leave'],
    ['action and module together', 'action=leave.approve&module=leave'],
    ['bad module', 'module=le%25'],
    ['bad outcome', 'outcome=maybe'],
    ['bad date', 'from=yesterday'],
    ['reversed range', 'from=2026-10-31T00:00:00Z&to=2026-10-30T00:00:00Z'],
    ['bad sort order', 'sortOrder=sideways'],
  ])('rejects %s with 400', async (_label, qs) => {
    const { as } = await setup();
    expect((await as.admin.get(`/api/v1/audit-logs?${qs}`)).status).toBe(400);
  });
});
