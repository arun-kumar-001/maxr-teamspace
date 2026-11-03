import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createApprovals } from '../approvals';
import { MemoryApprovalsRepository } from '../approvals/approvals.repository.memory';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { InMemoryExpensesRepository } from './expenses.repository.memory';
import type { ExpenseTx } from './expenses.types';
import { createExpensesModule } from './index';

const TARGET_CAT_ID = '50000000-0000-4000-a000-000000000001';
const dummyTx = {} as unknown as ExpenseTx;

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);

  const expensesRepo = new InMemoryExpensesRepository();
  const approvalsRepo = new MemoryApprovalsRepository();

  // Seed category with valid UUID
  await expensesRepo.createCategory(dummyTx, {
    name: 'Travel & Transport',
    description: 'Travel expenses',
  });

  const approvals = createApprovals({
    platform,
    authenticate: kit.auth.authenticate,
    repository: approvalsRepo,
  });

  const staffEmpId = kit.users.staff.employeeId;
  const leadEmpId = kit.users.team_lead.employeeId;
  const hrEmpId = kit.users.hr_manager.employeeId;
  const otherEmpId = '40000000-0000-4000-a000-000000000099';

  expensesRepo.setEmployee({
    id: staffEmpId,
    name: 'Sam Staff',
    code: 'EMP-STAFF',
    managerId: leadEmpId,
  });
  expensesRepo.setEmployee({
    id: leadEmpId,
    name: 'Tara TeamLead',
    code: 'EMP-LEAD',
    managerId: hrEmpId,
  });
  expensesRepo.setEmployee({
    id: hrEmpId,
    name: 'Hana HR',
    code: 'EMP-HR',
    managerId: null,
  });
  expensesRepo.setEmployee({
    id: otherEmpId,
    name: 'Other Employee',
    code: 'EMP-OTHER',
    managerId: 'other-manager-id',
  });

  approvalsRepo.requesters[staffEmpId] = {
    name: 'Sam Staff',
    managerId: leadEmpId,
    roles: [ROLES.STAFF],
  };
  approvalsRepo.requesters[leadEmpId] = {
    name: 'Tara TeamLead',
    managerId: hrEmpId,
    roles: [ROLES.TEAM_LEAD],
  };
  approvalsRepo.requesters[hrEmpId] = {
    name: 'Hana HR',
    managerId: null,
    roles: [ROLES.HR_MANAGER],
  };
  approvalsRepo.requesters[otherEmpId] = {
    name: 'Other Employee',
    managerId: 'other-manager-id',
    roles: [ROLES.STAFF],
  };

  const expensesModule = createExpensesModule({
    approvals: approvals.service,
    platform,
    authenticate: kit.auth.authenticate,
    repository: expensesRepo,
    settings: { getBasic: async () => ({ timezone: 'UTC' }) },
  });

  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/approvals', approvals.router);
  app.use('/api/v1', expensesModule.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) {
    as[role] = await signInAs(app, kit, role);
  }

  return {
    app,
    as: as as Record<(typeof ALL_ROLES)[number], SignedIn>,
    kit,
    expensesRepo,
    approvalsRepo,
    expensesModule,
    staffEmpId,
    leadEmpId,
    hrEmpId,
    otherEmpId,
  };
}

