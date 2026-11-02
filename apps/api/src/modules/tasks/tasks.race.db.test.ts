import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { SqlAuditStore } from '../../platform/audit/sql-audit-store';
import { PgTasksRepository } from './tasks.repository';
import { TaskCaller, TasksService } from './tasks.service';
import type { TaskViewer } from './tasks.types';

/**
 * Real PostgreSQL. Row locks cannot be shown inside one rolled-back transaction, so this file
 * commits its own fixtures (unique codes per run) and deletes them at the end. The repository is
 * slowed down between its read and its write so that two requests really do overlap.
 */
describe('tasks: concurrent changes against PostgreSQL', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', lead: '', staff: '' };
  let delayMs = 0;

  class SlowRepository extends PgTasksRepository {
    override async update(...args: Parameters<PgTasksRepository['update']>) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      return super.update(...args);
    }
  }
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform } = createTestPlatform({ logger: silent, auditStore: new SqlAuditStore(pool) });
  const service = new TasksService(
    new SlowRepository(getPool),
    platform,
    {
      getBasic: async () =>
        ({
          companyName: 'T',
          timezone: 'Asia/Kolkata',
          workWeek: { start: 'Monday', end: 'Friday', days: [] },
        }) as never,
    },
    { access: async () => null },
    () => new Date('2026-10-31T10:00:00Z'),
  );

  const lead = (): TaskCaller => ({ actorId: randomUUID(), employeeId: ids.lead });
  const staff = (): TaskCaller => ({ actorId: randomUUID(), employeeId: ids.staff });
  const view = (employeeId: string): TaskViewer => ({ employeeId, all: false });
  const makeTask = async () => {
    const task = await service.create(
      { title: `Race ${run}`, assigneeEmployeeId: ids.staff, priority: 'medium' },
      lead(),
      view(ids.lead),
    );
    return task.id;
  };
  const stored = async (id: string) =>
    (
      await pool.query<{ status: string; title: string; version: number }>(
        `SELECT status, title, version FROM tasks WHERE id = $1`,
        [id],
      )
    ).rows[0];

  beforeAll(async () => {
    ids.dept = (
      await pool.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Race ${run}`, `RC-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await pool.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `RC-${run}`],
      )
    ).rows[0]?.id as string;
    const add = async (name: string, managerId?: string) =>
      (
        await pool.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
           VALUES ($1, $2, 'Race', $3, $4, $5, $6) RETURNING id`,
          [
            `RC-${run}-${name}`,
            name,
            `${name}-${run}@race.test`,
            ids.dept,
            ids.desig,
            managerId ?? null,
          ],
        )
      ).rows[0]?.id as string;
    ids.lead = await add('lead');
    ids.staff = await add('staff', ids.lead);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM tasks WHERE assignee_employee_id = $1`, [ids.staff]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.staff, ids.lead]]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('two different moves at once are decided one after the other: exactly one wins, the other is illegal from the new status', async () => {
    const id = await makeTask();
    await service.changeStatus(id, 'in_progress', staff(), view(ids.staff));
    delayMs = 150;
    const results = await Promise.allSettled([
      service.changeStatus(id, 'in_review', staff(), view(ids.staff)),
      service.changeStatus(id, 'blocked', lead(), view(ids.lead)),
    ]);
    delayMs = 0;
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ statusCode: 422 });
    const winner =
      results.findIndex((r) => r.status === 'fulfilled') === 0 ? 'in_review' : 'blocked';
    expect(await stored(id)).toMatchObject({ status: winner, version: 3 });
  });

  it('the same move twice at once is applied once and answers 200 both times', async () => {
    const id = await makeTask();
    delayMs = 150;
    const results = await Promise.allSettled([
      service.changeStatus(id, 'in_progress', staff(), view(ids.staff)),
      service.changeStatus(id, 'in_progress', staff(), view(ids.staff)),
    ]);
    delayMs = 0;
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await stored(id)).toMatchObject({ status: 'in_progress', version: 2 });
  });

  it('an edit and a move at once never lose each other: the stored task shows every change that succeeded', async () => {
    const id = await makeTask();
    delayMs = 150;
    const results = await Promise.allSettled([
      service.update(id, { title: `Edited ${run}`, version: 1 }, lead(), view(ids.lead)),
      service.changeStatus(id, 'in_progress', staff(), view(ids.staff)),
    ]);
    delayMs = 0;
    const edited = results[0]?.status === 'fulfilled';
    const moved = results[1]?.status === 'fulfilled';
    expect(moved).toBe(true); // a move has no version to go stale
    const row = await stored(id);
    expect(row?.status).toBe('in_progress');
    // The edit either landed in full or was refused as stale; it never silently vanished.
    expect(row?.title).toBe(edited ? `Edited ${run}` : `Race ${run}`);
    expect(row?.version).toBe(edited ? 3 : 2);
    if (!edited) {
      expect((results[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    }
  });
});
