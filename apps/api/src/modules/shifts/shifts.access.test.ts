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
import { ALL_ROLES, SignedIn, expectNoExistenceLeak, signInAs } from '../rbac/rbac.testing';
import { createShifts } from './index';
import { MemoryShiftsRepository } from './shifts.repository.memory';

const GENERAL = '70000000-0000-4000-8000-000000000001';
const OUTSIDER = '94000000-0000-4000-8000-000000000001';
const NIGHT = { code: 'NIGHT', name: 'Night', startTime: '22:00', endTime: '06:00' };

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staffId = kit.users.staff.employeeId;
  const leadId = kit.users.team_lead.employeeId;
  const repo = new MemoryShiftsRepository([
    { id: staffId, status: 'active', managerId: leadId },
    { id: leadId, status: 'active', managerId: null },
    { id: OUTSIDER, status: 'active', managerId: null },
  ]);
  const shifts = createShifts({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () =>
        ({
          companyName: 'T',
          timezone: 'Asia/Kolkata',
          workWeek: { start: 'Monday', end: 'Friday', days: [] },
        }) as never,
    },
    repository: repo,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/shifts', shifts.shiftsRouter);
  app.use('/api/v1/attendance/policies', shifts.policyRouter);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  let n = 0;
  const post = (who: Role, path: string, body: object) =>
    as[who].post(path, body).set('Idempotency-Key', `shift-test-key-${who}-${++n}-aaaa`);
  return { app, as, repo, auditStore, staffId, leadId, post };
}

describe('shifts: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app, staffId } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/shifts'],
      ['post', '/api/v1/shifts'],
      ['get', `/api/v1/shifts/${GENERAL}`],
      ['put', `/api/v1/shifts/${GENERAL}`],
      ['get', `/api/v1/shifts/assignments/${staffId}`],
      ['post', '/api/v1/shifts/assignments'],
      ['get', '/api/v1/attendance/policies'],
      ['put', '/api/v1/attendance/policies'],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it.each(ALL_ROLES)('%s can read the shifts and the policy', async (role) => {
    const { as } = await setup();
    expect((await as[role].get('/api/v1/shifts')).status).toBe(200);
    expect((await as[role].get(`/api/v1/shifts/${GENERAL}`)).status).toBe(200);
    const policy = await as[role].get('/api/v1/attendance/policies');
    expect(policy.status).toBe(200);
    expect(policy.body.data).toMatchObject({ timezone: 'Asia/Kolkata', fullDayMinutes: 480 });
  });

  it.each([
    ['admin', 201, 200],
    ['hr_manager', 201, 200],
    ['team_lead', 403, 403],
    ['staff', 403, 403],
  ] as const)(
    '%s: creating a shift gets %i, changing the policy gets %i',
    async (role, create, policy) => {
      const s = await setup();
      expect((await s.post(role, '/api/v1/shifts', NIGHT)).status).toBe(create);
      expect(s.repo.shifts).toHaveLength(create === 201 ? 2 : 1);
      const res = await s.as[role].put('/api/v1/attendance/policies', { fullDayMinutes: 540 });
      expect(res.status).toBe(policy);
      expect(s.repo.policy.fullDayMinutes).toBe(policy === 200 ? 540 : 480);
    },
  );

  it.each([
    ['admin', 200],
    ['hr_manager', 200],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s changing a shift gets %i', async (role, status) => {
    const s = await setup();
    expect((await s.as[role].put(`/api/v1/shifts/${GENERAL}`, { graceMinutes: 20 })).status).toBe(
      status,
    );
  });

  it.each([
    ['admin', 201],
    ['hr_manager', 201],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s assigning a shift gets %i', async (role, status) => {
    const s = await setup();
    const res = await s.post(role, '/api/v1/shifts/assignments', {
      employeeId: s.staffId,
      shiftId: GENERAL,
      effectiveFrom: '2026-03-01',
    });
    expect(res.status).toBe(status);
    expect(s.repo.assignments).toHaveLength(status === 201 ? 1 : 0);
  });

  it('the Idempotency-Key header is required on the two creating routes', async () => {
    const s = await setup();
    expect((await s.as.admin.post('/api/v1/shifts', NIGHT)).status).toBe(400);
    expect(
      (
        await s.as.admin.post('/api/v1/shifts/assignments', {
          employeeId: s.staffId,
          shiftId: GENERAL,
          effectiveFrom: '2026-03-01',
        })
      ).status,
    ).toBe(400);
  });
});

