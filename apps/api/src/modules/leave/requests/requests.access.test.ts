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
import { MemoryHolidaysRepository } from '../holidays/holidays.repository.memory';
import { createLeaveSetup } from '../index';
import { MemoryLeavePoliciesRepository } from '../policies/policies.repository.memory';
import type { LeavePolicy } from '../policies/policies.types';
import { MemoryLeaveRequestsRepository } from './requests.repository.memory';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const CASUAL = '71000000-0000-4000-8000-000000000002';
const SICK = '71000000-0000-4000-8000-000000000003';
const UNPAID = '71000000-0000-4000-8000-000000000004';
const RETIRED = '71000000-0000-4000-8000-000000000005';
const MISSING = '74000000-0000-4000-8000-000000000999';

const policy = (id: string, code: string, patch: Partial<LeavePolicy> = {}): LeavePolicy => ({
  id,
  code,
  name: `${code} leave`,
  hasBalance: true,
  isActive: true,
  annualDays: 18,
  carryForwardMax: 0,
  allowHalfDay: true,
  maxBackdateDays: 0,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staff = kit.users.staff.employeeId;
  const lead = kit.users.team_lead.employeeId;

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
  const requestsRepo = new MemoryLeaveRequestsRepository((id) => (id === staff ? lead : null));
  for (const role of ALL_ROLES) {
    for (const id of [ANNUAL, SICK, CASUAL]) {
      requestsRepo.balances.push({
        employeeId: kit.users[role].employeeId,
        leaveTypeId: id,
        year: 2026,
        allotted: id === ANNUAL ? 18 : id === SICK ? 12 : 6,
        carriedForward: 0,
        used: 0,
      });
    }
  }
  const holidaysRepo = new MemoryHolidaysRepository([
    { id: 'h1', date: '2026-11-04', name: 'Midweek holiday' },
  ]);
  const leave = createLeaveSetup({
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
    },
    policiesRepository: new MemoryLeavePoliciesRepository([
      policy(ANNUAL, 'ANNUAL'),
      policy(CASUAL, 'CASUAL', { allowHalfDay: false }),
      policy(SICK, 'SICK', { maxBackdateDays: 7 }),
      policy(UNPAID, 'UNPAID', { hasBalance: false, annualDays: 0 }),
      policy(RETIRED, 'RETIRED', { isActive: false }),
    ]),
    holidaysRepository: holidaysRepo,
    requestsRepository: requestsRepo,
    // Saturday 31 October 2026, 15:30 in Asia/Kolkata.
    clock: () => new Date('2026-10-31T10:00:00Z'),
  });

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/leave-requests', leave.requestsRouter);
  app.use('/api/v1/approvals', approvals.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const apply = (who: Role, body: object) =>
    as[who]
      .post('/api/v1/leave-requests', body)
      .set('Idempotency-Key', `leave-${who}-${++n}-abcdefgh`);
  const week = (extra: object = {}) => ({
    leaveTypeId: ANNUAL,
    startDate: '2026-11-02',
    endDate: '2026-11-06',
    ...extra,
  });
  const used = (employeeId: string, id = ANNUAL) =>
    requestsRepo.balances.find((b) => b.employeeId === employeeId && b.leaveTypeId === id)?.used;
  const approvalOf = async (who: Role) =>
    (await as[who].get('/api/v1/approvals?awaitingMyDecision=true')).body.data[0].id as string;
  return { app, as, kit, auditStore, requestsRepo, approvalsRepo, apply, week, used, approvalOf };
}

describe('leave requests API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['post', '/api/v1/leave-requests'],
      ['get', '/api/v1/leave-requests'],
      ['get', '/api/v1/leave-requests/me'],
      ['get', `/api/v1/leave-requests/${MISSING}`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.startsWith('/api/v1/leave-requests'));
    expect(routes).toHaveLength(4);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  it.each(ALL_ROLES)('%s applies for their own leave', async (role) => {
    const { apply, week, kit } = await setup();
    const res = await apply(role, week());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'pending',
      employeeId: kit.users[role].employeeId,
    });
  });

  describe('applying', () => {
    it('counts working days (weekend and holidays skipped), stores the reason and opens the approval', async () => {
      const { apply, week, auditStore } = await setup();
      const res = await apply('staff', week({ reason: 'A private reason' }));
      // Monday 2 to Friday 6 November, minus the holiday on Wednesday the 4th.
      expect(res.body.data).toMatchObject({
        days: 4,
        halfDay: false,
        reason: 'A private reason',
        status: 'pending',
        startDate: '2026-11-02',
        endDate: '2026-11-06',
      });
      expect(res.body.data.approvalId).toEqual(expect.any(String));
      const entry = auditStore.find((e) => e.action === 'leave.apply');
      expect(entry).toHaveLength(1);
      expect(entry[0]?.metadata).toMatchObject({ leaveType: 'ANNUAL', days: 4 });
      expect(JSON.stringify(entry[0])).not.toContain('A private reason');
    });

    it('takes the employee from the session: a body naming one is refused', async () => {
      const { apply, week, kit } = await setup();
      const res = await apply('staff', week({ employeeId: kit.users.admin.employeeId }));
      expect(res.status).toBe(400);
    });

    it('needs an Idempotency-Key, and a retry with the same key files nothing twice', async () => {
      const { as, week, requestsRepo } = await setup();
      expect((await as.staff.post('/api/v1/leave-requests', week())).status).toBe(400);
      const send = () =>
        as.staff
          .post('/api/v1/leave-requests', week())
          .set('Idempotency-Key', 'retry-key-123456789');
      const first = await send();
      const second = await send();
      expect(first.status).toBe(201);
      expect(second.body).toEqual(first.body);
      expect(requestsRepo.requests).toHaveLength(1);
    });

    it.each([
      ['an end before the start', { startDate: '2026-11-06', endDate: '2026-11-02' }],
      ['a day that does not exist', { startDate: '2026-02-30', endDate: '2026-03-02' }],
      ['a date with a time', { startDate: '2026-11-02T00:00:00Z' }],
      ['a half day over several dates', { halfDay: true }],
      ['a non-uuid type', { leaveTypeId: 'annual' }],
      ['a blank reason', { reason: '   ' }],
      ['a reason over 500 characters', { reason: 'x'.repeat(501) }],
      ['an unknown field', { status: 'approved' }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { apply, week } = await setup();
      expect((await apply('staff', week(patch))).status).toBe(400);
    });

    it.each([
      ['an unknown leave type', { leaveTypeId: MISSING }],
      ['an inactive leave type', { leaveTypeId: RETIRED }],
      [
        'a half day of a type that does not allow it',
        { leaveTypeId: CASUAL, endDate: '2026-11-02', halfDay: true },
      ],
      ['a request across two years', { startDate: '2026-12-30', endDate: '2027-01-04' }],
      ['a start in the past', { startDate: '2026-10-30', endDate: '2026-11-02' }],
      ['only a weekend', { startDate: '2026-11-07', endDate: '2026-11-08' }],
      ['only a holiday', { startDate: '2026-11-04', endDate: '2026-11-04' }],
      [
        'a type with no balance row',
        { leaveTypeId: ANNUAL, startDate: '2027-01-04', endDate: '2027-01-04' },
      ],
    ])('rejects %s with 422', async (_name, patch) => {
      const { apply, week } = await setup();
      expect((await apply('staff', week(patch))).status).toBe(422);
    });

    it('allows a start today, and sick leave up to 7 days back but not 8', async () => {
      const { apply, week } = await setup();
      // Today is Saturday 31 October. Starting today is fine (Monday 2 November is the one working day).
      const today = await apply('staff', week({ startDate: '2026-10-31', endDate: '2026-11-02' }));
      expect(today.status).toBe(201);
      expect(today.body.data.days).toBe(1);
      const sick = (startDate: string) =>
        apply('team_lead', { leaveTypeId: SICK, startDate, endDate: '2026-10-26' });
      expect((await sick('2026-10-24')).status).toBe(201); // 7 days back
      expect((await sick('2026-10-23')).status).toBe(422); // 8 days back
    });

    it('takes half days: 0.5 day on a working day, only for a single date', async () => {
      const { apply, week } = await setup();
      const res = await apply(
        'staff',
        week({ startDate: '2026-11-03', endDate: '2026-11-03', halfDay: true }),
      );
      expect(res.body.data).toMatchObject({ days: 0.5, halfDay: true });
    });

    it('lets a type without a balance through whatever the days', async () => {
      const { apply, used, kit } = await setup();
      const res = await apply('staff', {
        leaveTypeId: UNPAID,
        startDate: '2026-11-02',
        endDate: '2026-11-27',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.days).toBe(19); // 20 weekdays minus the holiday
      expect(used(kit.users.staff.employeeId, UNPAID)).toBeUndefined();
    });

    it('refuses dates that overlap a live request, but not those of a rejected one', async () => {
      const { as, apply, week, approvalOf } = await setup();
      expect((await apply('staff', week())).status).toBe(201);
      expect(
        (await apply('staff', week({ startDate: '2026-11-06', endDate: '2026-11-10' }))).status,
      ).toBe(409);
      expect(
        (await apply('staff', week({ startDate: '2026-10-31', endDate: '2026-11-02' }))).status,
      ).toBe(409);
      // Another person's dates are their own business.
      expect((await apply('team_lead', week())).status).toBe(201);
      // After a rejection the dates are free again.
      const id = await approvalOf('team_lead');
      await as.team_lead.post(`/api/v1/approvals/${id}/reject`, { comment: 'Busy week' });
      expect((await apply('staff', week())).status).toBe(201);
    });

    it('counts the days of pending requests against the balance', async () => {
      const { apply } = await setup();
      const range = (startDate: string, endDate: string) => ({
        leaveTypeId: ANNUAL,
        startDate,
        endDate,
      });
      // 18 days. 2 to 13 November is 9 working days (the 4th is a holiday).
      expect((await apply('staff', range('2026-11-02', '2026-11-13'))).status).toBe(201);
      // 16 to 27 November is 10 more: only 9 are left, although nothing is approved yet.
      const tooMany = await apply('staff', range('2026-11-16', '2026-11-27'));
      expect(tooMany.status).toBe(422);
      expect(tooMany.body.error.message).toContain('9 day(s) available, 10 requested');
      // 16 to 26 November is exactly the 9 that are left.
      expect((await apply('staff', range('2026-11-16', '2026-11-26'))).status).toBe(201);
    });
  });

  describe('deciding (through /approvals)', () => {
    it('approval deducts the days once; repeating it, and the requester deciding, change nothing', async () => {
      const { as, apply, week, used, approvalOf, requestsRepo, auditStore, kit } = await setup();
      const staff = kit.users.staff.employeeId;
      await apply('staff', week());
      const id = await approvalOf('team_lead');

      expect((await as.staff.post(`/api/v1/approvals/${id}/approve`)).status).toBe(403);
      expect(used(staff)).toBe(0);

      expect((await as.team_lead.post(`/api/v1/approvals/${id}/approve`)).status).toBe(200);
      expect(used(staff)).toBe(4);
      expect(requestsRepo.requests[0]?.status).toBe('approved');

      expect((await as.team_lead.post(`/api/v1/approvals/${id}/approve`)).status).toBe(200);
      expect(used(staff)).toBe(4);
      const approved = auditStore.find((e) => e.action === 'leave.approve');
      expect(approved).toHaveLength(1);
      expect(approved[0]?.changes).toEqual({ balanceUsed: { from: 0, to: 4 } });
    });

    it('a rejection closes the request and deducts nothing', async () => {
      const { as, apply, week, used, approvalOf, requestsRepo, kit } = await setup();
      await apply('staff', week());
      const id = await approvalOf('team_lead');
      expect(
        (await as.team_lead.post(`/api/v1/approvals/${id}/reject`, { comment: 'No' })).status,
      ).toBe(200);
      expect(requestsRepo.requests[0]?.status).toBe('rejected');
      expect(used(kit.users.staff.employeeId)).toBe(0);
    });

    it('approving a type without a balance changes no balance', async () => {
      const { as, apply, approvalOf, requestsRepo } = await setup();
      await apply('staff', { leaveTypeId: UNPAID, startDate: '2026-11-02', endDate: '2026-11-03' });
      const id = await approvalOf('team_lead');
      expect((await as.team_lead.post(`/api/v1/approvals/${id}/approve`)).status).toBe(200);
      expect(requestsRepo.requests[0]?.status).toBe('approved');
    });

    it('when the balance no longer covers it, the approval fails with 409, stays pending, and can still be rejected', async () => {
      const { as, apply, week, used, approvalOf, requestsRepo, kit } = await setup();
      const staff = kit.users.staff.employeeId;
      await apply('staff', week()); // 4 days
      // Meanwhile other leave used up the balance.
      const balance = requestsRepo.balances.find(
        (b) => b.employeeId === staff && b.leaveTypeId === ANNUAL,
      );
      if (balance) balance.used = 16;
      const id = await approvalOf('team_lead');
      expect((await as.team_lead.post(`/api/v1/approvals/${id}/approve`)).status).toBe(409);
      expect(used(staff)).toBe(16);
      expect(requestsRepo.requests[0]?.status).toBe('pending');
      expect((await as.team_lead.get(`/api/v1/approvals/${id}`)).body.data.status).toBe('pending');
      expect(
        (await as.team_lead.post(`/api/v1/approvals/${id}/reject`, { comment: 'No balance' }))
          .status,
      ).toBe(200);
      expect(requestsRepo.requests[0]?.status).toBe('rejected');
    });

    it('a Team Lead\u2019s own leave goes to HR, who may decide it; the Team Lead cannot even see it', async () => {
      const { as, apply, week, approvalOf } = await setup();
      await apply('team_lead', week());
      const id = await approvalOf('hr_manager');
      expect((await as.team_lead.post(`/api/v1/approvals/${id}/approve`)).status).toBe(404);
      expect((await as.hr_manager.post(`/api/v1/approvals/${id}/approve`)).status).toBe(200);
    });
  });

  describe('reading', () => {
    it('/me lists only the caller\u2019s own requests, filtered and paged', async () => {
      const { as, apply } = await setup();
      await apply('staff', { leaveTypeId: ANNUAL, startDate: '2026-11-02', endDate: '2026-11-03' });
      await apply('staff', { leaveTypeId: UNPAID, startDate: '2026-11-09', endDate: '2026-11-10' });
      await apply('team_lead', {
        leaveTypeId: ANNUAL,
        startDate: '2026-11-02',
        endDate: '2026-11-03',
      });
      const mine = await as.staff.get('/api/v1/leave-requests/me');
      expect(mine.body.data).toHaveLength(2);
      expect(mine.body.data[0].startDate).toBe('2026-11-09'); // latest first
      expect(mine.body.meta.total).toBe(2);
      expect(
        (await as.staff.get('/api/v1/leave-requests/me?pageSize=1&page=2')).body.data,
      ).toHaveLength(1);
      expect(
        (await as.staff.get(`/api/v1/leave-requests/me?leaveTypeId=${UNPAID}`)).body.data,
      ).toHaveLength(1);
      expect(
        (await as.staff.get('/api/v1/leave-requests/me?status=approved')).body.data,
      ).toHaveLength(0);
      expect(
        (await as.staff.get('/api/v1/leave-requests/me?from=2026-11-10&to=2026-11-12')).body.data,
      ).toHaveLength(1);
      expect((await as.staff.get('/api/v1/leave-requests/me?employeeId=x')).status).toBe(400);
      expect((await as.staff.get('/api/v1/leave-requests/me?status=bogus')).status).toBe(400);
    });

    it.each([
      ['admin', 200],
      ['hr_manager', 200],
      ['team_lead', 200],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s listing others gets %i', async (role, status) => {
      const { as } = await setup();
      expect((await as[role].get('/api/v1/leave-requests')).status).toBe(status);
    });

    it('a Team Lead sees direct reports only, HR and Admin everyone', async () => {
      const { as, apply, week, kit } = await setup();
      await apply('staff', week());
      await apply('team_lead', week());
      await apply('hr_manager', week());
      const owners = async (who: Role, query = '') =>
        (await as[who].get(`/api/v1/leave-requests${query}`)).body.data.map(
          (r: { employeeId: string }) => r.employeeId,
        );
      expect(await owners('team_lead')).toEqual([kit.users.staff.employeeId]);
      expect(await owners('hr_manager')).toHaveLength(3);
      expect(await owners('admin')).toHaveLength(3);
      expect(await owners('team_lead', `?employeeId=${kit.users.hr_manager.employeeId}`)).toEqual(
        [],
      );
    });

    it('one request is readable by its owner and its approvers, and a stranger gets the 404 of a missing one', async () => {
      const { as, apply, week } = await setup();
      // The Team Lead has no manager, so only HR, Admin and the lead can read this one.
      const created = await apply('team_lead', week());
      const id = created.body.data.id as string;
      for (const who of ['team_lead', 'hr_manager', 'admin'] as Role[]) {
        expect((await as[who].get(`/api/v1/leave-requests/${id}`)).status, who).toBe(200);
      }
      expectNoExistenceLeak(
        await as.staff.get(`/api/v1/leave-requests/${id}`),
        await as.staff.get(`/api/v1/leave-requests/${MISSING}`),
      );
      // The Team Lead reads the staff member's request; the staff member cannot read the lead's.
      const staffs = await apply('staff', week({ startDate: '2026-11-16', endDate: '2026-11-17' }));
      expect((await as.team_lead.get(`/api/v1/leave-requests/${staffs.body.data.id}`)).status).toBe(
        200,
      );
      expect((await as.staff.get('/api/v1/leave-requests/not-a-uuid')).status).toBe(400);
    });
  });
});
