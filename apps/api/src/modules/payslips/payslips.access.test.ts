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
import { InMemoryPayslipsRepository } from './payslips.repository.memory';
import { createPayslipsRouter } from './payslips.routes';
import { PayslipsService } from './payslips.service';

async function setup() {
  const { platform } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const kit = createTestAuth(platform.audit);
  const { users } = kit;

  const repo = new InMemoryPayslipsRepository({
    [users.admin.employeeId]: {
      employeeCode: 'EMP-0001',
      employeeName: 'Admin User',
      departmentName: 'Engineering',
    },
    [users.hr_manager.employeeId]: {
      employeeCode: 'EMP-0002',
      employeeName: 'HR User',
      departmentName: 'HR',
    },
    [users.team_lead.employeeId]: {
      employeeCode: 'EMP-0003',
      employeeName: 'Team Lead',
      departmentName: 'Engineering',
    },
    [users.staff.employeeId]: {
      employeeCode: 'EMP-0004',
      employeeName: 'Ananya Sen',
      departmentName: 'Engineering',
    },
  });

  const service = new PayslipsService(repo, platform.audit);
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/payslips',
    createPayslipsRouter({
      authenticate: kit.auth.authenticate,
      audit: platform.audit,
      repository: repo,
      service,
    }),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) {
    as[role] = await signInAs(app, kit, role);
  }

  const staffPublished = await repo.create(
    {
      employeeId: users.staff.employeeId,
      payMonth: 10,
      payYear: 2026,
      status: 'published',
      designation: 'Software Engineer',
      basicSalary: 45000,
      hra: 18000,
      providentFund: 5400,
    },
    users.hr_manager.id,
  );
  const staffDraft = await repo.create(
    {
      employeeId: users.staff.employeeId,
      payMonth: 11,
      payYear: 2026,
      status: 'draft',
      designation: 'Software Engineer',
      basicSalary: 45000,
    },
    users.hr_manager.id,
  );
  const leadPublished = await repo.create(
    {
      employeeId: users.team_lead.employeeId,
      payMonth: 10,
      payYear: 2026,
      status: 'published',
      designation: 'Staff Engineer',
      basicSalary: 70000,
    },
    users.hr_manager.id,
  );

  return { app, as, kit, staffPublished, staffDraft, leadPublished };
}

describe('payslips module access & PDF downloads', () => {
  it('requires authentication on all endpoints', async () => {
    const { app, staffPublished } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/payslips/me'],
      ['get', '/api/v1/payslips'],
      ['post', '/api/v1/payslips'],
      ['get', `/api/v1/payslips/${staffPublished.id}`],
      ['get', `/api/v1/payslips/${staffPublished.id}/pdf`],
      ['post', `/api/v1/payslips/${staffPublished.id}/publish`],
    ] as const) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it('staff only sees own published payslips (drafts & colleagues return 404)', async () => {
    const { as, staffPublished, staffDraft, leadPublished } = await setup();

    const listRes = await as.staff.get('/api/v1/payslips/me');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(staffPublished.id);

    const draftRes = await as.staff.get(`/api/v1/payslips/${staffDraft.id}`);
    expect(draftRes.status).toBe(404);

    const otherRes = await as.staff.get(`/api/v1/payslips/${leadPublished.id}/pdf`);
    expect(otherRes.status).toBe(404);

    const adminListForbidden = await as.staff.get('/api/v1/payslips');
    expect(adminListForbidden.status).toBe(403);
  });

  it('allows staff to download own published payslip as a real PDF', async () => {
    const { as, staffPublished } = await setup();

    const pdfRes = await as.staff
      .get(`/api/v1/payslips/${staffPublished.id}/pdf`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain(
      'MAXR_Payslip_October_2026_EMP-0004.pdf',
    );
    expect((pdfRes.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('allows HR Manager to create and publish draft payslips, making them visible to employee', async () => {
    const { as, staffDraft } = await setup();

    const pubRes = await as.hr_manager.post(`/api/v1/payslips/${staffDraft.id}/publish`).send({});
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('published');

    const staffList = await as.staff.get('/api/v1/payslips/me');
    expect(staffList.status).toBe(200);
    expect(staffList.body.data).toHaveLength(2);
  });
});
