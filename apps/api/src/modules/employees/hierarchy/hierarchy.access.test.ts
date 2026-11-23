import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeDetail } from '../detail';
import { MemoryEmployeeDetailRepository } from '../detail/detail.repository.memory';
import { createEmployeeHierarchy } from './index';
import { MemoryHierarchyRepository, MemoryNode } from './hierarchy.repository.memory';

const OUTSIDER = '94000000-0000-4000-8000-000000000001';
const OTHER = '94000000-0000-4000-8000-000000000002';

const node = (id: string, overrides: Partial<MemoryNode> = {}): MemoryNode => ({
  id,
  employeeCode: `E-${id.slice(-4)}`,
  name: `Person ${id.slice(-4)}`,
  designation: 'Engineer',
  status: 'active',
  version: 1,
  managerId: null,
  ...overrides,
});

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const leadId = kit.users.team_lead.employeeId;
  const staffId = kit.users.staff.employeeId;
  const repo = new MemoryHierarchyRepository([
    node(leadId),
    node(staffId, { managerId: leadId }),
    node(OUTSIDER),
    node(OTHER, { managerId: OUTSIDER }),
  ]);
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  // Same order as the composition root: hierarchy first, then detail (`/:id`).
  app.use(
    '/api/v1/employees',
    createEmployeeHierarchy({ platform, authenticate: kit.auth.authenticate, repository: repo })
      .router,
  );
  app.use(
    '/api/v1/employees',
    createEmployeeDetail({
      platform,
      authenticate: kit.auth.authenticate,
      repository: new MemoryEmployeeDetailRepository(),
    }).router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, repo, auditStore, leadId, staffId };
}

describe('GET /employees/org-roots', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/v1/employees/org-roots')).status).toBe(401);
  });

  it.each([
    ['admin', 200, 2],
    ['hr_manager', 200, 2],
    ['team_lead', 200, 0],
    ['staff', 403, undefined],
  ] as const)('%s gets %i with %s people at the top', async (role, status, count) => {
    const s = await setup();
    const res = await s.as[role].get('/api/v1/employees/org-roots');
    expect(res.status).toBe(status);
    if (count !== undefined) expect(res.body.data).toHaveLength(count);
  });

  it('is not read as an employee id by the detail router that follows', async () => {
    const s = await setup();
    const res = await s.as.admin.get('/api/v1/employees/org-roots');
    expect(res.status).toBe(200);
    expect(res.body.meta).toBeDefined();
  });

  it.each(['status=done', 'pageSize=1000', 'bogus=1'])('rejects the query %s', async (qs) => {
    const { as } = await setup();
    expect((await as.admin.get(`/api/v1/employees/org-roots?${qs}`)).status).toBe(400);
  });
});

describe('GET /employees/{id}/direct-reports', () => {
  it('answers 401 without a session', async () => {
    const { app, leadId } = await setup();
    expect((await request(app).get(`/api/v1/employees/${leadId}/direct-reports`)).status).toBe(401);
  });

  it('Admin and HR open any branch; Staff cannot', async () => {
    const s = await setup();
    for (const role of ['admin', 'hr_manager'] as const) {
      const res = await s.as[role].get(`/api/v1/employees/${OUTSIDER}/direct-reports`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((n: { id: string }) => n.id)).toEqual([OTHER]);
    }
    expect((await s.as.staff.get(`/api/v1/employees/${s.leadId}/direct-reports`)).status).toBe(403);
  });

  it("a Team Lead opens their own team and no one else's branch", async () => {
    const s = await setup();
    const own = await s.as.team_lead.get(`/api/v1/employees/${s.leadId}/direct-reports`);
    expect(own.status).toBe(200);
    expect(own.body.data.map((n: { id: string }) => n.id)).toEqual([s.staffId]);
    expect(own.body.data[0]).toMatchObject({ directReportCount: 0, designation: 'Engineer' });
    expect((await s.as.team_lead.get(`/api/v1/employees/${OUTSIDER}/direct-reports`)).status).toBe(
      404,
    );
  });

  it('answers 404 for an unknown employee and 400 for a malformed id', async () => {
    const { as } = await setup();
    expect(
      (await as.admin.get('/api/v1/employees/94000000-0000-4000-8000-0000000000ff/direct-reports'))
        .status,
    ).toBe(404);
    expect((await as.admin.get('/api/v1/employees/nope/direct-reports')).status).toBe(400);
  });
});

describe('PUT /employees/{id}/manager', () => {
  it('answers 401 without a session', async () => {
    const { app, staffId } = await setup();
    expect(
      (
        await request(app)
          .put(`/api/v1/employees/${staffId}/manager`)
          .send({ version: 1, managerId: null })
      ).status,
    ).toBe(401);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s changing a manager gets %i', async (role, status) => {
    const s = await setup();
    const res = await s.as[role].put(`/api/v1/employees/${s.staffId}/manager`, {
      version: 1,
      managerId: OUTSIDER,
    });
    expect(res.status).toBe(status);
    expect(s.repo.nodes.find((n) => n.id === s.staffId)?.managerId).toBe(
      status === 200 ? OUTSIDER : s.leadId,
    );
  });

  it('returns the new manager and version, and audits once with ids only', async () => {
    const s = await setup();
    const res = await s.as.hr_manager.put(`/api/v1/employees/${s.staffId}/manager`, {
      version: 1,
      managerId: OUTSIDER,
    });
    expect(res.body.data).toMatchObject({
      id: s.staffId,
      managerId: OUTSIDER,
      manager: { id: OUTSIDER },
      version: 2,
    });
    const entries = s.auditStore.find((e) => e.action === 'employee.manager_change');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.changes).toEqual({ managerId: { from: s.leadId, to: OUTSIDER } });
  });

  it('refuses a loop with 422', async () => {
    const s = await setup();
    const res = await s.as.admin.put(`/api/v1/employees/${s.leadId}/manager`, {
      version: 1,
      managerId: s.staffId,
    });
    expect(res.status).toBe(422);
    expect(s.repo.nodes.find((n) => n.id === s.leadId)?.managerId).toBeNull();
  });

  it('answers 409 for a stale version, 404 for an unknown employee', async () => {
    const s = await setup();
    const url = `/api/v1/employees/${s.staffId}/manager`;
    expect((await s.as.admin.put(url, { version: 1, managerId: null })).status).toBe(200);
    expect((await s.as.admin.put(url, { version: 1, managerId: s.leadId })).status).toBe(409);
    expect(
      (
        await s.as.admin.put('/api/v1/employees/94000000-0000-4000-8000-0000000000ff/manager', {
          version: 1,
          managerId: null,
        })
      ).status,
    ).toBe(404);
  });

  it.each([
    ['no manager field', { version: 1 }],
    ['a manager that is not an id', { version: 1, managerId: 'boss' }],
    ['no version', { managerId: null }],
    ['version 0', { version: 0, managerId: null }],
    ['an extra field', { version: 1, managerId: null, status: 'active' }],
  ])('rejects %s with 400 and changes nothing', async (_name, body) => {
    const s = await setup();
    const res = await s.as.admin.put(`/api/v1/employees/${s.staffId}/manager`, body);
    expect(res.status).toBe(400);
    expect(s.repo.nodes.find((n) => n.id === s.staffId)?.managerId).toBe(s.leadId);
  });
});
