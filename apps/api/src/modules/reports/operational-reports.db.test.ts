import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { makeApp } from '../../test/helpers';
import { registerAttendanceReports } from '../attendance/reports/attendance-reports';
import { registerLeaveReports } from '../leave/reports/leave-reports';
import { signInAs } from '../rbac/rbac.testing';
import type { BasicSettings } from '../settings';
import { registerTaskReports } from '../tasks/reports/task-reports';
import { ReportRegistry } from './index';

const ALL_NAMES = ['attendance-summary', 'leave-usage', 'project-status', 'task-status'];

/**
 * The attendance, leave and task reports through the real routes: who sees which report, whose
 * rows they get, and that an export is audited. The data lives in one rolled-back transaction.
 */
describe('attendance, leave and task reports through the API', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const pool = () => ({ query: outer.query.bind(outer) }) as unknown as Pool;
  const settings = {
    getBasic: async () =>
      ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }) as unknown as BasicSettings,
  };

  const setup = async () => {
    const registry = new ReportRegistry();
    const deps = { getPool: pool, settings, clock: () => new Date('2026-11-06T10:00:00Z') };
    registerAttendanceReports(registry, deps);
    registerLeaveReports(registry, deps);
    registerTaskReports(registry, deps);
    const ctx = makeApp({ reportRegistry: registry });
    const as = {
      admin: await signInAs(ctx.app, ctx.authKit, 'admin'),
      hr: await signInAs(ctx.app, ctx.authKit, 'hr_manager'),
      lead: await signInAs(ctx.app, ctx.authKit, 'team_lead'),
      staff: await signInAs(ctx.app, ctx.authKit, 'staff'),
    };
    return { ...ctx, as };
  };

  const employee = async (name: string, id: string | undefined, manager?: string) =>
    (ids[name] = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (id, employee_code, first_name, last_name, email, department_id, designation_id, manager_id, joining_date)
         VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, 'Op', $4, $5, $6, $7, '2026-01-05') RETURNING id`,
        [
          id ?? null,
          `OP-${run}-${name}`,
          name,
          `${name}-${run}@op.test`,
          ids.dept,
          ids.desig,
          manager ?? null,
        ],
      )
    ).rows[0]?.id as string);

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Op ${run}`, `OP-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `OP-${run}`],
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

  /** The test sign-in users are not database rows, so the Team Lead's identity is given one. */
  const seed = async (kit: { users: { team_lead: { employeeId: string } } }) => {
    await employee('lead', kit.users.team_lead.employeeId);
    await employee('amy', undefined, ids.lead);
    await employee('cat', undefined);
    await outer.query(
      `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id) VALUES ('t', $1, $2), ('t', $3, $2)`,
      [ids.amy, ids.lead, ids.cat],
    );
  };

  it('lists the reports a role may run, and nothing at all to Staff', async () => {
    const { as } = await setup();
    const names = async (who: 'admin' | 'hr' | 'lead') =>
      ((await as[who].get('/api/v1/reports')).body.data as Array<{ name: string }>).map(
        (r) => r.name,
      );
    expect(await names('admin')).toEqual(ALL_NAMES);
    expect(await names('lead')).toEqual(ALL_NAMES);
    // HR has no task-board scope (D-34): the task report is not theirs, the others are.
    expect(await names('hr')).toEqual(['attendance-summary', 'leave-usage', 'project-status']);
    expect(
      (await as.staff.get('/api/v1/reports/attendance-summary?from=2026-11-02&to=2026-11-06'))
        .status,
    ).toBe(403);
  });

  it('gives a Team Lead their direct reports and an Admin everyone', async () => {
    const { as, authKit } = await setup();
    await seed(authKit);
    const query = '?from=2026-11-02&to=2026-11-06&pageSize=100';
    const codes = async (who: 'admin' | 'hr' | 'lead') =>
      (
        (await as[who].get(`/api/v1/reports/attendance-summary${query}`)).body.data as Array<{
          employeeCode: string;
        }>
      )
        .map((r) => r.employeeCode)
        .filter((c) => c.startsWith(`OP-${run}`))
        .sort();
    expect(await codes('lead')).toEqual([`OP-${run}-amy`]);
    expect(await codes('admin')).toEqual([`OP-${run}-amy`, `OP-${run}-cat`, `OP-${run}-lead`]);
    expect(await codes('hr')).toEqual([`OP-${run}-amy`, `OP-${run}-cat`, `OP-${run}-lead`]);
  });

  it('keeps the task report to the Team Lead’s team and refuses HR', async () => {
    const { as, authKit } = await setup();
    await seed(authKit);
    const lead = await as.lead.get('/api/v1/reports/task-status?pageSize=100');
    expect(
      (lead.body.data as Array<{ employeeCode: string }>)
        .map((r) => r.employeeCode)
        .filter((c) => c.startsWith(`OP-${run}`)),
    ).toEqual([`OP-${run}-amy`]);
    // A report the role has no data permission for does not exist for them.
    expect((await as.hr.get('/api/v1/reports/task-status')).status).toBe(404);
  });

  it('exports a report as CSV with only its declared columns, and audits the export', async () => {
    const { as, authKit, auditStore } = await setup();
    await seed(authKit);
    const res = await as.lead.get(
      '/api/v1/reports/attendance-summary/export?from=2026-11-02&to=2026-11-06&format=csv',
    );
    expect(res.status).toBe(200);
    // The file starts with a byte-order mark so Excel reads it as UTF-8.
    expect(res.text.replace(/^\ufeff/, '').split(/\r?\n/)[0]).toBe(
      'Code,Employee,Department,Working days,Days present,Late days,Half days,On leave,Absent,Hours worked',
    );
    expect(res.text).toContain(`OP-${run}-amy`);
    expect(res.text).not.toContain(`OP-${run}-cat`);
    const entries = auditStore.find((e) => e.action === 'report.export');
    expect(entries).toHaveLength(1);
    expect(JSON.stringify(entries[0])).toContain('attendance-summary');
  });

  it('rejects a missing range, an unknown filter and an oversized range with 400', async () => {
    const { as } = await setup();
    expect((await as.admin.get('/api/v1/reports/attendance-summary')).status).toBe(400);
    expect(
      (await as.admin.get('/api/v1/reports/attendance-summary?from=2026-11-02&to=2026-11-06&x=1'))
        .status,
    ).toBe(400);
    expect(
      (await as.admin.get('/api/v1/reports/attendance-summary?from=2026-01-01&to=2026-12-31'))
        .status,
    ).toBe(400);
    expect((await as.admin.get('/api/v1/reports/leave-usage?year=1999')).status).toBe(400);
  });
});
