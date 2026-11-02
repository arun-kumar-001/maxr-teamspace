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
import { createApprovals } from '../../approvals';
import { MemoryApprovalsRepository } from '../../approvals/approvals.repository.memory';
import { createTestAuth } from '../../auth/auth.testing';
import {
  ALL_ROLES,
  SignedIn,
  expectNoExistenceLeak,
  listRoutes,
  signInAs,
} from '../../rbac/rbac.testing';
import { createAttendanceCorrections } from './index';
import { MemoryCorrectionsRepository } from './corrections.repository.memory';

const NOW = new Date('2026-10-31T10:00:00Z');
const MISSING = '81000000-0000-4000-8000-000000000999';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staff = kit.users.staff.employeeId;
  const lead = kit.users.team_lead.employeeId;
  const managerOf = (id: string) => (id === staff ? lead : null);

  const repo = new MemoryCorrectionsRepository(managerOf);
  const approvalsRepo = new MemoryApprovalsRepository();
  const approvals = createApprovals({
    platform,
    authenticate: kit.auth.authenticate,
    repository: approvalsRepo,
  });
  approvalsRepo.requesters[staff] = { name: 'Sam Staff', managerId: lead, roles: [ROLES.STAFF] };
  for (const role of ALL_ROLES) {
    if (role === ROLES.STAFF) continue;
    approvalsRepo.requesters[kit.users[role].employeeId] = {
      name: role,
      managerId: null,
      roles: [role],
    };
  }
  const corrections = createAttendanceCorrections({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    approvals: approvals.service,
    settings: {
      getBasic: async () => ({
        companyName: 'Test',
        timezone: 'Asia/Kolkata',
        workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
      }),
    },
    shiftResolver: undefined,
    repository: repo,
    clock: () => NOW,
  });

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/attendance/corrections', corrections.router);
  app.use('/api/v1/approvals', approvals.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const recordFor = (role: Role, day = '20') => {
    const id = `82000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    repo.records.push({
      id,
      employeeId: kit.users[role].employeeId,
      workDate: `2026-10-${day}`,
      checkIn: `2026-10-${day}T03:30:00.000Z`,
      checkOut: `2026-10-${day}T11:30:00.000Z`,
      durationMinutes: 480,
      status: 'present',
    });
    return id;
  };
  const body = (attendanceRecordId: string, extra: object = {}) => ({
    attendanceRecordId,
    requestedCheckIn: '2026-10-20T04:00:00Z',
    requestedCheckOut: '2026-10-20T12:30:00Z',
    reason: 'Left late',
    ...extra,
  });
  const file = (who: Role, payload: object) =>
    as[who]
      .post('/api/v1/attendance/corrections', payload)
      .set('Idempotency-Key', `correction-${who}-${++n}-abcdefgh`);
  return { app, as, repo, kit, auditStore, recordFor, body, file, approvalsRepo };
}

describe('attendance corrections API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/attendance/corrections'],
      ['post', '/api/v1/attendance/corrections'],
      ['get', `/api/v1/attendance/corrections/${MISSING}`],
      ['post', `/api/v1/attendance/corrections/${MISSING}/cancel`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) =>
      r.path.startsWith('/api/v1/attendance/corrections'),
    );
    expect(routes).toHaveLength(4);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  it.each(ALL_ROLES)('%s files a correction for their own record', async (role) => {
    const { file, recordFor, body } = await setup();
    const res = await file(role, body(recordFor(role)));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', workDate: '2026-10-20' });
    expect(res.body.data.originalCheckIn).toBe('2026-10-20T03:30:00.000Z');
  });

  it('takes the employee from the session: a body naming one is refused', async () => {
    const { file, recordFor, body, kit } = await setup();
    const res = await file(
      'staff',
      body(recordFor('staff'), { employeeId: kit.users.admin.employeeId }),
    );
    expect(res.status).toBe(400);
  });

  it('refuses a record that belongs to someone else exactly like a missing one', async () => {
    const { file, recordFor, body } = await setup();
    const others = await file('staff', body(recordFor('team_lead')));
    const missing = await file('staff', body(MISSING));
    expectNoExistenceLeak(others, missing);
  });

  it('needs an Idempotency-Key', async () => {
    const { as, recordFor, body } = await setup();
    const res = await as.staff.post('/api/v1/attendance/corrections', body(recordFor('staff')));
    expect(res.status).toBe(400);
  });

  it.each([
    ['a missing reason', { reason: undefined }],
    ['an empty reason', { reason: '   ' }],
    ['a reason over 500 characters', { reason: 'x'.repeat(501) }],
    ['a time without an offset', { requestedCheckIn: '2026-10-20T09:30:00' }],
    ['a non-uuid record', { attendanceRecordId: 'abc' }],
  ])('rejects %s with 400', async (_name, patch) => {
    const { file, recordFor, body } = await setup();
    expect((await file('staff', body(recordFor('staff'), patch))).status).toBe(400);
  });

  it('a retried request with the same key is answered from the first, not filed twice', async () => {
    const { as, recordFor, body, repo } = await setup();
    const payload = body(recordFor('staff'));
    const send = () =>
      as.staff
        .post('/api/v1/attendance/corrections', payload)
        .set('Idempotency-Key', 'retry-key-123456789');
    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(repo.corrections).toHaveLength(1);
  });

  it('lists only the caller’s own corrections, filtered by status', async () => {
    const { file, as, recordFor, body } = await setup();
    await file('staff', body(recordFor('staff')));
    await file('team_lead', body(recordFor('team_lead')));
    const mine = await as.staff.get('/api/v1/attendance/corrections');
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.meta.total).toBe(1);
    expect(
      (await as.staff.get('/api/v1/attendance/corrections?status=approved')).body.data,
    ).toHaveLength(0);
    expect((await as.staff.get('/api/v1/attendance/corrections?status=bogus')).status).toBe(400);
    expect((await as.staff.get('/api/v1/attendance/corrections?pageSize=1000')).status).toBe(400);
  });

  it.each([
    ['staff', 200], // the requester
    ['team_lead', 200], // manager of the requester
    ['hr_manager', 200],
    ['admin', 200],
  ] as Array<[Role, number]>)(
    '%s reads the staff member’s correction: %i',
    async (role, status) => {
      const { file, as, recordFor, body } = await setup();
      const created = await file('staff', body(recordFor('staff')));
      expect(
        (await as[role].get(`/api/v1/attendance/corrections/${created.body.data.id}`)).status,
      ).toBe(status);
    },
  );

  it('keeps a correction out of reach of someone outside its scope, with a 404 like a missing one', async () => {
    const { file, as, recordFor, body } = await setup();
    // The team lead has no manager, so only HR, Admin and the lead can read their correction.
    const created = await file('team_lead', body(recordFor('team_lead')));
    const outOfScope = await as.staff.get(`/api/v1/attendance/corrections/${created.body.data.id}`);
    const missing = await as.staff.get(`/api/v1/attendance/corrections/${MISSING}`);
    expectNoExistenceLeak(outOfScope, missing);
    // The team lead reads their own, but not by team scope (D-26).
    expect(
      (await as.team_lead.get(`/api/v1/attendance/corrections/${created.body.data.id}`)).status,
    ).toBe(200);
  });

  it('cancels a pending correction once; others cannot cancel it', async () => {
    const { file, as, recordFor, body } = await setup();
    const created = await file('staff', body(recordFor('staff')));
    const id = created.body.data.id as string;
    const other = await as.team_lead.post(`/api/v1/attendance/corrections/${id}/cancel`);
    expectNoExistenceLeak(
      other,
      await as.team_lead.post(`/api/v1/attendance/corrections/${MISSING}/cancel`),
    );
    const cancelled = await as.staff.post(`/api/v1/attendance/corrections/${id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect((await as.staff.post(`/api/v1/attendance/corrections/${id}/cancel`)).status).toBe(409);
  });

  it('is decided through /approvals: the manager approves, the record changes, repeating is harmless, the requester cannot decide', async () => {
    const { file, as, recordFor, body, repo } = await setup();
    const recordId = recordFor('staff');
    const created = await file('staff', body(recordId));
    const inbox = await as.team_lead.get(
      '/api/v1/approvals?awaitingMyDecision=true&subjectType=attendance_correction',
    );
    expect(inbox.body.data).toHaveLength(1);
    const approvalId = inbox.body.data[0].id as string;
    expect(inbox.body.data[0].subjectId).toBe(created.body.data.id);

    expect((await as.staff.post(`/api/v1/approvals/${approvalId}/approve`)).status).toBe(403);
    expect(repo.records.find((r) => r.id === recordId)?.durationMinutes).toBe(480);

    const decided = await as.team_lead.post(`/api/v1/approvals/${approvalId}/approve`);
    expect(decided.status).toBe(200);
    const record = repo.records.find((r) => r.id === recordId);
    expect(record).toMatchObject({
      checkIn: '2026-10-20T04:00:00.000Z',
      checkOut: '2026-10-20T12:30:00.000Z',
      durationMinutes: 510,
    });
    expect(repo.corrections[0]?.status).toBe('approved');

    expect((await as.team_lead.post(`/api/v1/approvals/${approvalId}/approve`)).status).toBe(200);
    expect(
      (await as.staff.get(`/api/v1/attendance/corrections/${created.body.data.id}`)).body.data
        .status,
    ).toBe('approved');
  });

  it('a rejection through /approvals closes the correction and keeps the times', async () => {
    const { file, as, recordFor, body, repo } = await setup();
    const recordId = recordFor('staff');
    await file('staff', body(recordId));
    const inbox = await as.team_lead.get('/api/v1/approvals?awaitingMyDecision=true');
    const rejected = await as.team_lead.post(`/api/v1/approvals/${inbox.body.data[0].id}/reject`, {
      comment: 'Not what the log shows',
    });
    expect(rejected.status).toBe(200);
    expect(repo.corrections[0]?.status).toBe('rejected');
    expect(repo.records.find((r) => r.id === recordId)?.durationMinutes).toBe(480);
  });

  it('writes an audit entry for the request, without the reason text', async () => {
    const { file, recordFor, body, auditStore } = await setup();
    await file('staff', body(recordFor('staff'), { reason: 'a private reason' }));
    const entries = auditStore.find((e) => e.action === 'attendance.correction_request');
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries[0])).not.toContain('a private reason');
  });
});
