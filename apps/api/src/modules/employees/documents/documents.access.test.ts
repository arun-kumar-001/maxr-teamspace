import type { Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeDocuments } from './index';
import { InMemoryEmployeeDocumentsRepository } from './documents.repository.memory';

const TARGET_EMP_ID = '30000000-0000-4000-a000-000000000099';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);

  const repository = new InMemoryEmployeeDocumentsRepository();

  // Seed employees for each role
  for (const role of ALL_ROLES) {
    const u = kit.users[role];
    repository.seedEmployee({
      id: u.employeeId,
      status: 'active',
    });
  }

  // Seed target employee
  repository.seedEmployee({
    id: TARGET_EMP_ID,
    status: 'active',
  });

  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use('/api/v1/auth', kit.auth.router);

  const docsModule = createEmployeeDocuments({
    platform,
    authenticate: kit.auth.authenticate,
    repository,
  });

  app.use('/api/v1/employees', docsModule.router);
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
    repository,
    docsModule,
  };
}

describe('Employee Documents API: Access & RBAC', () => {
  let env: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    env = await setup();
  });

  it('every route returns 401 without an active session', async () => {
    const listRes = await request(env.app).get(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
    expect(listRes.status).toBe(401);

    const uploadRes = await request(env.app).post(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
    expect(uploadRes.status).toBe(401);

    const linkRes = await request(env.app).get(
      `/api/v1/employees/${TARGET_EMP_ID}/documents/30000000-0000-4000-a000-000000000001/download-link`,
    );
    expect(linkRes.status).toBe(401);

    const deleteRes = await request(env.app).delete(
      `/api/v1/employees/${TARGET_EMP_ID}/documents/30000000-0000-4000-a000-000000000001`,
    );
    expect(deleteRes.status).toBe(401);
  });

  describe('GET /api/v1/employees/:id/documents', () => {
    it('Admin and HR Manager can list documents for any employee (200)', async () => {
      const adminRes = await env.as.admin.get(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
      expect(adminRes.status).toBe(200);
      expect(Array.isArray(adminRes.body.data)).toBe(true);

      const hrRes = await env.as.hr_manager.get(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
      expect(hrRes.status).toBe(200);
      expect(Array.isArray(hrRes.body.data)).toBe(true);
    });

    it('Staff can list their own documents (200)', async () => {
      const staffEmpId = env.kit.users.staff.employeeId;
      const res = await env.as.staff.get(`/api/v1/employees/${staffEmpId}/documents`);
      expect(res.status).toBe(200);
    });

    it('Staff trying to list another employee documents returns 404', async () => {
      const res = await env.as.staff.get(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
      expect(res.status).toBe(404);
    });

    it('Team Lead trying to list employee documents returns 403 (no permission)', async () => {
      const res = await env.as.team_lead.get(`/api/v1/employees/${TARGET_EMP_ID}/documents`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/employees/:id/documents (raw upload)', () => {
    it('HR Manager can upload document for an employee (201)', async () => {
      const res = await env.as.hr_manager
        .post(
          `/api/v1/employees/${TARGET_EMP_ID}/documents?documentType=id_proof&title=Passport`,
          Buffer.from('%PDF-1.4 test bytes'),
        )
        .set('Content-Type', 'application/pdf')
        .set('X-Filename', 'passport.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Passport');
      expect(res.body.data.documentType).toBe('id_proof');
    });

    it('Staff can upload document to own profile (201)', async () => {
      const staffEmpId = env.kit.users.staff.employeeId;
      const res = await env.as.staff
        .post(
          `/api/v1/employees/${staffEmpId}/documents?documentType=education_certificate&title=Degree`,
          Buffer.from('%PDF-1.4 degree bytes'),
        )
        .set('Content-Type', 'application/pdf')
        .set('X-Filename', 'degree.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data.employeeId).toBe(staffEmpId);
    });

    it('Staff trying to upload to another employee profile returns 404', async () => {
      const res = await env.as.staff
        .post(
          `/api/v1/employees/${TARGET_EMP_ID}/documents?documentType=id_proof&title=Fake`,
          Buffer.from('%PDF-1.4 test'),
        )
        .set('Content-Type', 'application/pdf')
        .set('X-Filename', 'fake.pdf');

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/employees/:id/documents/:docId', () => {
    it('Staff is forbidden from deleting documents (403)', async () => {
      const staffEmpId = env.kit.users.staff.employeeId;
      const res = await env.as.staff.delete(
        `/api/v1/employees/${staffEmpId}/documents/30000000-0000-4000-a000-000000000001`,
      );
      expect(res.status).toBe(403);
    });
  });
});
