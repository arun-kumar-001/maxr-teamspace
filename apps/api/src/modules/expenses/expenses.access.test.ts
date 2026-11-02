import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../http/idempotency';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createApprovals } from '../approvals';
import { MemoryApprovalsRepository } from '../approvals/approvals.repository.memory';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, agentAs, expectNoExistenceLeak, listRoutes } from '../rbac/rbac.testing';
import { MemoryExpensesRepository } from './expenses.repository.memory';
import { createExpenses } from './index';

const TRAVEL = '8c000000-0000-4000-8000-000000000001';
const LEGACY = '8c000000-0000-4000-8000-000000000002';
const MISSING = '8c000000-0000-4000-8000-000000000999';
// 31 October 2026, 10:00 UTC: 15:30 in Asia/Kolkata, so the company's today is 31 October.
const NOW = new Date('2026-10-31T10:00:00Z');
const TODAY = '2026-10-31';
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200)]);

type SignedInAgent = Awaited<ReturnType<typeof agentAs>>;
type JsonAgent = ReturnType<typeof jsonAgent>;

/** The agent that also takes a JSON body on `post`; uploads use `post(path)` and send the raw file. */
function jsonAgent(agent: SignedInAgent) {
  return {
    get: (path: string) => agent.get(path),
    post: (path: string, body?: object) =>
      body === undefined ? agent.post(path) : agent.post(path).send(body),
  };
}

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;
  const lead = id(ROLES.TEAM_LEAD);

  // Staff report to the Team Lead; the Team Lead, HR and Admin have no manager in the route.
  const approvalsRepo = new MemoryApprovalsRepository();
  const approvals = createApprovals({
    platform,
    authenticate: kit.auth.authenticate,
    repository: approvalsRepo,
  });
  const repo = new MemoryExpensesRepository([
    { id: TRAVEL, code: 'travel', name: 'Travel', isActive: true },
    { id: LEGACY, code: 'legacy', name: 'Legacy', isActive: false },
  ]);
  for (const role of ALL_ROLES) {
    const employee = id(role);
    approvalsRepo.requesters[employee] = {
      name: `${role} person`,
      managerId: role === ROLES.STAFF ? lead : null,
      roles: [role],
    };
    repo.names[employee] = `${role} person`;
    repo.managerOf[employee] = role === ROLES.STAFF ? lead : null;
  }
  // The admin reports to HR, so the Team Lead must not see the admin's claims.
  repo.managerOf[id(ROLES.ADMIN)] = id(ROLES.HR_MANAGER);

  const expenses = createExpenses({
    platform,
    approvals: approvals.service,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () => ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }),
    } as never,
    repository: repo,
    clock: () => NOW,
  });

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/expense-claims', expenses.claimsRouter);
  app.use('/api/v1/expense-categories', expenses.categoriesRouter);
  app.use('/api/v1/approvals', approvals.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));

  const agents = {} as Record<Role, JsonAgent>;
  for (const role of ALL_ROLES) agents[role] = jsonAgent(await agentAs(app, kit, role));

  let n = 0;
  const key = () => `exp-key-${++n}-abcdefgh`;
  const claim = (who: Role, body: object = {}) =>
    agents[who]
      .post('/api/v1/expense-claims', {
        categoryId: TRAVEL,
        expenseDate: TODAY,
        amountMinor: 15000,
        ...body,
      })
      .set('Idempotency-Key', key());
  const attach = (who: Role, claimId: string, body: Buffer = PDF, name = 'receipt.pdf') =>
    agents[who]
      .post(`/api/v1/expense-claims/${claimId}/receipt`)
      .set('Content-Type', 'application/pdf')
      .set('X-Filename', encodeURIComponent(name))
      .send(body);
  const submit = (who: Role, claimId: string) =>
    agents[who].post(`/api/v1/expense-claims/${claimId}/submit`);
  const decide = (who: Role, approvalId: string, outcome: 'approve' | 'reject') =>
    agents[who].post(`/api/v1/approvals/${approvalId}/${outcome}`, { comment: 'checked' });
  const createdId = async (who: Role, body?: object) =>
    (await claim(who, body)).body.data.id as string;
  const submitted = async (who: Role, body?: object) => {
    const claimId = await createdId(who, body);
    const res = await submit(who, claimId);
    return { claimId, approvalId: res.body.data.approvalId as string, res };
  };

  return {
    app,
    agents,
    kit,
    id,
    repo,
    auditStore,
    claim,
    attach,
    submit,
    decide,
    createdId,
    submitted,
    expenses,
  };
}

