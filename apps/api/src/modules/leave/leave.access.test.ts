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
import { ALL_ROLES, SignedIn, listRoutes, signInAs } from '../rbac/rbac.testing';
import { MemoryLeaveBalancesRepository } from './balances/balances.repository.memory';
import { MemoryHolidaysRepository } from './holidays/holidays.repository.memory';
import { createLeaveSetup } from './index';
import { MemoryLeavePoliciesRepository } from './policies/policies.repository.memory';
import type { LeavePolicy } from './policies/policies.types';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const MISSING = '73000000-0000-4000-8000-000000000999';
const seedPolicy: LeavePolicy = {
  id: ANNUAL,
  code: 'ANNUAL',
  name: 'Annual leave',
  hasBalance: true,
  isActive: true,
  annualDays: 18,
  carryForwardMax: 5,
  allowHalfDay: true,
  maxBackdateDays: 0,
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const staff = kit.users.staff.employeeId;
  const lead = kit.users.team_lead.employeeId;
  const policiesRepo = new MemoryLeavePoliciesRepository([{ ...seedPolicy }]);
  const holidaysRepo = new MemoryHolidaysRepository();
  const balancesRepo = new MemoryLeaveBalancesRepository((id) => (id === staff ? lead : null));
  const leave = createLeaveSetup({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () => ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: { start: 'Monday', end: 'Friday', days: ['Monday'] },
      }),
    },
    policiesRepository: policiesRepo,
    holidaysRepository: holidaysRepo,
    balancesRepository: balancesRepo,
    clock: () => new Date('2026-10-31T10:00:00Z'),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/leave-policies', leave.policiesRouter);
  app.use('/api/v1/holidays', leave.holidaysRouter);
  app.use('/api/v1/leave-balances', leave.balancesRouter);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const keyed = (who: Role, path: string, body: object) =>
    as[who].post(path, body).set('Idempotency-Key', `leave-${who}-${++n}-abcdefgh`);
  const balance = (employeeId: string, code = 'ANNUAL', year = 2026) => ({
    employeeId,
    employeeName: employeeId,
    leaveTypeId: ANNUAL,
    code,
    name: code,
    year,
    allotted: 18,
    carriedForward: 0,
    used: 2,
    remaining: 16,
  });
  return { app, as, kit, auditStore, policiesRepo, holidaysRepo, balancesRepo, keyed, balance };
}

const newType = {
  code: 'maternity',
  name: 'Maternity leave',
  annualDays: 180,
  allowHalfDay: false,
};

