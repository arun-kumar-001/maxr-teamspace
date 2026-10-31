import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgTasksRepository } from './tasks.repository';
import type { TaskViewer } from './tasks.types';

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The shared
 * development database may hold other tasks, so checks name the fixtures they care about.
 */
describe('tasks against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgTasksRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT task_tx',
      COMMIT: 'RELEASE SAVEPOINT task_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT task_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const employee = async (name: string, managerId?: string, status = 'active') =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, manager_id, status)
         VALUES ($1, $2, 'Task', $3, $4, $5, $6, $7) RETURNING id`,
        [
          `TK-${run}-${name}`,
          name,
          `${name}-${run}@task.test`,
          ids.dept,
          ids.desig,
          managerId ?? null,
          status,
        ],
      )
    ).rows[0]?.id as string;
  const task = async (
    title: string,
    assignee: string,
    assigner: string,
    options: {
      status?: string;
      priority?: string;
      due?: string | null;
      project?: string | null;
    } = {},
  ) =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id, status, priority, due_date, project_id, completed_at)
         VALUES ($1, $2, $3, $4::varchar, $5, $6, $7, CASE WHEN $4::varchar = 'completed' THEN NOW() ELSE NULL END)
         RETURNING id`,
        [
          `${title}-${run}`,
          assignee,
          assigner,
          options.status ?? 'todo',
          options.priority ?? 'medium',
          options.due ?? null,
          options.project ?? null,
        ],
      )
    ).rows[0]?.id as string;
  const refused = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };
  const viewer = (employeeId: string, all = false): TaskViewer => ({ employeeId, all });
  const titles = (items: Array<{ title: string }>) =>
    items.map((t) => t.title.replace(`-${run}`, ''));
  const mine = (employeeId: string, extra: object = {}) =>
    repo.findMany({ viewer: viewer(employeeId), mode: 'mine', offset: 0, limit: 50, ...extra });

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgTasksRepository(() => nested(outer));
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Task ${run}`, `TK-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `TK-${run}`],
      )
    ).rows[0]?.id as string;
    ids.lead = await employee('lead');
    ids.other = await employee('other');
    ids.admin = await employee('admin');
    ids.amy = await employee('amy', ids.lead);
    ids.ben = await employee('ben', ids.lead);
    ids.cat = await employee('cat', ids.other);
    ids.gone = await employee('gone', ids.lead, 'deactivated');
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
    it('refuses an unknown status or priority, a blank title, and a completed_at that disagrees with the status', async () => {
      const insert = (
        status: string,
        priority: string,
        title: string,
        completedAt: string | null,
      ) =>
        refused(
          `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id, status, priority, completed_at)
           VALUES ($1, $2, $2, $3, $4, $5)`,
          [title, ids.amy, status, priority, completedAt],
        );
      expect(await insert('todo', 'medium', 'ok', null)).toBeNull();
      expect(await insert('done', 'medium', 'ok', null)).toBe('23514');
      expect(await insert('todo', 'critical', 'ok', null)).toBe('23514');
      expect(await insert('todo', 'medium', '   ', null)).toBe('23514');
      expect(await insert('completed', 'medium', 'ok', null)).toBe('23514'); // completed without a time
      expect(await insert('todo', 'medium', 'ok', '2026-11-01T00:00:00Z')).toBe('23514'); // a time without completion
      expect(await insert('completed', 'medium', 'ok', '2026-11-01T00:00:00Z')).toBeNull();
    });

    it('refuses an assignee or assigner who does not exist', async () => {
      expect(
        await refused(
          `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id) VALUES ('x', $1, $2)`,
          [randomUUID(), ids.lead],
        ),
      ).toBe('23503');
    });
  });

  describe('visibility', () => {
    it('shows a task to its assignee, its assigner, the assignee’s manager and an Admin, and to nobody else', async () => {
      const id = await task('T', ids.amy as string, ids.admin as string);
      const sees = async (v: TaskViewer) => (await repo.find(id, v)) !== null;
      expect(await sees(viewer(ids.amy as string))).toBe(true); // assignee
      expect(await sees(viewer(ids.admin as string))).toBe(true); // assigner
      expect(await sees(viewer(ids.lead as string))).toBe(true); // manages the assignee
      expect(await sees(viewer(randomUUID(), true))).toBe(true); // Admin
      expect(await sees(viewer(ids.ben as string))).toBe(false); // a colleague
      expect(await sees(viewer(ids.other as string))).toBe(false); // another team's lead
      expect(await sees(viewer(ids.cat as string))).toBe(false);
    });
  });

  describe('lists', () => {
    it('"mine" holds only what is assigned to the viewer, even for an Admin', async () => {
      await task('A', ids.amy as string, ids.lead as string);
      await task('B', ids.ben as string, ids.lead as string);
      await task('C', ids.admin as string, ids.lead as string);
      expect(titles((await mine(ids.amy as string)).items)).toEqual(['A']);
      const asAdmin = await repo.findMany({
        viewer: viewer(ids.admin as string, true),
        mode: 'mine',
        offset: 0,
        limit: 50,
      });
      expect(titles(asAdmin.items)).toEqual(['C']);
    });

    it('"team" holds what the viewer assigned and what is assigned to their reports, and an Admin sees all', async () => {
      await task('reports', ids.amy as string, ids.admin as string);
      await task('mine-self', ids.lead as string, ids.lead as string);
      await task('assigned-out', ids.cat as string, ids.lead as string);
      await task('foreign', ids.cat as string, ids.other as string);
      const team = await repo.findMany({
        viewer: viewer(ids.lead as string),
        mode: 'team',
        offset: 0,
        limit: 50,
      });
      expect(titles(team.items).sort()).toEqual(['assigned-out', 'mine-self', 'reports']);
      const all = await repo.findMany({
        viewer: viewer(ids.admin as string, true),
        mode: 'team',
        offset: 0,
        limit: 500,
        projectId: undefined,
      });
      expect(titles(all.items)).toEqual(
        expect.arrayContaining(['reports', 'mine-self', 'assigned-out', 'foreign']),
      );
    });

    it('orders open work first, soonest due first with undated last, then by priority', async () => {
      await task('done', ids.amy as string, ids.lead as string, {
        status: 'completed',
        due: '2026-11-01',
      });
      await task('undated', ids.amy as string, ids.lead as string);
      await task('later', ids.amy as string, ids.lead as string, { due: '2026-12-01' });
      await task('sooner-low', ids.amy as string, ids.lead as string, {
        due: '2026-11-05',
        priority: 'low',
      });
      await task('sooner-urgent', ids.amy as string, ids.lead as string, {
        due: '2026-11-05',
        priority: 'urgent',
      });
      expect(titles((await mine(ids.amy as string)).items)).toEqual([
        'sooner-urgent',
        'sooner-low',
        'later',
        'undated',
        'done',
      ]);
    });

    it('filters by status, priority, assignee and due range, and finds the overdue ones that are not completed', async () => {
      await task('a', ids.amy as string, ids.lead as string, {
        status: 'in_progress',
        priority: 'high',
        due: '2026-10-20',
      });
      await task('b', ids.ben as string, ids.lead as string, { due: '2026-10-25' });
      await task('c', ids.amy as string, ids.lead as string, {
        status: 'completed',
        due: '2026-10-01',
      });
      await task('d', ids.amy as string, ids.lead as string, { due: '2026-12-01' });
      const team = (extra: object) =>
        repo.findMany({
          viewer: viewer(ids.lead as string),
          mode: 'team',
          offset: 0,
          limit: 50,
          ...extra,
        });
      expect(titles((await team({ status: 'in_progress' })).items)).toEqual(['a']);
      expect(titles((await team({ priority: 'high' })).items)).toEqual(['a']);
      expect(titles((await team({ assigneeEmployeeId: ids.ben })).items)).toEqual(['b']);
      expect(titles((await team({ dueFrom: '2026-10-22', dueTo: '2026-11-30' })).items)).toEqual([
        'b',
      ]);
      expect(titles((await team({ overdueBefore: '2026-10-31' })).items)).toEqual(['a', 'b']);
      expect(titles((await team({ overdueBefore: '2026-10-20' })).items)).toEqual([]);
    });

    it('pages and counts', async () => {
      for (const n of ['p1', 'p2', 'p3']) await task(n, ids.amy as string, ids.lead as string);
      const page = await mine(ids.amy as string, { offset: 1, limit: 1 });
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(3);
    });

    it('names the assignee, the assigner and the project', async () => {
      const project = (
        await outer.query<{ id: string }>(
          `INSERT INTO projects (code, name, owner_employee_id) VALUES ($1, 'Site', $2) RETURNING id`,
          [`TK${run}`.toUpperCase(), ids.lead],
        )
      ).rows[0]?.id as string;
      await task('named', ids.amy as string, ids.lead as string, { project });
      const [found] = (await mine(ids.amy as string)).items;
      expect(found).toMatchObject({
        assigneeName: 'amy Task',
        assignerName: 'lead Task',
        projectName: 'Site',
        projectId: project,
      });
    });
  });

  describe('writes', () => {
    it('sets completed_at when completed, clears it on reopening, and bumps the version each time', async () => {
      const id = await task('W', ids.amy as string, ids.lead as string);
      const values = (status: 'todo' | 'in_progress' | 'in_review' | 'completed') => ({
        title: `W-${run}`,
        description: null,
        projectId: null,
        assigneeEmployeeId: ids.amy as string,
        priority: 'medium' as const,
        dueDate: null,
        status,
      });
      await repo.transaction(async (tx) => repo.update(tx, id, values('completed')));
      const done = await repo.find(id, viewer(ids.admin as string, true));
      expect(done).toMatchObject({ status: 'completed', version: 2 });
      expect(done?.completedAt).not.toBeNull();
      const stamp = done?.completedAt;
      await repo.transaction(async (tx) => repo.update(tx, id, values('completed')));
      expect((await repo.find(id, viewer(ids.admin as string, true)))?.completedAt).toBe(stamp);
      await repo.transaction(async (tx) => repo.update(tx, id, values('in_progress')));
      expect(await repo.find(id, viewer(ids.admin as string, true))).toMatchObject({
        status: 'in_progress',
        completedAt: null,
        version: 4,
      });
    });

    it('reads an assignee’s status and manager', async () => {
      await repo.transaction(async (tx) => {
        expect(await repo.findAssignee(tx, ids.amy as string)).toEqual({
          employeeId: ids.amy,
          status: 'active',
          managerId: ids.lead,
        });
        expect((await repo.findAssignee(tx, ids.gone as string))?.status).toBe('deactivated');
        expect(await repo.findAssignee(tx, randomUUID())).toBeNull();
      });
    });
  });
});