describe('expense claims API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/expense-claims/me'],
      ['get', '/api/v1/expense-claims'],
      ['post', '/api/v1/expense-claims'],
      ['get', `/api/v1/expense-claims/${MISSING}`],
      ['post', `/api/v1/expense-claims/${MISSING}/receipt`],
      ['get', `/api/v1/expense-claims/${MISSING}/receipt/download-link`],
      ['post', `/api/v1/expense-claims/${MISSING}/submit`],
      ['post', `/api/v1/expense-claims/${MISSING}/cancel`],
      ['post', `/api/v1/expense-claims/${MISSING}/reimburse`],
      ['get', '/api/v1/expense-categories'],
      ['post', '/api/v1/expense-categories'],
      ['post', `/api/v1/expense-categories/${MISSING}/deactivate`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every expense route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.includes('/api/v1/expense'));
    expect(routes.length).toBeGreaterThanOrEqual(12);
    for (const route of routes) {
      expect(route.access[0]?.type, `${route.method} ${route.path}`).toBe('permission');
    }
  });

  it('staff submit and read their own claims, but do not review, reimburse or manage categories', async () => {
    const { agents, claim, submit } = await setup();
    const created = await claim('staff');
    expect(created.status).toBe(201);
    expect((await agents.staff.get('/api/v1/expense-claims/me')).status).toBe(200);
    expect((await agents.staff.get('/api/v1/expense-claims')).status).toBe(403);
    expect(
      (await agents.staff.post(`/api/v1/expense-claims/${created.body.data.id}/reimburse`)).status,
    ).toBe(403);
    expect(
      (await agents.staff.post('/api/v1/expense-categories', { code: 'x', name: 'X' })).status,
    ).toBe(403);
    expect((await agents.staff.get('/api/v1/expense-categories')).status).toBe(200);
    expect((await submit('staff', created.body.data.id)).status).toBe(200);
  });

  it('the Team Lead reviews the list but cannot reimburse or manage categories', async () => {
    const { agents, createdId } = await setup();
    const claimId = await createdId('staff');
    expect((await agents.team_lead.get('/api/v1/expense-claims')).status).toBe(200);
    expect(
      (await agents.team_lead.post(`/api/v1/expense-claims/${claimId}/reimburse`)).status,
    ).toBe(403);
    expect(
      (await agents.team_lead.post('/api/v1/expense-categories', { code: 'x', name: 'X' })).status,
    ).toBe(403);
  });
});

describe('expense claims API: the claim window, amounts and categories', () => {
  it('rejects a future date and a date older than 60 days, and accepts exactly 60 days back', async () => {
    const { claim } = await setup();
    expect((await claim('staff', { expenseDate: '2026-11-01' })).status).toBe(422);
    expect((await claim('staff', { expenseDate: '2026-08-31' })).status).toBe(422);
    expect((await claim('staff', { expenseDate: '2026-09-01' })).status).toBe(201);
  });

  it('rejects an inactive category and amounts outside 1 to 100,000.00', async () => {
    const { claim } = await setup();
    expect(
      (await claim('staff', { categoryId: '8c000000-0000-4000-8000-000000000002' })).status,
    ).toBe(422);
    expect((await claim('staff', { amountMinor: 0 })).status).toBe(400);
    expect((await claim('staff', { amountMinor: 10_000_001 })).status).toBe(400);
    expect((await claim('staff', { amountMinor: 12.5 })).status).toBe(400);
    expect((await claim('staff', { unknown: true })).status).toBe(400);
  });

  it('needs a receipt above 200.00 INR before submission, and not at exactly 200.00', async () => {
    const { attach, submit, claim } = await setup();
    const big = (await claim('staff', { amountMinor: 20_001 })).body.data.id as string;
    expect((await submit('staff', big)).status).toBe(422);
    expect((await attach('staff', big)).status).toBe(201);
    expect((await submit('staff', big)).status).toBe(200);

    const atLimit = (await claim('staff', { amountMinor: 20_000 })).body.data.id as string;
    expect((await submit('staff', atLimit)).status).toBe(200);
  });
});

