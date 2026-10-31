import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import type { ScopeFilter } from '../../rbac';
import type { BasicSettings } from '../../settings';
import { leaveUsageReport } from './leave-reports';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const CASUAL = '71000000-0000-4000-8000-000000000002';

/** Real PostgreSQL inside one transaction that is rolled back. */
describe('leave usage report against PostgreSQL', () => {
  let outer: PoolClient;
  let now = new Date('2026-11-06T10:00:00Z');
  let timezone = 'Asia/Kolkata';
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const pool = () => ({ query: outer.query.bind(outer) }) as unknown as Pool;
  const settings = {
    getBasic: async () => ({ companyName: 'T', timezone }) as unknown as BasicSettings,
  };
  const ALL: ScopeFilter = { kind: 'all' };

  const employee = async (name: string, manager?: string, dept?: string) =>
    (ids[name] = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'Lv', $3, $4, $5, $6) RETURNING id`,
        [
          `LU-${run}-${name}`,
          name,
          `${name}-${run}@lu.test`,
          dept ?? ids.dept,
          ids.desig,
          manager ?? null,
        ],
      )
    ).rows[0]?.id as string);
  const balance = (
    who: string,
    type: string,
    year: number,
    allotted: number,
    carried: number,
    used: number,
  ) =>
    outer.query(
      `INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, carried_forward, used)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ids[who], type, year, allotted, carried, used],
    );
  const request = (
    who: string,
    type: string,
    start: string,
    end: string,
    days: number,
    status: string,
  ) =>
    outer.query(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ids[who], type, start, end, days, status],
    );
  const rows = async (
    filters: Record<string, unknown>,
    scope: ScopeFilter = ALL,
    offset = 0,
    limit = 500,
  ) => {
    const def = leaveUsageReport({ getPool: pool, settings, clock: () => now });
    const result = await def.run({ filters: def.filters.parse(filters), scope, offset, limit });
    return {
      total: result.total,
      rows: result.rows.filter((r) => String(r.employeeCode).startsWith(`LU-${run}`)),
    };
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`LU ${run}`, `LU-${run}`],
      )
    ).rows[0]?.id as string;
    ids.dept2 = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`LU2 ${run}`, `L2-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `LU-${run}`],
      )
    ).rows[0]?.id as string;
    await employee('lead');
    await employee('amy', ids.lead);
    await employee('ben', ids.lead);
    await employee('cat', undefined, ids.dept2);
  });
  beforeEach(async () => {
    now = new Date('2026-11-06T10:00:00Z');
    timezone = 'Asia/Kolkata';
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

  it('shows allotted, carried forward, used, pending and remaining per employee and type', async () => {
    await balance('amy', ANNUAL, 2026, 18, 2, 5);
    await request('amy', ANNUAL, '2026-12-01', '2026-12-03', 3, 'pending');
    await request('amy', ANNUAL, '2026-12-10', '2026-12-10', 1, 'applied');
    await request('amy', ANNUAL, '2026-03-02', '2026-03-06', 5, 'approved'); // already in `used`
    await request('amy', ANNUAL, '2026-04-01', '2026-04-01', 1, 'rejected');
    await request('amy', CASUAL, '2026-12-20', '2026-12-20', 1, 'pending'); // another type
    const { rows: list } = await rows({ leaveTypeId: ANNUAL });
    const amy = list.find((r) => r.employeeCode === `LU-${run}-amy`);
    expect(amy).toMatchObject({
      leaveType: 'Annual leave',
      year: 2026,
      allotted: 18,
      carriedForward: 2,
      used: 5,
      pending: 4,
      remaining: 15,
    });
  });

  it('defaults to the current year on the company calendar, and takes a year filter', async () => {
    await balance('amy', ANNUAL, 2025, 18, 0, 18);
    await balance('amy', ANNUAL, 2026, 18, 0, 1);
    expect((await rows({})).rows.map((r) => r.year)).toEqual([2026]);
    expect((await rows({ year: 2025 })).rows.map((r) => [r.year, r.remaining])).toEqual([
      [2025, 0],
    ]);
    // 20:00 UTC on 31 December is already 2027 in Kolkata.
    now = new Date('2026-12-31T20:00:00Z');
    await balance('amy', CASUAL, 2027, 6, 0, 0);
    expect((await rows({})).rows.map((r) => r.year)).toEqual([2027]);
    timezone = 'UTC';
    expect((await rows({})).rows.map((r) => r.year)).toEqual([2026]);
  });

  it('holds a Team Lead’s direct reports only, and everyone for HR and Admin', async () => {
    for (const who of ['lead', 'amy', 'ben', 'cat']) await balance(who, ANNUAL, 2026, 18, 0, 0);
    const team = await rows({}, { kind: 'team', managerId: ids.lead as string });
    expect(team.rows.map((r) => r.employeeCode).sort()).toEqual([`LU-${run}-amy`, `LU-${run}-ben`]);
    const all = await rows({});
    expect(all.rows).toHaveLength(4);
    expect((await rows({}, { kind: 'none' })).total).toBe(0);
  });

  it('filters by department and leave type, and pages', async () => {
    for (const who of ['amy', 'ben', 'cat']) {
      await balance(who, ANNUAL, 2026, 18, 0, 0);
      await balance(who, CASUAL, 2026, 6, 0, 0);
    }
    expect((await rows({ departmentId: ids.dept2 })).rows).toHaveLength(2);
    expect(
      (await rows({ leaveTypeId: CASUAL })).rows.every((r) => r.leaveType === 'Casual leave'),
    ).toBe(true);
    const page = await rows({ departmentId: ids.dept }, ALL, 1, 1);
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(4);
  });
});
