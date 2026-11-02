import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import type { ScopeFilter } from '../../rbac';
import type { BasicSettings } from '../../settings';
import { projectStatusReport, taskStatusReport } from './task-reports';

/** Real PostgreSQL inside one transaction that is rolled back. Today is 6 November 2026 (Kolkata). */
describe('task and project reports against PostgreSQL', () => {
  let outer: PoolClient;
  let timezone = 'Asia/Kolkata';
  const now = new Date('2026-11-06T10:00:00Z');
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const pool = () => ({ query: outer.query.bind(outer) }) as unknown as Pool;
  const settings = {
    getBasic: async () => ({ companyName: 'T', timezone }) as unknown as BasicSettings,
  };
  const deps = () => ({ getPool: pool, settings, clock: () => now });
  const ALL: ScopeFilter = { kind: 'all' };

  const employee = async (name: string, manager?: string) =>
    (ids[name] = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'Tk', $3, $4, $5, $6) RETURNING id`,
        [`TR-${run}-${name}`, name, `${name}-${run}@tr.test`, ids.dept, ids.desig, manager ?? null],
      )
    ).rows[0]?.id as string);
  const task = (who: string, status: string, due: string | null, project: string | null = null) =>
    outer.query(
      `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id, status, due_date, project_id, completed_at)
       VALUES ('t', $1, $2, $3::varchar, $4, $5, CASE WHEN $3::varchar = 'completed' THEN NOW() ELSE NULL END)`,
      [ids[who], ids.lead, status, due, project],
    );
  const project = async (code: string, owner: string, status = 'active') =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO projects (code, name, owner_employee_id, status) VALUES ($1, $2, $3, $4) RETURNING id`,
        [`${code}${run}`.toUpperCase(), `Project ${code}`, ids[owner], status],
      )
    ).rows[0]?.id as string;
  const member = (projectId: string, who: string) =>
    outer.query(`INSERT INTO project_members (project_id, employee_id) VALUES ($1, $2)`, [
      projectId,
      ids[who],
    ]);
  const taskRows = async (filters: Record<string, unknown>, scope: ScopeFilter = ALL) => {
    const def = taskStatusReport(deps());
    const result = await def.run({
      filters: def.filters.parse(filters),
      scope,
      offset: 0,
      limit: 500,
    });
    return result.rows.filter((r) => String(r.employeeCode).startsWith(`TR-${run}`));
  };
  const projectRows = async (filters: Record<string, unknown>, scope: ScopeFilter) => {
    const def = projectStatusReport(deps());
    const result = await def.run({
      filters: def.filters.parse(filters),
      scope,
      offset: 0,
      limit: 500,
    });
    return result.rows.filter((r) => String(r.code).endsWith(run.toUpperCase()));
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`TR ${run}`, `TR-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `TR-${run}`],
      )
    ).rows[0]?.id as string;
    await employee('lead');
    await employee('amy', ids.lead);
    await employee('ben', ids.lead);
    await employee('cat');
  });
  beforeEach(async () => {
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

  describe('task status', () => {
    it('counts tasks per assignee by status, with overdue on the company calendar', async () => {
      await task('amy', 'todo', '2026-11-20');
      await task('amy', 'in_progress', '2026-11-05'); // overdue
      await task('amy', 'in_review', null);
      await task('amy', 'blocked', '2026-11-06'); // due today: not overdue yet
      await task('amy', 'completed', '2026-10-01'); // completed late: never overdue
      await task('ben', 'todo', '2026-11-01'); // overdue
      const list = await taskRows({}, { kind: 'team', managerId: ids.lead as string });
      expect(list.find((r) => r.employeeCode === `TR-${run}-amy`)).toMatchObject({
        todo: 1,
        inProgress: 1,
        inReview: 1,
        blocked: 1,
        completed: 1,
        overdue: 1,
        total: 5,
      });
      expect(list.find((r) => r.employeeCode === `TR-${run}-ben`)).toMatchObject({
        todo: 1,
        overdue: 1,
        total: 1,
      });
    });

    it('works out "today" on the company calendar', async () => {
      await task('amy', 'todo', '2026-11-06');
      // 20:00 UTC on the 6th is already the 7th in Kolkata, so a task due the 6th is overdue there only.
      const late = new Date('2026-11-06T20:00:00Z');
      const run2 = async (tz: string) => {
        timezone = tz;
        const def = taskStatusReport({ getPool: pool, settings, clock: () => late });
        const result = await def.run({
          filters: def.filters.parse({}),
          scope: ALL,
          offset: 0,
          limit: 500,
        });
        return result.rows.find((r) => r.employeeCode === `TR-${run}-amy`)?.overdue;
      };
      expect(await run2('Asia/Kolkata')).toBe(1);
      expect(await run2('UTC')).toBe(0);
    });

    it('holds direct reports only for a Team Lead and filters by project and due range', async () => {
      const p = await project('p1', 'lead');
      await task('amy', 'todo', '2026-11-10', p);
      await task('amy', 'todo', '2026-12-10');
      await task('cat', 'todo', '2026-11-10');
      await task('lead', 'todo', '2026-11-10');
      const team = await taskRows({}, { kind: 'team', managerId: ids.lead as string });
      expect(team.map((r) => r.employeeCode)).toEqual([`TR-${run}-amy`]);
      expect((await taskRows({}, ALL)).length).toBe(3);
      expect((await taskRows({ projectId: p }, ALL)).map((r) => r.total)).toEqual([1]);
      expect(
        (await taskRows({ dueFrom: '2026-12-01', dueTo: '2026-12-31' }, ALL)).map((r) => r.total),
      ).toEqual([1]);
      expect((await taskRows({}, { kind: 'none' })).length).toBe(0);
    });

    it('refuses a reversed due range', async () => {
      const def = taskStatusReport(deps());
      await expect(
        def.run({
          filters: def.filters.parse({ dueFrom: '2026-12-01', dueTo: '2026-11-01' }),
          scope: ALL,
          offset: 0,
          limit: 10,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('project status', () => {
    it('counts members, tasks, completed, overdue and progress per project', async () => {
      const p = await project('prog', 'lead');
      await member(p, 'lead');
      await member(p, 'amy');
      await task('amy', 'completed', '2026-10-01', p);
      await task('amy', 'in_progress', '2026-11-01', p); // overdue
      await task('ben', 'todo', null, p);
      await project('empty', 'lead');
      const list = await projectRows({}, ALL);
      expect(list.find((r) => r.code === `PROG${run}`.toUpperCase())).toMatchObject({
        name: 'Project prog',
        status: 'active',
        owner: 'lead Tk',
        members: 2,
        tasks: 3,
        completed: 1,
        overdue: 1,
        percentComplete: 33,
      });
      expect(list.find((r) => r.code === `EMPTY${run}`.toUpperCase())).toMatchObject({
        tasks: 0,
        percentComplete: 0,
      });
    });

    it('shows a person the projects they own or belong to, and an Admin all of them', async () => {
      const mine = await project('mine', 'lead');
      await member(mine, 'amy');
      const other = await project('other', 'cat');
      expect(
        (await projectRows({}, { kind: 'own', employeeId: ids.amy as string })).map((r) => r.name),
      ).toEqual(['Project mine']);
      expect(
        (await projectRows({}, { kind: 'own', employeeId: ids.lead as string })).map((r) => r.name),
      ).toEqual(['Project mine']);
      expect(await projectRows({}, { kind: 'own', employeeId: ids.ben as string })).toEqual([]);
      expect((await projectRows({}, ALL)).length).toBe(2);
      expect(await projectRows({}, { kind: 'none' })).toEqual([]);
      expect(other).toBeTruthy();
    });

    it('filters by status', async () => {
      await project('live', 'lead');
      await project('done', 'lead', 'archived');
      expect((await projectRows({ status: 'archived' }, ALL)).map((r) => r.name)).toEqual([
        'Project done',
      ]);
    });
  });
});
