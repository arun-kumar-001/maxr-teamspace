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
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { MemoryDepartmentRepository } from './departments/department.repository';
import { createDepartmentRouter } from './departments/department.routes';
import { MemoryDesignationRepository } from './designations/designation.repository';
import { createDesignationRouter } from './designations/designation.routes';

async function setup() {
  const { platform } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const kit = createTestAuth(platform.audit);
  const deptRepo = new MemoryDepartmentRepository();
  const desigRepo = new MemoryDesignationRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/departments',
    createDepartmentRouter({
      idempotencyStore,
      platform,
      authenticate: kit.auth.authenticate,
      repository: deptRepo,
    }),
  );
  app.use(
    '/api/v1/designations',
    createDesignationRouter({
      idempotencyStore,
      platform,
      authenticate: kit.auth.authenticate,
      repository: desigRepo,
    }),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));

  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) {
    as[role] = await signInAs(app, kit, role);
  }

  const initialDept = await deptRepo.create({ name: 'Initial Dept', code: 'INIT_DEPT' });
  const initialDesig = await desigRepo.create({
    departmentId: initialDept.id,
    title: 'Initial Desig',
    code: 'INIT_DESIG',
    level: 1,
  });

  return { app, as, initialDept, initialDesig, deptRepo, desigRepo };
}

describe('Departments & Designations RBAC Access Matrix', () => {
  it('every endpoint requires authentication and returns 401 without a session', async () => {
    const { app, initialDept, initialDesig } = await setup();
    const unauthenticated = [
      ['get', '/api/v1/departments'],
      ['get', `/api/v1/departments/${initialDept.id}`],
      ['post', '/api/v1/departments'],
      ['put', `/api/v1/departments/${initialDept.id}`],
      ['post', `/api/v1/departments/${initialDept.id}/deactivate`],
      ['get', '/api/v1/designations'],
      ['get', `/api/v1/designations/${initialDesig.id}`],
      ['post', '/api/v1/designations'],
      ['put', `/api/v1/designations/${initialDesig.id}`],
      ['post', `/api/v1/designations/${initialDesig.id}/deactivate`],
    ] as const;

    for (const [method, path] of unauthenticated) {
      const res = await request(app)[method](path).send({});
      expect(res.status, `${method.toUpperCase()} ${path} should be 401`).toBe(401);
    }
  });

  const LIST_DEPARTMENTS: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ];
  it.each(LIST_DEPARTMENTS)(
    '%s listing departments gets %i (departments.list)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/departments');
      expect(res.status).toBe(status);
    },
  );

  const CREATE_DEPARTMENT: Array<[Role, number]> = [
    ['admin', 201],
    ['hr_manager', 201],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(CREATE_DEPARTMENT)(
    '%s creating department gets %i (departments.create)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role]
        .post('/api/v1/departments', { name: `Dept by ${role}`, code: `D_${role.toUpperCase()}` })
        .set('Idempotency-Key', `dept-key-${role}-12345678`);
      expect(res.status).toBe(status);
    },
  );

  const UPDATE_DEPARTMENT: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(UPDATE_DEPARTMENT)(
    '%s updating department gets %i (departments.update)',
    async (role, status) => {
      const { as, initialDept } = await setup();
      const res = await as[role].put(`/api/v1/departments/${initialDept.id}`, {
        name: 'Updated Name',
      });
      expect(res.status).toBe(status);
    },
  );

  const DEACTIVATE_DEPARTMENT: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(DEACTIVATE_DEPARTMENT)(
    '%s deactivating department gets %i (departments.deactivate)',
    async (role, status) => {
      const { as, deptRepo } = await setup();
      const freshDept = await deptRepo.create({ name: 'To Deactivate', code: `DEACT_${role}` });
      const res = await as[role].post(`/api/v1/departments/${freshDept.id}/deactivate`);
      expect(res.status).toBe(status);
    },
  );

  const LIST_DESIGNATIONS: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 200],
    ['staff', 200],
  ];
  it.each(LIST_DESIGNATIONS)(
    '%s listing designations gets %i (designations.list)',
    async (role, status) => {
      const { as } = await setup();
      const res = await as[role].get('/api/v1/designations');
      expect(res.status).toBe(status);
    },
  );

  const CREATE_DESIGNATION: Array<[Role, number]> = [
    ['admin', 201],
    ['hr_manager', 201],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(CREATE_DESIGNATION)(
    '%s creating designation gets %i (designations.create)',
    async (role, status) => {
      const { as, initialDept } = await setup();
      const res = await as[role]
        .post('/api/v1/designations', {
          departmentId: initialDept.id,
          title: `Desig by ${role}`,
          code: `DSG_${role.toUpperCase()}`,
          level: 1,
        })
        .set('Idempotency-Key', `desig-key-${role}-12345678`);
      expect(res.status).toBe(status);
    },
  );

  const UPDATE_DESIGNATION: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(UPDATE_DESIGNATION)(
    '%s updating designation gets %i (designations.update)',
    async (role, status) => {
      const { as, initialDesig } = await setup();
      const res = await as[role].put(`/api/v1/designations/${initialDesig.id}`, {
        title: 'Updated Title',
      });
      expect(res.status).toBe(status);
    },
  );

  const DEACTIVATE_DESIGNATION: Array<[Role, number]> = [
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ];
  it.each(DEACTIVATE_DESIGNATION)(
    '%s deactivating designation gets %i (designations.deactivate)',
    async (role, status) => {
      const { as, desigRepo, initialDept } = await setup();
      const freshDesig = await desigRepo.create({
        departmentId: initialDept.id,
        title: 'To Deactivate',
        code: `DEACT_DSG_${role}`,
        level: 1,
      });
      const res = await as[role].post(`/api/v1/designations/${freshDesig.id}/deactivate`);
      expect(res.status).toBe(status);
    },
  );
});
