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
import { ALL_ROLES, SignedIn, expectNoExistenceLeak, signInAs } from '../rbac/rbac.testing';
import { createApprovals } from './index';
import { MemoryApprovalsRepository } from './approvals.repository.memory';
import { Approval, ApprovalStage } from './approvals.types';

const subject = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryApprovalsRepository();
  const approvals = createApprovals({
    platform,
    authenticate: kit.auth.authenticate,
    repository: repo,
  });
  const applied: string[] = [];
  approvals.service.registerHandler({
    subjectType: 'leave_request',
    async apply(_tx, approval, outcome) {
      applied.push(`${approval.subjectId}:${outcome}`);
    },
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/approvals', approvals.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  const staffEmployee = kit.users.staff.employeeId;
  const leadEmployee = kit.users.team_lead.employeeId;
  repo.requesters[staffEmployee] = {
    name: 'Sam Staff',
    managerId: leadEmployee,
    roles: [ROLES.STAFF],
  };
  repo.requesters['e-outsider'] = {
    name: 'Olive Outsider',
    managerId: 'e-someone-else',
    roles: [ROLES.STAFF],
  };
  repo.requesters[kit.users.hr_manager.employeeId] = {
    name: 'Hana HR',
    managerId: null,
    roles: [ROLES.HR_MANAGER],
  };

  const open = (n: number, requester: string, stages: ApprovalStage[]): Promise<Approval> =>
    repo.transaction((tx) =>
      approvals.service.submit(tx, {
        subjectType: 'leave_request',
        subjectId: subject(n),
        requesterEmployeeId: requester,
        stages,
      }),
    );
  return { app, as, repo, applied, auditStore, kit, open, staffEmployee };
}

describe('approvals API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    const id = subject(1);
    for (const [method, path] of [
      ['get', '/api/v1/approvals'],
      ['get', `/api/v1/approvals/${id}`],
      ['post', `/api/v1/approvals/${id}/approve`],
      ['post', `/api/v1/approvals/${id}/reject`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('has no route that creates an approval, even for the Admin', async () => {
    const { as } = await setup();
    expect((await as.admin.post('/api/v1/approvals', {})).status).toBe(404);
  });

  it.each([
    ['admin', 3],
    ['hr_manager', 3],
    ['team_lead', 1],
    ['staff', 1],
  ] as const)('%s lists %i approval(s): their scope, nothing more', async (role, count) => {
    const s = await setup();
    await s.open(1, s.staffEmployee, ['manager']);
    await s.open(2, 'e-outsider', ['hr']);
    await s.open(3, s.kit.users.hr_manager.employeeId, ['hr']);
    const res = await s.as[role].get('/api/v1/approvals');
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(count);
  });

  it('Staff see only their own request, and Team Leads only their team', async () => {
    const s = await setup();
    await s.open(1, s.staffEmployee, ['manager']);
    await s.open(2, 'e-outsider', ['hr']);
    const staff = await s.as.staff.get('/api/v1/approvals');
    expect(staff.body.data.map((a: Approval) => a.subjectId)).toEqual([subject(1)]);
    const lead = await s.as.team_lead.get('/api/v1/approvals');
    expect(lead.body.data.map((a: Approval) => a.subjectId)).toEqual([subject(1)]);
  });

  it('a record outside the scope looks exactly like one that does not exist', async () => {
    const s = await setup();
    const outsider = await s.open(1, 'e-outsider', ['hr']);
    const hidden = await s.as.team_lead.get(`/api/v1/approvals/${outsider.id}`);
    const missing = await s.as.team_lead.get(`/api/v1/approvals/${subject(99)}`);
    expectNoExistenceLeak(hidden, missing);
    const hiddenDecision = await s.as.team_lead.post(`/api/v1/approvals/${outsider.id}/approve`);
    expect(hiddenDecision.status).toBe(404);
  });

  it('awaitingMyDecision narrows the inbox to what waits for the caller', async () => {
    const s = await setup();
    await s.open(1, s.staffEmployee, ['manager']);
    await s.open(2, 'e-outsider', ['hr']);
    const lead = await s.as.team_lead.get('/api/v1/approvals?awaitingMyDecision=true');
    expect(lead.body.data.map((a: Approval) => a.subjectId)).toEqual([subject(1)]);
    const hr = await s.as.hr_manager.get('/api/v1/approvals?awaitingMyDecision=true');
    expect(hr.body.data.map((a: Approval) => a.subjectId)).toEqual([subject(2)]);
  });

  it.each(['status=done', 'awaitingMyDecision=yes', 'pageSize=1000', 'bogus=1'])(
    'rejects the query %s',
    async (qs) => {
      const { as } = await setup();
      expect((await as.admin.get(`/api/v1/approvals?${qs}`)).status).toBe(400);
    },
  );
});

describe('approvals API: deciding', () => {
  it('Staff cannot decide at all', async () => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager']);
    expect((await s.as.staff.post(`/api/v1/approvals/${a.id}/approve`)).status).toBe(403);
    expect(s.applied).toHaveLength(0);
  });

  it('the manager approves, the handler runs, and the audit entry is written', async () => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager']);
    const res = await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`, {
      comment: 'Enjoy',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'approved' });
    expect(s.applied).toEqual([`${subject(1)}:approved`]);
    expect(s.auditStore.find((e) => e.action === 'approvals.approve')).toMatchObject([
      { outcome: 'success', actorId: s.as.team_lead.userId },
    ]);
  });

  it('HR cannot decide a manager step, and an HR Manager cannot decide their own request', async () => {
    const s = await setup();
    const manager = await s.open(1, s.staffEmployee, ['manager']);
    expect((await s.as.hr_manager.post(`/api/v1/approvals/${manager.id}/approve`)).status).toBe(
      403,
    );
    const own = await s.open(2, s.kit.users.hr_manager.employeeId, ['hr']);
    expect((await s.as.hr_manager.post(`/api/v1/approvals/${own.id}/approve`)).status).toBe(403);
    expect((await s.as.admin.post(`/api/v1/approvals/${own.id}/approve`)).status).toBe(200);
  });

  it('a two-step route needs the manager and then HR', async () => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager', 'hr']);
    const first = await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`);
    expect(first.body.data).toMatchObject({ status: 'pending', currentStage: 1 });
    expect(s.applied).toHaveLength(0);
    expect((await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`)).status).toBe(403);
    const second = await s.as.hr_manager.post(`/api/v1/approvals/${a.id}/approve`);
    expect(second.body.data).toMatchObject({ status: 'approved' });
    expect(s.applied).toHaveLength(1);
  });

  it('a rejection needs a comment', async () => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager']);
    expect((await s.as.team_lead.post(`/api/v1/approvals/${a.id}/reject`, {})).status).toBe(400);
    expect(
      (await s.as.team_lead.post(`/api/v1/approvals/${a.id}/reject`, { comment: '   ' })).status,
    ).toBe(400);
    const ok = await s.as.team_lead.post(`/api/v1/approvals/${a.id}/reject`, {
      comment: 'Busy week',
    });
    expect(ok.body.data).toMatchObject({ status: 'rejected' });
    expect(s.applied).toEqual([`${subject(1)}:rejected`]);
  });

  it('repeating a decision is a 200, the opposite decision is a 409', async () => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager']);
    await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`);
    expect((await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`)).status).toBe(200);
    expect(s.applied).toHaveLength(1);
    expect(
      (
        await s.as.team_lead.post(`/api/v1/approvals/${a.id}/reject`, {
          comment: 'changed my mind',
        })
      ).status,
    ).toBe(409);
  });

  it.each([
    ['an unknown field', { comment: 'x', status: 'approved' }],
    ['a comment over 500 characters', { comment: 'x'.repeat(501) }],
  ])('rejects %s with 400 and decides nothing', async (_n, body) => {
    const s = await setup();
    const a = await s.open(1, s.staffEmployee, ['manager']);
    expect((await s.as.team_lead.post(`/api/v1/approvals/${a.id}/approve`, body)).status).toBe(400);
    expect(s.applied).toHaveLength(0);
  });

  it('rejects a malformed id with 400', async () => {
    const { as } = await setup();
    expect((await as.admin.post('/api/v1/approvals/not-a-uuid/approve')).status).toBe(400);
  });
});