describe('expense claims API: receipts', () => {
  it('lets only the claimant attach a receipt, and only while the claim is a draft', async () => {
    const { attach, submit, createdId } = await setup();
    const claimId = await createdId('staff');
    expect((await attach('team_lead', claimId)).status).toBe(404);
    const attached = await attach('staff', claimId);
    expect(attached.status).toBe(201);
    expect(attached.body.data.receipt).toMatchObject({
      name: 'receipt.pdf',
      contentType: 'application/pdf',
    });
    expect(
      (await attach('staff', claimId, Buffer.from('plain text, not a receipt'), 'note.pdf')).status,
    ).toBe(400);
    await submit('staff', claimId);
    expect((await attach('staff', claimId)).status).toBe(409);
  });

  it('gives the link to the claimant and the people who review the claim, to nobody else', async () => {
    const { agents, attach, createdId, claim } = await setup();
    const claimId = await createdId('staff');
    expect(
      (await agents.staff.get(`/api/v1/expense-claims/${claimId}/receipt/download-link`)).status,
    ).toBe(404);
    await attach('staff', claimId);
    const linkPath = `/api/v1/expense-claims/${claimId}/receipt/download-link`;
    expect((await agents.staff.get(linkPath)).body.data.url).toContain(
      '/api/v1/files/download?token=',
    );
    expect((await agents.team_lead.get(linkPath)).status).toBe(200);
    expect((await agents.hr_manager.get(linkPath)).status).toBe(200);

    const adminClaim = (await claim('admin')).body.data.id as string;
    await attach('admin', adminClaim);
    expect(
      (await agents.team_lead.get(`/api/v1/expense-claims/${adminClaim}/receipt/download-link`))
        .status,
    ).toBe(404);
  });
});

describe('expense claims API: review scope', () => {
  it('a Team Lead cannot see claims outside the team, and gets the same answer as for a missing one', async () => {
    const { agents, claim } = await setup();
    const adminClaim = (await claim('admin')).body.data.id as string;
    const outOfScope = await agents.team_lead.get(`/api/v1/expense-claims/${adminClaim}`);
    const missing = await agents.team_lead.get(`/api/v1/expense-claims/${MISSING}`);
    expectNoExistenceLeak(outOfScope, missing);
    const teamList = await agents.team_lead.get('/api/v1/expense-claims');
    expect(teamList.body.data.map((c: { id: string }) => c.id)).not.toContain(adminClaim);
    expect((await agents.hr_manager.get(`/api/v1/expense-claims/${adminClaim}`)).status).toBe(200);
  });
});