describe('shift assignments: who can read whose', () => {
  it.each([
    ['admin', 200, 200],
    ['hr_manager', 200, 200],
    ['team_lead', 200, 404],
    ['staff', 200, 404],
  ] as const)('%s reads the staff member: %i, an outsider: %i', async (role, own, outsider) => {
    const s = await setup();
    expect((await s.as[role].get(`/api/v1/shifts/assignments/${s.staffId}`)).status).toBe(own);
    expect((await s.as[role].get(`/api/v1/shifts/assignments/${OUTSIDER}`)).status).toBe(outsider);
  });

  it('Staff read only themselves, a Team Lead their team and themselves', async () => {
    const s = await setup();
    expect((await s.as.staff.get(`/api/v1/shifts/assignments/${s.leadId}`)).status).toBe(404);
    expect((await s.as.team_lead.get(`/api/v1/shifts/assignments/${s.leadId}`)).status).toBe(200);
  });

  it('an out-of-scope employee looks exactly like one that does not exist', async () => {
    const s = await setup();
    const hidden = await s.as.team_lead.get(`/api/v1/shifts/assignments/${OUTSIDER}`);
    const missing = await s.as.team_lead.get(
      '/api/v1/shifts/assignments/94000000-0000-4000-8000-0000000000ff',
    );
    expectNoExistenceLeak(hidden, missing);
  });

  it('reads the assignments, latest first, and a route named assignments is not read as a shift id', async () => {
    const s = await setup();
    await s.post('admin', '/api/v1/shifts/assignments', {
      employeeId: s.staffId,
      shiftId: GENERAL,
      effectiveFrom: '2026-01-01',
    });
    const res = await s.as.admin.get(`/api/v1/shifts/assignments/${s.staffId}`);
    expect(res.body.data).toMatchObject([
      { effectiveFrom: '2026-01-01', shift: { code: 'GENERAL' } },
    ]);
  });
});

describe('shifts: validation and rules', () => {
  it.each([
    ['a start that is not a time', { startTime: '9am' }],
    ['25:00', { startTime: '25:00' }],
    ['minutes over 59', { endTime: '10:60' }],
    ['the same start and end', { startTime: '22:00', endTime: '22:00' }],
    ['a code with spaces', { code: 'NIGHT SHIFT' }],
    ['a one-character code', { code: 'N' }],
    ['grace over 240', { graceMinutes: 241 }],
    ['negative grace', { graceMinutes: -1 }],
    ['an unknown field', { isActive: false }],
    ['no name', { name: undefined }],
  ])('rejects a new shift with %s with 400', async (_name, change) => {
    const s = await setup();
    const res = await s.post('admin', '/api/v1/shifts', { ...NIGHT, ...change });
    expect(res.status).toBe(400);
    expect(s.repo.shifts).toHaveLength(1);
  });

  it.each([
    ['the code', { code: 'NEW' }],
    ['no field at all', {}],
    ['an unknown field', { employees: 5 }],
  ])('rejects changing a shift with %s with 400', async (_name, body) => {
    const s = await setup();
    expect((await s.as.admin.put(`/api/v1/shifts/${GENERAL}`, body)).status).toBe(400);
  });

  it.each([
    ['no employee', { employeeId: undefined }],
    ['a date that does not exist', { effectiveFrom: '2026-02-30' }],
    ['an end before the start', { effectiveFrom: '2026-03-10', effectiveTo: '2026-03-01' }],
    ['an extra field', { status: 'active' }],
  ])('rejects an assignment with %s with 400', async (_name, change) => {
    const s = await setup();
    const res = await s.post('admin', '/api/v1/shifts/assignments', {
      employeeId: s.staffId,
      shiftId: GENERAL,
      effectiveFrom: '2026-03-01',
      ...change,
    });
    expect(res.status).toBe(400);
    expect(s.repo.assignments).toHaveLength(0);
  });

  it.each([
    ['a half day not shorter than the full day', { halfDayMinutes: 480 }, 422],
    ['a full day over 24 hours', { fullDayMinutes: 1441 }, 400],
    ['no field at all', {}, 400],
    ['an unknown field', { timezone: 'UTC' }, 400],
  ])('rejects a policy change with %s with %i', async (_name, body, status) => {
    const s = await setup();
    expect((await s.as.admin.put('/api/v1/attendance/policies', body)).status).toBe(status);
    expect(s.repo.policy.fullDayMinutes).toBe(480);
  });

  it('refuses a duplicate shift code with 409 and an overlapping assignment with 409', async () => {
    const s = await setup();
    expect((await s.post('admin', '/api/v1/shifts', { ...NIGHT, code: 'general' })).status).toBe(
      409,
    );
    const body = {
      employeeId: s.staffId,
      shiftId: GENERAL,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-03-31',
    };
    expect((await s.post('hr_manager', '/api/v1/shifts/assignments', body)).status).toBe(201);
    expect(
      (
        await s.post('hr_manager', '/api/v1/shifts/assignments', {
          ...body,
          effectiveFrom: '2026-02-01',
        })
      ).status,
    ).toBe(409);
  });
});
