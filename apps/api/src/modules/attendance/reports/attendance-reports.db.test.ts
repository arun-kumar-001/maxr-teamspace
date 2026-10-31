import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import type { ScopeFilter } from '../../rbac';
import type { BasicSettings } from '../../settings';
import { attendanceSummaryReport } from './attendance-reports';

/**
 * Real PostgreSQL inside one transaction that is rolled back: the report runs its queries on the
 * test's own connection. The week of Monday 2 November 2026 is used throughout.
 */
describe('attendance summary report against PostgreSQL', () => {
  let outer: PoolClient;
  let now = new Date('2026-11-06T10:00:00Z'); // Friday 6 November, 15:30 in Kolkata
  let timezone = 'Asia/Kolkata';
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const pool = () => ({ query: outer.query.bind(outer) }) as unknown as Pool;
  const settings = {
    getBasic: async () =>
      ({
        companyName: 'T',
        timezone,
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }) as unknown as BasicSettings,
  };
  const report = () => attendanceSummaryReport({ getPool: pool, settings, clock: () => now });
  const ALL: ScopeFilter = { kind: 'all' };

  const employee = async (
    name: string,
    options: { manager?: string; joined?: string; deactivatedAt?: string; dept?: string } = {},
  ) => {
    const id = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, manager_id, joining_date, status)
         VALUES ($1, $2, 'Att', $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          `AT-${run}-${name}`,
          name,
          `${name}-${run}@att.test`,
          options.dept ?? ids.dept,
          ids.desig,
          options.manager ?? null,
          options.joined ?? '2026-01-05',
          options.deactivatedAt ? 'deactivated' : 'active',
        ],
      )
    ).rows[0]?.id as string;
    if (options.deactivatedAt) {
      await outer.query(`UPDATE employees SET deactivated_at = $2 WHERE id = $1`, [
        id,
        options.deactivatedAt,
      ]);
    }
    ids[name] = id;
    return id;
  };
  const session = (
    who: string,
    day: string,
    checkIn: string,
    minutes: number | null,
    status = 'present',
  ) =>
    outer.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, duration_minutes, status)
       VALUES ($1, $2, $3::timestamptz,
               CASE WHEN $4::int IS NULL THEN NULL ELSE $3::timestamptz + make_interval(mins => $4::int) END, $4::int, $5)`,
      [ids[who], day, `${day}T${checkIn}Z`, minutes, status],
    );
  const leave = (who: string, start: string, end: string, status = 'approved') =>
    outer.query(
      `INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, days, status)
       VALUES ($1, '71000000-0000-4000-8000-000000000004', $2, $3, 1, $4)`,
      [ids[who], start, end, status],
    );
  const rows = async (filters: Record<string, unknown>, scope: ScopeFilter = ALL) => {
    const def = report();
    const parsed = def.filters.parse(filters);
    const result = await def.run({ filters: parsed, scope, offset: 0, limit: 500 });
    return {
      total: result.total,
      rows: result.rows.filter((r) => String(r.employeeCode).startsWith(`AT-${run}`)),
    };
  };
  const week = { from: '2026-11-02', to: '2026-11-06' };
  const byName = (list: Array<Record<string, unknown>>, name: string) =>
    list.find((r) => r.employeeCode === `AT-${run}-${name}`);

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Att ${run}`, `AT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.dept2 = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Att2 ${run}`, `A2-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `AT-${run}`],
      )
    ).rows[0]?.id as string;
    await employee('lead');
    await employee('amy', { manager: ids.lead });
    await employee('ben', { manager: ids.lead, joined: '2026-11-04' });
    await employee('cat', { dept: ids.dept2, deactivatedAt: '2026-11-03T05:00:00Z' });
  });
  beforeEach(async () => {
    now = new Date('2026-11-06T10:00:00Z');
    timezone = 'Asia/Kolkata';
    await outer.query('SAVEPOINT each_test');
    await outer.query(
      `INSERT INTO holidays (holiday_date, name) VALUES ('2026-11-04', 'Midweek') ON CONFLICT DO NOTHING`,
    );
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  it('counts working days, presence, late days, half days, leave, absence and hours (D-13)', async () => {
    await session('amy', '2026-11-02', '03:30:00', 480); // Monday: a full day
    await session('amy', '2026-11-03', '04:30:00', 300, 'late'); // Tuesday: late, 5 hours = a half day
    await leave('amy', '2026-11-05', '2026-11-05'); // Thursday on approved leave
    // Wednesday is a holiday; Friday has no session and no leave: absent.
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    expect(byName(list, 'amy')).toMatchObject({
      workingDays: 4,
      daysPresent: 2,
      lateDays: 1,
      halfDays: 1,
      onLeaveDays: 1,
      absentDays: 1,
      totalHours: 13,
    });
  });

  it('counts from the day the employee joined, and a joiner with no sessions is absent', async () => {
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    // Joined on the Wednesday holiday: only Thursday and Friday count.
    expect(byName(list, 'ben')).toMatchObject({
      workingDays: 2,
      daysPresent: 0,
      absentDays: 2,
      totalHours: 0,
    });
  });

  it('stops counting after the day an employee was deactivated, on the company calendar', async () => {
    const { rows: list } = await rows(week);
    // Deactivated at 10:30 on Tuesday 3 November in Kolkata: Monday and Tuesday count.
    expect(byName(list, 'cat')).toMatchObject({ workingDays: 2, absentDays: 2 });
  });

  it('does not count days after today as absent', async () => {
    now = new Date('2026-11-03T10:00:00Z'); // Tuesday
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    expect(byName(list, 'amy')).toMatchObject({ workingDays: 2, absentDays: 2 });
  });

  it('counts a half day by the policy and an open session as present with no hours', async () => {
    await session('amy', '2026-11-02', '03:30:00', 239); // just under the half day
    await session('amy', '2026-11-03', '03:30:00', 240); // exactly the half day
    await session('amy', '2026-11-05', '03:30:00', 479); // just under a full day
    await session('amy', '2026-11-06', '03:30:00', null); // still open
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    expect(byName(list, 'amy')).toMatchObject({ daysPresent: 4, halfDays: 2, absentDays: 0 });
    expect(byName(list, 'amy')?.totalHours).toBe(16); // 958 minutes = 15.97 hours, to one decimal
  });

  it('adds up several sessions of one day, and takes the first one for being late', async () => {
    await session('amy', '2026-11-02', '03:30:00', 120, 'late');
    await session('amy', '2026-11-02', '08:00:00', 150, 'present');
    await session('amy', '2026-11-03', '03:30:00', 120, 'present');
    await session('amy', '2026-11-03', '08:00:00', 150, 'present');
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    // Monday: 270 minutes in two sessions, the first late. Tuesday: both on time. Only Monday is late.
    expect(byName(list, 'amy')).toMatchObject({ daysPresent: 2, lateDays: 1, halfDays: 2 });
  });

  it('counts a rejected or pending leave request as no leave', async () => {
    await leave('amy', '2026-11-02', '2026-11-02', 'rejected');
    await leave('amy', '2026-11-03', '2026-11-03', 'pending');
    const { rows: list } = await rows(week, { kind: 'team', managerId: ids.lead as string });
    expect(byName(list, 'amy')).toMatchObject({ onLeaveDays: 0, absentDays: 4 });
  });

  it('holds a Team Lead’s direct reports only, and everyone for HR and Admin', async () => {
    const team = await rows(week, { kind: 'team', managerId: ids.lead as string });
    expect(team.rows.map((r) => r.employeeCode).sort()).toEqual([`AT-${run}-amy`, `AT-${run}-ben`]);
    const all = await rows(week);
    expect(all.rows.map((r) => r.employeeCode)).toEqual(
      expect.arrayContaining([`AT-${run}-amy`, `AT-${run}-ben`, `AT-${run}-cat`, `AT-${run}-lead`]),
    );
    const none = await rows(week, { kind: 'none' });
    expect(none.total).toBe(0);
  });

  it('filters by department and pages', async () => {
    const dept = await rows({ ...week, departmentId: ids.dept2 });
    expect(dept.rows.map((r) => r.employeeCode)).toEqual([`AT-${run}-cat`]);
    const def = report();
    const page = await def.run({
      filters: def.filters.parse({ ...week, departmentId: ids.dept }),
      scope: ALL,
      offset: 1,
      limit: 1,
    });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(3);
  });

  it('refuses a reversed range, a range of 92 days or more, and a date that does not exist', async () => {
    const def = report();
    const run1 = (filters: Record<string, unknown>) =>
      def.run({ filters: def.filters.parse(filters), scope: ALL, offset: 0, limit: 10 });
    await expect(run1({ from: '2026-11-06', to: '2026-11-02' })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(run1({ from: '2026-01-01', to: '2026-04-03' })).rejects.toMatchObject({
      statusCode: 400,
    }); // 92 days apart
    await expect(run1({ from: '2026-01-01', to: '2026-04-02' })).resolves.toBeTruthy(); // 91 days apart
    expect(() => def.filters.parse({ from: '2026-02-30', to: '2026-03-02' })).toThrow();
  });
});
