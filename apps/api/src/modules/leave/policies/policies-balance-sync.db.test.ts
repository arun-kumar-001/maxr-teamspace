import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { PgLeaveBalancesRepository } from '../balances/balances.repository';
import { LeaveBalancesService } from '../balances/balances.service';
import { PgLeavePoliciesRepository } from './policies.repository';
import { LeavePoliciesService } from './policies.service';

const caller = { actorId: randomUUID(), requestId: 'req' };

/**
 * Real PostgreSQL inside one rolled-back transaction (a savepoint per test), clock fixed at
 * 2026-10-31: what a leave type change does to the balances that already exist.
 */
describe('changing a leave type keeps its balances in line (PostgreSQL)', () => {
  let outer: PoolClient;
  let policies: LeavePoliciesService;
  const run = randomUUID().slice(0, 6).toUpperCase();
  const ids: Record<string, string> = {};
  let seq = 0;

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

  const employee = async (name: string, joiningDate: string) =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, joining_date, status)
         VALUES ($1, $2, 'Sync', $3, $4, $5, $6, 'active') RETURNING id`,
        [`SY-${run}-${name}`, name, `${name}-${run}@sync.test`, ids.dept, ids.desig, joiningDate],
      )
    ).rows[0]?.id as string;

  const leaveType = (hasBalance: boolean, annualDays: number) => {
    seq += 1;
    return policies.create(
      {
        code: `SY${run}${seq}`,
        name: `Sync ${run} ${seq}`,
        hasBalance,
        annualDays,
        carryForwardMax: 0,
        allowHalfDay: true,
        maxBackdateDays: 0,
      },
      caller,
    );
  };

  const current = async (id: string) => (await policies.list()).find((p) => p.id === id)!;

  const balanceOf = async (employeeId: string, leaveTypeId: string) => {
    const res = await outer.query<{ allotted: string; carried_forward: string; used: string }>(
      `SELECT allotted, carried_forward, used FROM leave_balances
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026`,
      [employeeId, leaveTypeId],
    );
    const row = res.rows[0];
    return row
      ? {
          allotted: Number(row.allotted),
          carriedForward: Number(row.carried_forward),
          used: Number(row.used),
        }
      : null;
  };
  const setUsed = (employeeId: string, leaveTypeId: string, used: number) =>
    outer.query(
      `UPDATE leave_balances SET used = $3
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = 2026`,
      [employeeId, leaveTypeId, used],
    );
  const approvedLeave = (employeeId: string, leaveTypeId: string, days: number) =>
    outer.query(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
       VALUES ($1, $2, '2026-03-02', $3, $4, 'approved')`,
      [employeeId, leaveTypeId, `2026-03-0${1 + days}`, days],
    );

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    const clock = () => new Date('2026-10-31T10:00:00Z');
    const balances = new LeaveBalancesService(
      new PgLeaveBalancesRepository(pool),
      platform,
      settings,
      clock,
    );
    policies = new LeavePoliciesService(
      new PgLeavePoliciesRepository(pool),
      platform,
      (tx) => balances.accrueCurrentYear(tx),
      (tx, leaveTypeId, options) => balances.syncTypeCurrentYear(tx, leaveTypeId, options),
    );
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Sync ${run}`, `SY-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
        [ids.dept],
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

  describe('annual days', () => {
    it('leaves existing balances alone by default (D-12), and changes them when asked', async () => {
      const full = await employee('Full', '2025-01-05');
      const joinedOct = await employee('Oct', '2026-10-12');
      const type = await leaveType(true, 0);
      expect(await balanceOf(full, type.id)).toMatchObject({ allotted: 0 });

      await policies.update(type.id, { annualDays: 12, version: type.version }, caller);
      expect(await balanceOf(full, type.id)).toMatchObject({ allotted: 0 });

      await policies.update(
        type.id,
        { annualDays: 14, applyToCurrentBalances: true, version: (await current(type.id)).version },
        caller,
      );
      expect(await balanceOf(full, type.id)).toMatchObject({ allotted: 14 });
      // Joined in October: 3 of the 12 months are left, pro rata, like a new balance.
      expect(await balanceOf(joinedOct, type.id)).toMatchObject({ allotted: 3.5 });
    });

    it('keeps the days already used when the allowance changes', async () => {
      const worker = await employee('Used', '2025-01-05');
      const type = await leaveType(true, 10);
      await setUsed(worker, type.id, 4);

      await policies.update(
        type.id,
        { annualDays: 8, applyToCurrentBalances: true, version: type.version },
        caller,
      );

      expect(await balanceOf(worker, type.id)).toMatchObject({ allotted: 8, used: 4 });
    });

    it('refuses an allowance below what was used, and changes nothing', async () => {
      const worker = await employee('Over', '2025-01-05');
      const type = await leaveType(true, 10);
      await setUsed(worker, type.id, 6);

      await expect(
        policies.update(
          type.id,
          { annualDays: 4, applyToCurrentBalances: true, version: type.version },
          caller,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });

      expect(await balanceOf(worker, type.id)).toMatchObject({ allotted: 10, used: 6 });
      expect(await current(type.id)).toMatchObject({ annualDays: 10 });
    });
  });

  describe('switching the balance on and off', () => {
    it('builds balances from the approved leave when a type starts keeping a balance', async () => {
      const worker = await employee('On', '2025-01-05');
      const type = await leaveType(false, 0);
      await approvedLeave(worker, type.id, 2);
      expect(await balanceOf(worker, type.id)).toBeNull();

      await policies.update(
        type.id,
        { hasBalance: true, annualDays: 12, version: type.version },
        caller,
      );

      expect(await balanceOf(worker, type.id)).toEqual({
        allotted: 12,
        carriedForward: 0,
        used: 2,
      });
    });

    it('refuses to start a balance that is smaller than the leave already approved', async () => {
      const worker = await employee('Small', '2025-01-05');
      const type = await leaveType(false, 0);
      await approvedLeave(worker, type.id, 3);

      await expect(
        policies.update(
          type.id,
          { hasBalance: true, annualDays: 2, version: type.version },
          caller,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });

      expect(await balanceOf(worker, type.id)).toBeNull();
      expect(await current(type.id)).toMatchObject({ hasBalance: false });
    });

    it('switches the balance off and removes untouched balances', async () => {
      const worker = await employee('Off', '2025-01-05');
      const type = await leaveType(true, 5);
      expect(await balanceOf(worker, type.id)).toMatchObject({ allotted: 5 });

      await policies.update(
        type.id,
        { hasBalance: false, annualDays: 0, version: type.version },
        caller,
      );

      expect(await balanceOf(worker, type.id)).toBeNull();
      expect(await current(type.id)).toMatchObject({ hasBalance: false, annualDays: 0 });
    });

    it('will not switch the balance off once some of it was used', async () => {
      const worker = await employee('Keep', '2025-01-05');
      const type = await leaveType(true, 5);
      await setUsed(worker, type.id, 1);

      await expect(
        policies.update(
          type.id,
          { hasBalance: false, annualDays: 0, version: type.version },
          caller,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(await balanceOf(worker, type.id)).toMatchObject({ allotted: 5, used: 1 });
    });
  });
});
