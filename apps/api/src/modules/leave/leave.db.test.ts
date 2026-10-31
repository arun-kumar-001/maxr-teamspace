import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { PgLeaveBalancesRepository } from './balances/balances.repository';
import { LeaveBalancesService } from './balances/balances.service';
import { PgHolidaysRepository } from './holidays/holidays.repository';
import { HolidaysService } from './holidays/holidays.service';
import { PgLeavePoliciesRepository } from './policies/policies.repository';
import { LeavePoliciesService } from './policies/policies.service';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const UNPAID = '71000000-0000-4000-8000-000000000004';
const caller = { actorId: randomUUID(), employeeId: randomUUID(), requestId: 'req' };

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The
 * repositories' own transactions become savepoints. The clock is fixed at 2026-10-31.
 */
describe('leave policies, holidays and balances against PostgreSQL', () => {
  let outer: PoolClient;
  let policies: LeavePoliciesService;
  let holidays: HolidaysService;
  let balances: LeaveBalancesService;
  let balancesRepo: PgLeaveBalancesRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT leave_tx',
      COMMIT: 'RELEASE SAVEPOINT leave_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT leave_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };
  const pool = () => nested(outer);
  const settings = {
    getBasic: async () =>
      ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: { start: 'Monday', end: 'Friday', days: [] },
      }) as never,
  };

  const employee = async (
    name: string,
    joiningDate: string,
    status = 'active',
    managerId?: string,
  ) =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, joining_date, status, manager_id)
         VALUES ($1, $2, 'Leave', $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          `LV-${run}-${name}`,
          name,
          `${name}-${run}@leave.test`,
          ids.dept,
          ids.desig,
          joiningDate,
          status,
          managerId ?? null,
        ],
      )
    ).rows[0]?.id as string;
  const balancesOf = async (employeeId: string, year: number) =>
    Object.fromEntries(
      (await balancesRepo.findForEmployee(employeeId, year)).map((b) => [b.code, b]),
    );
  const accrue = (year: number, employeeId?: string) =>
    balancesRepo.transaction((tx) => balancesRepo.accrue(tx, year, employeeId));
  const refused = async (sql: string, values: unknown[] = []) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    const clock = () => new Date('2026-10-31T10:00:00Z');
    policies = new LeavePoliciesService(new PgLeavePoliciesRepository(pool), platform);
    holidays = new HolidaysService(new PgHolidaysRepository(pool), platform, settings, clock);
    balancesRepo = new PgLeaveBalancesRepository(pool);
    balances = new LeaveBalancesService(balancesRepo, platform, settings, clock);
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Leave ${run}`, `LV-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `LV-${run}`],
      )
    ).rows[0]?.id as string;
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  describe('the migration', () => {
    it('seeds the types and policies of decision D-12', async () => {
      const list = Object.fromEntries((await policies.list()).map((p) => [p.code, p]));
      expect(list.ANNUAL).toMatchObject({ annualDays: 18, carryForwardMax: 5, hasBalance: true });
      expect(list.CASUAL).toMatchObject({ annualDays: 6, carryForwardMax: 0 });
      expect(list.SICK).toMatchObject({ annualDays: 12, maxBackdateDays: 7 });
      expect(list.UNPAID).toMatchObject({ hasBalance: false, annualDays: 0 });
      expect(list.ANNUAL?.id).toBe(ANNUAL);
    });

    it('refuses amounts that are not half-day steps, too many back-dated days and a negative or over-spent balance', async () => {
      const type = await outer.query<{ id: string }>(
        `INSERT INTO leave_types (code, name) VALUES ($1, $2) RETURNING id`,
        [`T${randomUUID().slice(0, 8).toUpperCase()}`, randomUUID()],
      );
      const policy = (annual: number, backdate = 0) =>
        refused(
          `INSERT INTO leave_policies (leave_type_id, annual_days, max_backdate_days) VALUES ($1, $2, $3)`,
          [type.rows[0]?.id, annual, backdate],
        );
      expect(await policy(1.3)).toBe('23514');
      expect(await policy(-1)).toBe('23514');
      expect(await policy(5, 31)).toBe('23514');
      expect(await policy(5.5, 30)).toBeNull(); // the half step and the upper bound are allowed

      const amy = await employee('amy', '2020-01-01');
      const insert = (allotted: number, carried: number, used: number, year = 2026) =>
        refused(
          `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, carried_forward, used)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [amy, ANNUAL, year, allotted, carried, used],
        );
      expect(await insert(10, 2, 12.5)).toBe('23514'); // over-spent
      expect(await insert(10, 2, 12)).toBeNull(); // spent exactly
      expect(await insert(10, 0, 0, 2025)).toBeNull();
      await outer.query(
        `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted) VALUES ($1, $2, 2025, 10)`,
        [amy, ANNUAL],
      );
      expect(await insert(10, 0, 0, 2025)).toBe('23505'); // one row per employee, type and year
      expect(await insert(-1, 0, 0, 2024)).toBe('23514');
      expect(await insert(10.3, 0, 0, 2024)).toBe('23514');
      expect(await insert(10, 0, 0, 1999)).toBe('23514');
    });

    it('allows one holiday per date', async () => {
      await outer.query(
        `INSERT INTO holidays (holiday_date, name) VALUES ('2026-12-25', 'Christmas')`,
      );
      expect(
        await refused(`INSERT INTO holidays (holiday_date, name) VALUES ('2026-12-25', 'Again')`),
      ).toBe('23505');
    });
  });

  describe('policies', () => {
    it('creates a type with its policy; the code is any case on the way in and unique', async () => {
      const created = await policies.create(
        {
          code: 'MATERNITY',
          name: 'Maternity leave',
          hasBalance: true,
          annualDays: 180,
          carryForwardMax: 0,
          allowHalfDay: false,
          maxBackdateDays: 0,
        },
        caller,
      );
      expect(created).toMatchObject({
        code: 'MATERNITY',
        annualDays: 180,
        isActive: true,
        version: 1,
      });
      await expect(
        policies.create({ ...created, code: 'MATERNITY2', name: 'maternity LEAVE' }, caller),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        policies.create({ ...created, code: 'MATERNITY', name: 'Other' }, caller),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('updates with the version it read, bumps it, and refuses a stale one', async () => {
      const before = (await policies.list()).find((p) => p.id === ANNUAL);
      const updated = await policies.update(
        ANNUAL,
        { annualDays: 20, version: before?.version ?? 0 },
        caller,
      );
      expect(updated).toMatchObject({ annualDays: 20, version: (before?.version ?? 0) + 1 });
      await expect(
        policies.update(ANNUAL, { annualDays: 21, version: before?.version ?? 0 }, caller),
      ).rejects.toMatchObject({ statusCode: 409 });
      // Changing nothing writes nothing.
      const same = await policies.update(
        ANNUAL,
        { annualDays: 20, version: updated.version },
        caller,
      );
      expect(same.version).toBe(updated.version);
      await expect(
        policies.update(ANNUAL, { name: 'casual leave', version: updated.version }, caller),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        policies.update(UNPAID, { annualDays: 3, version: 1 }, caller),
      ).rejects.toMatchObject({ statusCode: 422 });
      await expect(
        policies.update(randomUUID(), { annualDays: 3, version: 1 }, caller),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('holidays', () => {
    it('lists a year by date, answers the dates between two days, and removes only a holiday that has not passed', async () => {
      const past = await holidays.create({ date: '2026-08-15', name: 'Independence Day' }, caller);
      const soon = await holidays.create({ date: '2026-11-01', name: 'Foundation Day' }, caller);
      await holidays.create({ date: '2026-10-31', name: 'Today' }, caller);
      await holidays.create({ date: '2027-01-26', name: 'Republic Day' }, caller);
      expect((await holidays.list(2026)).map((h) => h.date)).toEqual([
        '2026-08-15',
        '2026-10-31',
        '2026-11-01',
      ]);
      expect((await holidays.list(undefined)).length).toBe(3); // the current company year
      expect(await holidays.datesBetween('2026-10-31', '2027-01-26')).toEqual([
        '2026-10-31',
        '2026-11-01',
        '2027-01-26',
      ]);
      await expect(
        holidays.create({ date: '2026-08-15', name: 'Dup' }, caller),
      ).rejects.toMatchObject({
        statusCode: 409,
      });
      await expect(holidays.remove(past.id, caller)).rejects.toMatchObject({ statusCode: 422 });
      await expect(holidays.remove(soon.id, caller)).resolves.toMatchObject({ date: '2026-11-01' });
      await expect(holidays.remove(soon.id, caller)).rejects.toMatchObject({ statusCode: 404 });
      // Today is not "passed": it can still be removed.
      const todays = (await holidays.list(2026)).find((h) => h.date === '2026-10-31');
      await expect(holidays.remove(todays?.id ?? '', caller)).resolves.toMatchObject({
        date: '2026-10-31',
      });
    });
  });

  describe('balances', () => {
    it('credits the full allotment of D-12 to someone who joined earlier and gives UNPAID no balance', async () => {
      const amy = await employee('amy', '2020-05-10');
      await accrue(2026, amy);
      const b = await balancesOf(amy, 2026);
      expect(b.ANNUAL).toMatchObject({ allotted: 18, carriedForward: 0, used: 0, remaining: 18 });
      expect(b.CASUAL?.allotted).toBe(6);
      expect(b.SICK?.allotted).toBe(12);
      expect(b.UNPAID).toBeUndefined();
    });

    it.each([
      ['1 January: the whole year', '2026-01-01', 18, 6, 12],
      ['15 March: ten months left', '2026-03-15', 15, 5, 10],
      ['1 October: three months left', '2026-10-01', 4.5, 1.5, 3],
      ['31 December: one month left, in half-day steps', '2026-12-31', 1.5, 0.5, 1],
    ])('pro-rates a joiner on %s', async (_name, joined, annual, casual, sick) => {
      const id = await employee('joiner', joined);
      await accrue(2026, id);
      const b = await balancesOf(id, 2026);
      expect([b.ANNUAL?.allotted, b.CASUAL?.allotted, b.SICK?.allotted]).toEqual([
        annual,
        casual,
        sick,
      ]);
    });

    it('does not credit a year before the employee joined, and credits it pro-rata when it comes', async () => {
      const id = await employee('future', '2027-07-01');
      await accrue(2026, id);
      expect(await balancesOf(id, 2026)).toEqual({});
      await accrue(2027, id);
      expect((await balancesOf(id, 2027)).ANNUAL?.allotted).toBe(9); // July to December
    });

    it('carries forward what is left of the year before, up to the policy maximum', async () => {
      const many = await employee('many', '2020-01-01');
      const few = await employee('few', '2020-01-01');
      for (const [id, used] of [
        [many, 6],
        [few, 16],
      ] as const) {
        await outer.query(
          `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, used) VALUES ($1, $2, 2025, 18, $3)`,
          [id, ANNUAL, used],
        );
        await outer.query(
          `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, used)
           SELECT $1, id, 2025, 6, 0 FROM leave_types WHERE code = 'CASUAL'`,
          [id],
        );
      }
      await accrue(2026, many);
      await accrue(2026, few);
      const a = await balancesOf(many, 2026);
      const b = await balancesOf(few, 2026);
      expect(a.ANNUAL).toMatchObject({ allotted: 18, carriedForward: 5, remaining: 23 }); // 12 left, capped at 5
      expect(b.ANNUAL).toMatchObject({ carriedForward: 2, remaining: 20 }); // 2 left
      expect(a.CASUAL?.carriedForward).toBe(0); // the casual policy carries nothing
    });

    it('is safe to run twice and never touches a balance that exists', async () => {
      const id = await employee('twice', '2020-01-01');
      expect(await accrue(2026, id)).toBe(3);
      await outer.query(
        `UPDATE leave_balances SET used = 4 WHERE employee_id = $1 AND leave_type_id = $2`,
        [id, ANNUAL],
      );
      expect(await accrue(2026, id)).toBe(0);
      expect((await balancesOf(id, 2026)).ANNUAL?.used).toBe(4);
    });

    it('skips deactivated employees, inactive types and types without a balance, and includes pending joiners', async () => {
      const gone = await employee('gone', '2020-01-01', 'deactivated');
      const pending = await employee('pending', '2020-01-01', 'pending');
      await policies.update(
        '71000000-0000-4000-8000-000000000002',
        {
          isActive: false,
          version: (await policies.list()).find((p) => p.code === 'CASUAL')?.version ?? 1,
        },
        caller,
      );
      await accrue(2026);
      expect(await balancesOf(gone, 2026)).toEqual({});
      const p = await balancesOf(pending, 2026);
      expect(Object.keys(p).sort()).toEqual(['ANNUAL', 'SICK']);
    });

    it('limits the accrual to one employee when asked', async () => {
      const one = await employee('one', '2020-01-01');
      const other = await employee('other', '2020-01-01');
      await accrue(2026, one);
      expect(Object.keys(await balancesOf(one, 2026))).toHaveLength(3);
      expect(await balancesOf(other, 2026)).toEqual({});
    });

    it('refuses a year that has not started and audits the run', async () => {
      await expect(balances.accrue(2027, caller)).rejects.toMatchObject({ statusCode: 422 });
      const result = await balances.accrue(2026, caller);
      expect(result.year).toBe(2026);
      expect(result.created).toBeGreaterThanOrEqual(0);
    });

    it('gives a joiner their balances from the joining year, or the current year when they joined earlier', async () => {
      const early = await employee('early', '2025-03-10');
      const next = await employee('next', '2027-04-01');
      await balances.initializeForJoiner(outer, early, '2025-03-10');
      await balances.initializeForJoiner(outer, next, '2027-04-01');
      expect((await balancesOf(early, 2026)).ANNUAL?.allotted).toBe(18);
      expect(await balancesOf(early, 2025)).toEqual({});
      expect((await balancesOf(next, 2027)).ANNUAL?.allotted).toBe(13.5); // April to December
    });

    it('reads balances inside the caller’s scope, filtered and paged', async () => {
      const lead = await employee('lead', '2020-01-01');
      const report = await employee('report', '2020-01-01', 'active', lead);
      const stranger = await employee('stranger', '2020-01-01');
      for (const id of [lead, report, stranger]) await accrue(2026, id);
      const team = await balances.list(
        { page: 1, pageSize: 20, year: 2026 },
        { kind: 'team', managerId: lead },
      );
      expect(new Set(team.data.map((b) => b.employeeId))).toEqual(new Set([report]));
      expect(team.meta.total).toBe(3);
      const own = await balances.list(
        { page: 1, pageSize: 20 },
        { kind: 'own', employeeId: stranger },
      );
      expect(own.data.every((b) => b.employeeId === stranger)).toBe(true);
      const paged = await balances.list(
        { page: 2, pageSize: 2, employeeId: report, year: 2026 },
        { kind: 'all' },
      );
      expect(paged.data).toHaveLength(1);
      expect(paged.meta.total).toBe(3);
      const none = await balances.list(
        { page: 1, pageSize: 20, employeeId: report, year: 2026 },
        { kind: 'team', managerId: stranger },
      );
      expect(none.meta.total).toBe(0);
    });
  });
});