describe('expense claims API: the approval path (D-17)', () => {
  it('a claim goes to the manager, then HR, then can be reimbursed once', async () => {
    const { agents, submitted, decide } = await setup();
    const { claimId, approvalId, res } = await submitted('staff');
    expect(res.body.data).toMatchObject({ status: 'submitted' });

    expect((await decide('team_lead', approvalId, 'approve')).status).toBe(200);
    expect((await agents.staff.get(`/api/v1/expense-claims/${claimId}`)).body.data.status).toBe(
      'submitted',
    );

    expect((await decide('hr_manager', approvalId, 'approve')).status).toBe(200);
    const approved = await agents.staff.get(`/api/v1/expense-claims/${claimId}`);
    expect(approved.body.data).toMatchObject({ status: 'approved' });
    expect(approved.body.data.decidedAt).not.toBeNull();

    const paid = await agents.hr_manager.post(`/api/v1/expense-claims/${claimId}/reimburse`);
    expect(paid.status).toBe(200);
    expect(paid.body.data).toMatchObject({ status: 'reimbursed' });
    expect(
      (await agents.hr_manager.post(`/api/v1/expense-claims/${claimId}/reimburse`)).status,
    ).toBe(409);
  });

  it('a rejection by the manager closes the claim for good', async () => {
    const { agents, submitted, decide } = await setup();
    const { claimId, approvalId } = await submitted('staff');
    expect((await decide('team_lead', approvalId, 'reject')).status).toBe(200);
    expect((await agents.staff.get(`/api/v1/expense-claims/${claimId}`)).body.data.status).toBe(
      'rejected',
    );
    expect(
      (await agents.hr_manager.post(`/api/v1/expense-claims/${claimId}/reimburse`)).status,
    ).toBe(409);
    expect((await agents.staff.post(`/api/v1/expense-claims/${claimId}/cancel`)).status).toBe(409);
  });

  it("a Team Lead's own claim goes to HR only, and nobody approves or reimburses their own", async () => {
    const { agents, submitted, decide } = await setup();
    const leadClaim = await submitted('team_lead');
    // Outside the Team Lead's own approval scope, so the engine answers as for a missing approval.
    expect((await decide('team_lead', leadClaim.approvalId, 'approve')).status).toBe(404);
    expect((await decide('hr_manager', leadClaim.approvalId, 'approve')).status).toBe(200);

    const hrClaim = await submitted('hr_manager');
    expect((await decide('hr_manager', hrClaim.approvalId, 'approve')).status).toBe(403);
    expect((await decide('admin', hrClaim.approvalId, 'approve')).status).toBe(200);
    expect(
      (await agents.hr_manager.post(`/api/v1/expense-claims/${hrClaim.claimId}/reimburse`)).status,
    ).toBe(403);
    expect(
      (await agents.admin.post(`/api/v1/expense-claims/${hrClaim.claimId}/reimburse`)).status,
    ).toBe(200);
  });
});

describe('expense claims API: cancel and categories', () => {
  it('the claimant withdraws a submitted claim, which closes its approval', async () => {
    const { agents, submitted, decide, createdId } = await setup();
    const { claimId, approvalId } = await submitted('staff');
    const other = await createdId('staff');
    expect((await agents.team_lead.post(`/api/v1/expense-claims/${other}/cancel`)).status).toBe(
      404,
    );

    const cancelled = await agents.staff.post(`/api/v1/expense-claims/${claimId}/cancel`);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect((await decide('team_lead', approvalId, 'approve')).status).toBe(409);
  });

  it('HR manages categories; a deactivated one is no longer offered', async () => {
    const { agents } = await setup();
    const created = await agents.hr_manager
      .post('/api/v1/expense-categories', { code: 'training', name: 'Training' })
      .set('Idempotency-Key', 'cat-key-1-abcdefgh');
    expect(created.status).toBe(201);
    const dup = await agents.hr_manager
      .post('/api/v1/expense-categories', { code: 'training', name: 'Training again' })
      .set('Idempotency-Key', 'cat-key-2-abcdefgh');
    expect(dup.status).toBe(409);

    const listed = await agents.staff.get('/api/v1/expense-categories');
    const codes = listed.body.data.map((c: { code: string }) => c.code);
    expect(codes).toContain('training');
    expect(codes).not.toContain('legacy');

    const off = await agents.hr_manager.post(
      `/api/v1/expense-categories/${created.body.data.id}/deactivate`,
    );
    expect(off.status).toBe(200);
    const after = await agents.staff.get('/api/v1/expense-categories');
    expect(after.body.data.map((c: { code: string }) => c.code)).not.toContain('training');
    expect(
      (await agents.hr_manager.post(`/api/v1/expense-categories/${MISSING}/deactivate`)).status,
    ).toBe(404);
  });

  it('writes the audit trail for submission, approval and reimbursement', async () => {
    const { agents, auditStore, submitted, decide } = await setup();
    const { claimId, approvalId } = await submitted('staff');
    await decide('team_lead', approvalId, 'approve');
    await decide('hr_manager', approvalId, 'approve');
    await agents.hr_manager.post(`/api/v1/expense-claims/${claimId}/reimburse`);
    for (const action of [
      'expense.create',
      'expense.submit',
      'expense.approve',
      'expense.reimburse',
    ]) {
      expect(
        auditStore.find((e) => e.action === action),
        action,
      ).not.toHaveLength(0);
    }
  });
});
