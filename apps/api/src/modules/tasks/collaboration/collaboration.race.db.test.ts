import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgCollaborationRepository } from './collaboration.repository';
import { MAX_ATTACHMENTS_PER_TASK } from './collaboration.types';

/**
 * Real PostgreSQL. The per-task lock cannot be shown inside one rolled-back transaction, so this
 * file commits its own fixtures (unique codes per run) and deletes them at the end.
 */
describe('task attachments: concurrent uploads against PostgreSQL', () => {
  const pool = getPool();
  const repo = new PgCollaborationRepository(getPool);
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', lead: '', amy: '', task: '' };

  const upload = (text: string) =>
    repo.transaction((tx) =>
      repo.insertAttachment(tx, {
        taskId: ids.task,
        uploadedByEmployeeId: ids.amy,
        storageKey: `task-attachments/2026/10/${randomUUID()}`,
        originalName: `${text}.pdf`,
        contentType: 'application/pdf',
        size: 10,
        sha256: createHash('sha256').update(text).digest('hex'),
      }),
    );

  beforeAll(async () => {
    ids.dept = (
      await pool.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`CollabRace ${run}`, `CR-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await pool.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `CR-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['lead', 'amy'] as const) {
      ids[name] = (
        await pool.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
           VALUES ($1, $2, 'Race', $3, $4, $5) RETURNING id`,
          [`CR-${run}-${name}`, name, `${name}-${run}@collabrace.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id as string;
    }
    ids.task = (
      await pool.query<{ id: string }>(
        `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id) VALUES ('race', $1, $2) RETURNING id`,
        [ids.amy, ids.lead],
      )
    ).rows[0]?.id as string;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM task_attachments WHERE task_id = $1`, [ids.task]);
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [ids.task]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.amy, ids.lead]]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('25 uploads at once leave exactly 20 files, and the other 5 are refused with a 422', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, (_, i) => upload(`file ${i}`)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(MAX_ATTACHMENTS_PER_TASK);
    for (const r of results.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) {
      expect(r.reason).toMatchObject({ statusCode: 422 });
    }
    const stored = await pool.query(`SELECT 1 FROM task_attachments WHERE task_id = $1`, [
      ids.task,
    ]);
    expect(stored.rowCount).toBe(MAX_ATTACHMENTS_PER_TASK);
  });

  it('the same file sent twice at once is stored once', async () => {
    await pool.query(`DELETE FROM task_attachments WHERE task_id = $1`, [ids.task]);
    const results = await Promise.allSettled([upload('same'), upload('same')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason,
    ).toMatchObject({
      statusCode: 409,
    });
  });
});
