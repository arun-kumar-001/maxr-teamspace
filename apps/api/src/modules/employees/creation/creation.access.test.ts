import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../../http/idempotency';
import { createLogger } from '../../../logging/logger';
import { createErrorHandler } from '../../../middleware/error-handler';
import { notFoundHandler } from '../../../middleware/not-found';
import { requestIdMiddleware } from '../../../middleware/request-id';
import { createTestPlatform } from '../../../platform';
import { testHasher } from '../../auth/auth.testing';
import { createTestAuth } from '../../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../../rbac/rbac.testing';
import { createEmployeeCreation } from './index';
import { MemoryEmployeeCreationRepository } from './creation.repository.memory';

const DEPT = '90000000-0000-4000-8000-000000000001';
const DESIG = '90000000-0000-4000-8000-000000000002';

const body = (overrides: Record<string, unknown> = {}) => ({
  employeeCode: 'EMP-2001',
  firstName: 'Anil',
  lastName: 'Kumar',
  email: 'anil.kumar@maxr.internal',
  departmentId: DEPT,
  designationId: DESIG,
  joiningDate: '2026-11-02',
  ...overrides,
});

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const repo = new MemoryEmployeeCreationRepository();
  repo.references.designation = { isActive: true, departmentId: DEPT };
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/employees',
    createEmployeeCreation({
      platform,
      authenticate: kit.auth.authenticate,
      idempotencyStore: new InMemoryIdempotencyStore(),
      repository: repo,
      hasher: testHasher,
    }).router,
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  let n = 0;
  const post = (who: Role, payload: object) =>
    as[who]
      .post('/api/v1/employees', payload)
      .set('Idempotency-Key', `create-key-${who}-${++n}-abcdef`);
  return { app, as, repo, auditStore, post };
}

describe('POST /employees: access', () => {
  it('answers 401 without a session', async () => {
    const { app } = await setup();
    expect((await request(app).post('/api/v1/employees').send(body())).status).toBe(401);
  });

  it.each([
    ['admin', 201],
    ['hr_manager', 201],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s creating an employee gets %i', async (role, status) => {
    const { post, repo } = await setup();
    const res = await post(role, body());
    expect(res.status).toBe(status);
    expect(repo.employees).toHaveLength(status === 201 ? 1 : 0);
  });

  it('an HR Manager cannot hand out the Admin or HR Manager role', async () => {
    const { post, repo } = await setup();
    expect((await post('hr_manager', body({ role: ROLES.ADMIN }))).status).toBe(403);
    expect((await post('hr_manager', body({ role: ROLES.HR_MANAGER }))).status).toBe(403);
    expect(repo.employees).toHaveLength(0);
    expect((await post('admin', body({ role: ROLES.ADMIN }))).status).toBe(201);
  });

  it('the Idempotency-Key header is required', async () => {
    const { as, repo } = await setup();
    const res = await as.admin.post('/api/v1/employees', body());
    expect(res.status).toBe(400);
    expect(repo.employees).toHaveLength(0);
  });

  it('retrying with the same key returns the first response and creates one employee', async () => {
    const { as, repo } = await setup();
    const send = () =>
      as.admin.post('/api/v1/employees', body()).set('Idempotency-Key', 'retry-with-the-same-key');
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(repo.employees).toHaveLength(1);
  });
});

describe('POST /employees: the response and the rules', () => {
  it('returns a pending employee with the default Staff role and no credentials', async () => {
    const { post, auditStore } = await setup();
    const res = await post('hr_manager', body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      employeeCode: 'EMP-2001',
      status: 'pending',
      role: ROLES.STAFF,
      email: 'anil.kumar@maxr.internal',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    expect(auditStore.find((e) => e.action === 'employee.create')).toHaveLength(1);
  });

  it('lower-cases the email and trims the text fields', async () => {
    const { post } = await setup();
    const res = await post(
      'admin',
      body({ email: '  Anil.Kumar@MAXR.internal ', firstName: '  Anil  ' }),
    );
    expect(res.body.data).toMatchObject({ email: 'anil.kumar@maxr.internal', firstName: 'Anil' });
  });

  it('answers 409 for a repeated code or email', async () => {
    const { post } = await setup();
    expect((await post('admin', body())).status).toBe(201);
    expect((await post('admin', body({ email: 'other@maxr.internal' }))).status).toBe(409);
    expect((await post('admin', body({ employeeCode: 'EMP-2002' }))).status).toBe(409);
  });

  it('answers 422 for an inactive department', async () => {
    const { post, repo } = await setup();
    repo.references.department = { isActive: false };
    const res = await post('admin', body());
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('departmentId');
  });

  it.each([
    ['an unknown field', { status: 'active' }],
    ['isActive', { isActive: true }],
    ['a password', { password: 'Secret-123' }],
    ['a user id', { userId: DEPT }],
    ['an unknown role', { role: 'owner' }],
    ['a missing first name', { firstName: undefined }],
    ['an empty first name', { firstName: '   ' }],
    ['a bad email', { email: 'not-an-email' }],
    ['a code with spaces', { employeeCode: 'EMP 1' }],
    ['a one-character code', { employeeCode: 'E' }],
    ['a malformed department id', { departmentId: 'abc' }],
    ['a bad phone', { phone: 'call me' }],
    ['a date that does not exist', { joiningDate: '2026-02-30' }],
    ['a date in the wrong format', { joiningDate: '02/11/2026' }],
    ['a date years ahead', { joiningDate: '2099-01-01' }],
  ])('rejects %s with 400 and stores nothing', async (_name, change) => {
    const { post, repo } = await setup();
    const res = await post('admin', { ...body(), ...change });
    expect(res.status).toBe(400);
    expect(repo.employees).toHaveLength(0);
  });
});
