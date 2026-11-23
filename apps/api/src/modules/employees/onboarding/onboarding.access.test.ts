import { ROLES, type Role } from '@maxr/shared';
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
import { createOnboarding } from './index';
import { InMemoryOnboardingRepository } from './onboarding.repository.memory';

const TARGET_EMP_ID = '30000000-0000-4000-a000-000000000099';
const TARGET_USER_ID = '40000000-0000-4000-a000-000000000099';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);

  const repository = new InMemoryOnboardingRepository();

  // Seed employees for each role
  for (const role of ALL_ROLES) {
    const u = kit.users[role];
    repository.seedEmployee(
      {
        id: u.employeeId,
        employeeCode: `EMP-${role.toUpperCase()}`,
        firstName: role,
        lastName: 'User',
        email: u.email,
        departmentId: '00000000-0000-0000-0000-000000000001',
        designationId: '00000000-0000-0000-0000-000000000002',
        managerId: role === ROLES.STAFF ? kit.users.team_lead.employeeId : null,
        status: 'active',
        joiningDate: '2026-10-01',
      },
      {
        id: u.id,
        employeeId: u.employeeId,
        email: u.email,
        passwordHash: 'hash',
        isActive: true,
      },
    );
  }

  // Seed pending target employee
  repository.seedEmployee(
    {
      id: TARGET_EMP_ID,
      employeeCode: 'EMP-PENDING',
      firstName: 'New',
      lastName: 'Joiner',
      email: 'newjoiner@example.com',
      departmentId: '00000000-0000-0000-0000-000000000001',
      designationId: '00000000-0000-0000-0000-000000000002',
      managerId: kit.users.team_lead.employeeId,
      status: 'pending',
      joiningDate: '2026-11-01',
    },
    {
      id: TARGET_USER_ID,
      employeeId: TARGET_EMP_ID,
      email: 'newjoiner@example.com',
      passwordHash: 'hash',
      isActive: false,
    },
  );

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);

  const onboardingModule = createOnboarding({
    platform,
    authenticate: kit.auth.authenticate,
    sessions: kit.auth.sessions,
    repository,
  });

  app.use('/api/v1/onboarding', onboardingModule.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) {
    as[role] = await signInAs(app, kit, role);
  }

  return {
    app,
    as: as as Record<(typeof ALL_ROLES)[number], SignedIn>,
    repository,
    onboardingModule,
  };
}

describe('Onboarding API: Access & RBAC', () => {
  let env: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    env = await setup();
  });

  it('every authenticated route returns 401 without a session', async () => {
    const paths = [
      request(env.app).get('/api/v1/onboarding'),
      request(env.app).get('/api/v1/onboarding/me'),
      request(env.app).get(`/api/v1/onboarding/${TARGET_EMP_ID}`),
      request(env.app).post(`/api/v1/onboarding/${TARGET_EMP_ID}/items/id_proof/verify`),
      request(env.app).post(`/api/v1/onboarding/${TARGET_EMP_ID}/activate`),
      request(env.app).post(`/api/v1/onboarding/${TARGET_EMP_ID}/reopen`),
    ];

    for (const p of paths) {
      const res = await p;
      expect(res.status).toBe(401);
    }
  });

  describe('GET /api/v1/onboarding (list)', () => {
    it('Admin and HR Manager can list all onboarding checklists (200)', async () => {
      const adminRes = await env.as.admin.get('/api/v1/onboarding');
      expect(adminRes.status).toBe(200);

      const hrRes = await env.as.hr_manager.get('/api/v1/onboarding');
      expect(hrRes.status).toBe(200);
    });

    it('Team Lead can list checklists within team scope (200)', async () => {
      const res = await env.as.team_lead.get('/api/v1/onboarding');
      expect(res.status).toBe(200);
    });

    it('Staff is forbidden from listing all checklists (403)', async () => {
      const res = await env.as.staff.get('/api/v1/onboarding');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/onboarding/me', () => {
    it('Staff can read their own onboarding checklist (200)', async () => {
      const res = await env.as.staff.get('/api/v1/onboarding/me');
      expect(res.status).toBe(200);
      expect(res.body.data.employeeId).toBeDefined();
    });
  });

  describe('GET /api/v1/onboarding/:id', () => {
    it('Staff reading another employees checklist gets 404 (out of scope)', async () => {
      const res = await env.as.staff.get(`/api/v1/onboarding/${TARGET_EMP_ID}`);
      expect(res.status).toBe(404);
    });

    it('HR Manager and Admin reading any employee checklist gets 200', async () => {
      const res = await env.as.hr_manager.get(`/api/v1/onboarding/${TARGET_EMP_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.data.employeeId).toBe(TARGET_EMP_ID);
    });
  });

  describe('POST /api/v1/onboarding/:id/items/:itemKey/verify', () => {
    it('Staff cannot verify HR checklist items (403)', async () => {
      const res = await env.as.staff
        .post(`/api/v1/onboarding/${TARGET_EMP_ID}/items/id_proof/verify`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('HR Manager can verify HR checklist items (200)', async () => {
      const res = await env.as.hr_manager
        .post(`/api/v1/onboarding/${TARGET_EMP_ID}/items/id_proof/verify`)
        .send({ notes: 'Verified passport copy' });
      expect(res.status).toBe(200);
      expect(
        res.body.data.items.find(
          (i: { itemKey: string; isVerified: boolean }) => i.itemKey === 'id_proof',
        )?.isVerified,
      ).toBe(true);
    });
  });

  describe('POST /api/v1/onboarding/set-password (public)', () => {
    it('allows claiming and setting password without an active session (200)', async () => {
      // HR generates token
      const tokenRes = await env.as.hr_manager.post(
        `/api/v1/onboarding/${TARGET_EMP_ID}/generate-token`,
      );
      expect(tokenRes.status).toBe(200);
      const token = tokenRes.body.data.token;

      // Public endpoint sets password without cookie
      const res = await request(env.app).post('/api/v1/onboarding/set-password').send({
        token,
        newPassword: 'BrandNewSecurePassword123!',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
    });
  });

  describe('POST /api/v1/onboarding/:id/activate (Activation Gate)', () => {
    it('returns 422 if checklist is incomplete', async () => {
      const res = await env.as.hr_manager.post(`/api/v1/onboarding/${TARGET_EMP_ID}/activate`);
      expect(res.status).toBe(422);
    });
  });
});