describe('leave setup API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/leave-policies'],
      ['post', '/api/v1/leave-policies'],
      ['put', `/api/v1/leave-policies/${ANNUAL}`],
      ['get', '/api/v1/holidays'],
      ['post', '/api/v1/holidays'],
      ['delete', `/api/v1/holidays/${MISSING}`],
      ['get', '/api/v1/leave-balances/me'],
      ['get', '/api/v1/leave-balances'],
      ['post', '/api/v1/leave-balances/accrual'],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) =>
      /^\/api\/v1\/(leave-policies|holidays|leave-balances)/.test(r.path),
    );
    expect(routes).toHaveLength(9);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe.each([
    ['admin', true, true],
    ['hr_manager', true, true],
    ['team_lead', false, true],
    ['staff', false, false],
  ] as Array<[Role, boolean, boolean]>)('%s', (role, manages, listsBalances) => {
    it('reads the policies and the holidays', async () => {
      const { as } = await setup();
      expect((await as[role].get('/api/v1/leave-policies')).status).toBe(200);
      expect((await as[role].get('/api/v1/holidays')).status).toBe(200);
      expect((await as[role].get('/api/v1/leave-balances/me')).status).toBe(200);
    });

    it(`${manages ? 'manages' : 'cannot manage'} policies, holidays and the accrual`, async () => {
      const { as, keyed } = await setup();
      const created = await keyed(role, '/api/v1/leave-policies', newType);
      const updated = await as[role].put(`/api/v1/leave-policies/${ANNUAL}`, {
        annualDays: 20,
        version: 1,
      });
      const holiday = await keyed(role, '/api/v1/holidays', {
        date: '2026-12-25',
        name: 'Christmas',
      });
      const removed = await as[role].delete(`/api/v1/holidays/${MISSING}`);
      const accrued = await as[role].post('/api/v1/leave-balances/accrual', { year: 2026 });
      if (manages) {
        expect([created.status, updated.status, holiday.status, accrued.status]).toEqual([
          201, 200, 201, 200,
        ]);
        expect(removed.status).toBe(404);
      } else {
        expect([
          created.status,
          updated.status,
          holiday.status,
          removed.status,
          accrued.status,
        ]).toEqual([403, 403, 403, 403, 403]);
      }
    });

    it(`${listsBalances ? 'lists' : 'cannot list'} balances`, async () => {
      const { as } = await setup();
      expect((await as[role].get('/api/v1/leave-balances')).status).toBe(listsBalances ? 200 : 403);
    });
  });

  describe('policies', () => {
    it('uppercases the code, defaults the rest and refuses a duplicate with 409', async () => {
      const { keyed } = await setup();
      const res = await keyed('hr_manager', '/api/v1/leave-policies', newType);
      expect(res.body.data).toMatchObject({
        code: 'MATERNITY',
        hasBalance: true,
        isActive: true,
        carryForwardMax: 0,
        maxBackdateDays: 0,
        version: 1,
      });
      expect((await keyed('hr_manager', '/api/v1/leave-policies', newType)).status).toBe(409);
    });

    it.each([
      ['a quarter day', { annualDays: 1.25 }],
      ['a negative amount', { annualDays: -1 }],
      ['more than a year', { annualDays: 400 }],
      ['too many back-dated days', { maxBackdateDays: 31 }],
      ['a code that starts with a digit', { code: '1ST' }],
      ['an unknown field', { employeeId: MISSING }],
      ['a type without a balance that has days', { hasBalance: false, annualDays: 3 }],
      ['a blank name', { name: '  ' }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { keyed } = await setup();
      expect(
        (await keyed('hr_manager', '/api/v1/leave-policies', { ...newType, ...patch })).status,
      ).toBe(400);
    });

    it('needs an Idempotency-Key', async () => {
      const { as } = await setup();
      expect((await as.hr_manager.post('/api/v1/leave-policies', newType)).status).toBe(400);
    });

    it('updates with the version, bumps it, and refuses a stale version, an empty change and a type that is not there', async () => {
      const { as, auditStore } = await setup();
      const ok = await as.hr_manager.put(`/api/v1/leave-policies/${ANNUAL}`, {
        annualDays: 20,
        carryForwardMax: 7.5,
        version: 1,
      });
      expect(ok.body.data).toMatchObject({ annualDays: 20, carryForwardMax: 7.5, version: 2 });
      const entry = auditStore.find((e) => e.action === 'leave_policy.update')[0];
      expect(entry?.changes).toEqual({
        annualDays: { from: 18, to: 20 },
        carryForwardMax: { from: 5, to: 7.5 },
      });
      const put = (body: object, id = ANNUAL) =>
        as.hr_manager.put(`/api/v1/leave-policies/${id}`, body);
      expect((await put({ annualDays: 21, version: 1 })).status).toBe(409);
      expect((await put({ version: 2 })).status).toBe(400);
      expect((await put({ annualDays: 21 })).status).toBe(400);
      expect((await put({ annualDays: 21, version: 2 }, MISSING)).status).toBe(404);
      expect((await put({ annualDays: 21, version: 2 }, 'nope')).status).toBe(400);
    });

    it('writes no new version and no audit entry when nothing changes', async () => {
      const { as, auditStore } = await setup();
      const res = await as.hr_manager.put(`/api/v1/leave-policies/${ANNUAL}`, {
        annualDays: 18,
        version: 1,
      });
      expect(res.body.data.version).toBe(1);
      expect(auditStore.find((e) => e.action === 'leave_policy.update')).toHaveLength(0);
    });

    it('audits the creation', async () => {
      const { keyed, auditStore } = await setup();
      await keyed('hr_manager', '/api/v1/leave-policies', newType);
      expect(auditStore.find((e) => e.action === 'leave_policy.create')).toHaveLength(1);
    });
  });

  describe('holidays', () => {
    it('adds, lists a year by date, refuses a second holiday on a date and removes a coming one', async () => {
      const { as, keyed } = await setup();
      const dec = await keyed('hr_manager', '/api/v1/holidays', {
        date: '2026-12-25',
        name: 'Christmas',
      });
      expect(dec.status).toBe(201);
      await keyed('hr_manager', '/api/v1/holidays', { date: '2026-11-01', name: 'Foundation Day' });
      await keyed('hr_manager', '/api/v1/holidays', { date: '2027-01-26', name: 'Republic Day' });
      const list = await as.staff.get('/api/v1/holidays');
      expect(list.body.data.map((h: { date: string }) => h.date)).toEqual([
        '2026-11-01',
        '2026-12-25',
      ]);
      expect((await as.staff.get('/api/v1/holidays?year=2027')).body.data).toHaveLength(1);
      expect(
        (await keyed('admin', '/api/v1/holidays', { date: '2026-12-25', name: 'Again' })).status,
      ).toBe(409);
      expect((await as.hr_manager.delete(`/api/v1/holidays/${dec.body.data.id}`)).status).toBe(200);
      expect((await as.staff.get('/api/v1/holidays')).body.data).toHaveLength(1);
    });

    it('keeps a holiday that has passed', async () => {
      const { as, holidaysRepo } = await setup();
      holidaysRepo.holidays.push({ id: MISSING, date: '2026-08-15', name: 'Independence Day' });
      expect((await as.hr_manager.delete(`/api/v1/holidays/${MISSING}`)).status).toBe(422);
      expect(holidaysRepo.holidays).toHaveLength(1);
    });

    it.each([
      ['a day that does not exist', { date: '2026-02-30' }],
      ['a date with a time', { date: '2026-12-25T00:00:00Z' }],
      ['a year out of range', { date: '1999-12-25' }],
      ['a blank name', { name: ' ' }],
      ['an unknown field', { optional: true }],
    ])('rejects %s with 400', async (_name, patch) => {
      const { keyed } = await setup();
      const res = await keyed('hr_manager', '/api/v1/holidays', {
        date: '2026-12-25',
        name: 'Christmas',
        ...patch,
      });
      expect(res.status).toBe(400);
    });

    it('audits adding and removing without personal data', async () => {
      const { as, keyed, auditStore } = await setup();
      const added = await keyed('hr_manager', '/api/v1/holidays', {
        date: '2026-12-25',
        name: 'Christmas',
      });
      await as.hr_manager.delete(`/api/v1/holidays/${added.body.data.id}`);
      expect(auditStore.find((e) => e.action === 'holiday.create')).toHaveLength(1);
      expect(auditStore.find((e) => e.action === 'holiday.delete')).toHaveLength(1);
    });
  });

  describe('balances', () => {
    it('/me returns only the caller’s balances for the year', async () => {
      const { as, kit, balancesRepo, balance } = await setup();
      balancesRepo.rows.push(
        balance(kit.users.staff.employeeId),
        balance(kit.users.staff.employeeId, 'ANNUAL', 2025),
        balance(kit.users.team_lead.employeeId),
      );
      const mine = await as.staff.get('/api/v1/leave-balances/me');
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0]).toMatchObject({ year: 2026, remaining: 16 });
      expect((await as.staff.get('/api/v1/leave-balances/me?year=2025')).body.data).toHaveLength(1);
      expect((await as.staff.get('/api/v1/leave-balances/me?year=1999')).status).toBe(400);
    });

    it('a Team Lead sees direct reports only, HR and Admin everyone', async () => {
      const { as, kit, balancesRepo, balance } = await setup();
      balancesRepo.rows.push(
        balance(kit.users.staff.employeeId),
        balance(kit.users.team_lead.employeeId),
        balance(kit.users.hr_manager.employeeId),
      );
      const ids = async (who: Role, query = '') =>
        (await as[who].get(`/api/v1/leave-balances${query}`)).body.data.map(
          (b: { employeeId: string }) => b.employeeId,
        );
      expect(await ids('team_lead')).toEqual([kit.users.staff.employeeId]);
      expect(await ids('hr_manager')).toHaveLength(3);
      expect(await ids('admin')).toHaveLength(3);
      expect(await ids('team_lead', `?employeeId=${kit.users.hr_manager.employeeId}`)).toEqual([]);
      expect(await ids('hr_manager', `?employeeId=${kit.users.hr_manager.employeeId}`)).toEqual([
        kit.users.hr_manager.employeeId,
      ]);
      expect((await as.hr_manager.get('/api/v1/leave-balances?pageSize=1000')).status).toBe(400);
      expect((await as.hr_manager.get('/api/v1/leave-balances?employeeId=x')).status).toBe(400);
    });

    it('runs the accrual, audits it and refuses a year that has not started', async () => {
      const { as, balancesRepo, auditStore } = await setup();
      balancesRepo.createdPerAccrual = 12;
      const res = await as.hr_manager.post('/api/v1/leave-balances/accrual', { year: 2026 });
      expect(res.body.data).toEqual({ year: 2026, created: 12 });
      expect(balancesRepo.accruals).toEqual([{ year: 2026, employeeId: undefined }]);
      expect(auditStore.find((e) => e.action === 'leave_balances.accrue')[0]?.changes).toEqual({
        year: 2026,
        created: 12,
      });
      expect(
        (await as.hr_manager.post('/api/v1/leave-balances/accrual', { year: 2027 })).status,
      ).toBe(422);
      expect((await as.hr_manager.post('/api/v1/leave-balances/accrual', {})).status).toBe(400);
      expect(
        (await as.hr_manager.post('/api/v1/leave-balances/accrual', { year: 2026, x: 1 })).status,
      ).toBe(400);
    });
  });
});