describe('Expenses API: Access & RBAC', () => {
  let env: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    env = await setup();
  });

  it('all endpoints reject unauthenticated requests with 401', async () => {
    const categoriesRes = await request(env.app).get('/api/v1/expense-categories');
    expect(categoriesRes.status).toBe(401);

    const listRes = await request(env.app).get('/api/v1/expense-claims');
    expect(listRes.status).toBe(401);

    const mineRes = await request(env.app).get('/api/v1/expense-claims/mine');
    expect(mineRes.status).toBe(401);

    const submitRes = await request(env.app).post('/api/v1/expense-claims').send({});
    expect(submitRes.status).toBe(401);
  });

  it('any authenticated user can read active expense categories', async () => {
    for (const role of ALL_ROLES) {
      const res = await env.as[role].get('/api/v1/expense-categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    }
  });

  it('only HR Manager and Admin can manage expense categories', async () => {
    // Staff denied
    const staffRes = await env.as.staff
      .post('/api/v1/expense-categories')
      .send({ name: 'Staff Cat' });
    expect(staffRes.status).toBe(403);

    // Team Lead denied
    const leadRes = await env.as.team_lead
      .post('/api/v1/expense-categories')
      .send({ name: 'Lead Cat' });
    expect(leadRes.status).toBe(403);

    // HR Manager allowed
    const hrRes = await env.as.hr_manager
      .post('/api/v1/expense-categories')
      .send({ name: 'HR Cat', description: 'Created by HR' });
    expect(hrRes.status).toBe(201);
    expect(hrRes.body.data.name).toBe('HR Cat');

    // Admin allowed
    const adminRes = await env.as.admin
      .post('/api/v1/expense-categories')
      .send({ name: 'Admin Cat', description: 'Created by Admin' });
    expect(adminRes.status).toBe(201);
    expect(adminRes.body.data.name).toBe('Admin Cat');
  });

  it('staff can submit expense claim and list own claims', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const submitRes = await env.as.staff.post('/api/v1/expense-claims').send({
      categoryId: TARGET_CAT_ID,
      amountPaise: 5000,
      expenseDate: today,
      description: 'Stationery purchase',
    });

    expect(submitRes.status).toBe(201);
    const claim = submitRes.body.data;
    expect(claim.status).toBe('submitted');

    // GET /expense-claims/mine
    const mineRes = await env.as.staff.get('/api/v1/expense-claims/mine');
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data.length).toBe(1);
    expect(mineRes.body.data[0].id).toBe(claim.id);
  });

  it('scope enforcement: Team Lead sees team member claim, but not other team claim', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Staff (under team_lead) submits claim
    const staffClaimRes = await env.as.staff.post('/api/v1/expense-claims').send({
      categoryId: TARGET_CAT_ID,
      amountPaise: 12000,
      expenseDate: today,
      description: 'Team staff claim',
    });
    const staffClaimId = staffClaimRes.body.data.id;

    // Direct claim for outside employee
    const outsideClaim = await env.expensesRepo.createClaim(dummyTx, {
      employeeId: env.otherEmpId,
      categoryId: TARGET_CAT_ID,
      amountPaise: 8000,
      expenseDate: today,
      description: 'Outside team claim',
      status: 'submitted',
    });

    // Team Lead lists scoped claims
    const leadListRes = await env.as.team_lead.get('/api/v1/expense-claims');
    expect(leadListRes.status).toBe(200);
    const claimIds = (leadListRes.body.data as Array<{ id: string }>).map((c) => c.id);
    expect(claimIds).toContain(staffClaimId);
    expect(claimIds).not.toContain(outsideClaim.id);

    // Team Lead trying to view outside claim gets 404 (no existence leak)
    const outsideGetRes = await env.as.team_lead.get(`/api/v1/expense-claims/${outsideClaim.id}`);
    expect(outsideGetRes.status).toBe(404);
  });

  it('receipt download ACL: claimant and manager can download receipt, peer gets 404', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Staff submits claim with receipt
    const claim = await env.expensesModule.service.submitClaim(
      {
        actorId: env.kit.users.staff.id,
        employeeId: env.staffEmpId,
        roles: [ROLES.STAFF],
      },
      {
        categoryId: TARGET_CAT_ID,
        amountPaise: 30000,
        expenseDate: today,
        description: 'Hotel stay',
        receipt: {
          filename: 'bill.pdf',
          declaredType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 test receipt'),
        },
      },
    );

    // 1. Claimant can get download link
    const ownerLinkRes = await env.as.staff.get(`/api/v1/expense-claims/${claim.id}/receipt`);
    expect(ownerLinkRes.status).toBe(200);
    expect(ownerLinkRes.body.data.url).toContain('/api/v1/files/');

    // 2. Team Lead (manager) can get download link
    const leadLinkRes = await env.as.team_lead.get(`/api/v1/expense-claims/${claim.id}/receipt`);
    expect(leadLinkRes.status).toBe(200);
    expect(leadLinkRes.body.data.url).toContain('/api/v1/files/');

    // 3. Peer employee outside scope cannot get download link (404)
    const peerClaim = await env.expensesRepo.createClaim(dummyTx, {
      employeeId: env.otherEmpId,
      categoryId: TARGET_CAT_ID,
      amountPaise: 10000,
      expenseDate: today,
      description: 'Peer claim',
      receiptStorageKey: 'receipts/test-peer.pdf',
      status: 'submitted',
    });

    const peerRes = await env.as.staff.get(`/api/v1/expense-claims/${peerClaim.id}/receipt`);
    expect(peerRes.status).toBe(404);
  });

  it('only HR Manager and Admin can mark approved claim as reimbursed', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const claim = await env.expensesRepo.createClaim(dummyTx, {
      employeeId: env.staffEmpId,
      categoryId: TARGET_CAT_ID,
      amountPaise: 10000,
      expenseDate: today,
      description: 'Approved claim',
      status: 'approved',
    });

    // Staff denied (403)
    const staffReimburse = await env.as.staff.post(`/api/v1/expense-claims/${claim.id}/reimburse`);
    expect(staffReimburse.status).toBe(403);

    // Team Lead denied (403)
    const leadReimburse = await env.as.team_lead.post(
      `/api/v1/expense-claims/${claim.id}/reimburse`,
    );
    expect(leadReimburse.status).toBe(403);

    // HR Manager allowed (200)
    const hrReimburse = await env.as.hr_manager.post(
      `/api/v1/expense-claims/${claim.id}/reimburse`,
    );
    expect(hrReimburse.status).toBe(200);
    expect(hrReimburse.body.data.status).toBe('reimbursed');
  });
});
