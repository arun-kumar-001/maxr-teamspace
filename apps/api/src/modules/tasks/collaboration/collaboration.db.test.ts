import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgCollaborationRepository } from './collaboration.repository';
import { MAX_ATTACHMENTS_PER_TASK, NewAttachment } from './collaboration.types';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('task comments and attachments against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgCollaborationRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT collab_tx',
      COMMIT: 'RELEASE SAVEPOINT collab_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT collab_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  const attachment = (
    taskId: string,
    text: string,
    extra: Partial<NewAttachment> = {},
  ): NewAttachment => ({
    taskId,
    uploadedByEmployeeId: ids.amy as string,
    storageKey: `task-attachments/2026/10/${randomUUID()}`,
    originalName: `${text}.pdf`,
    contentType: 'application/pdf',
    size: 100,
    sha256: sha(text),
    ...extra,
  });
  const add = (input: NewAttachment) => repo.transaction((tx) => repo.insertAttachment(tx, input));
  const refused = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };
  const newTask = async () =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO tasks (title, assignee_employee_id, assigner_employee_id) VALUES ('t', $1, $2) RETURNING id`,
        [ids.amy, ids.lead],
      )
    ).rows[0]?.id as string;

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgCollaborationRepository(() => nested(outer));
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Collab ${run}`, `CB-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `CB-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['lead', 'amy']) {
      ids[name] = (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
           VALUES ($1, $2, 'Collab', $3, $4, $5) RETURNING id`,
          [`CB-${run}-${name}`, name, `${name}-${run}@collab.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id as string;
    }
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
    it('refuses a blank comment, a bad hash, a non-positive size and a repeated key or file', async () => {
      const task = await newTask();
      expect(
        await refused(
          `INSERT INTO task_comments (task_id, author_employee_id, body) VALUES ($1, $2, '   ')`,
          [task, ids.amy],
        ),
      ).toBe('23514');
      const insert = (key: string, hash: string, size: number) =>
        refused(
          `INSERT INTO task_attachments (task_id, uploaded_by_employee_id, storage_key, original_name, content_type, size_bytes, sha256)
           VALUES ($1, $2, $3, 'a.pdf', 'application/pdf', $4, $5)`,
          [task, ids.amy, key, size, hash],
        );
      expect(await insert('k/1', 'not-a-hash', 10)).toBe('23514');
      expect(await insert('k/1', sha('x').toUpperCase(), 10)).toBe('23514');
      expect(await insert('k/1', sha('x'), 0)).toBe('23514');
      await outer.query(
        `INSERT INTO task_attachments (task_id, uploaded_by_employee_id, storage_key, original_name, content_type, size_bytes, sha256)
         VALUES ($1, $2, 'k/1', 'a.pdf', 'application/pdf', 10, $3)`,
        [task, ids.amy, sha('x')],
      );
      expect(await insert('k/1', sha('y'), 10)).toBe('23505'); // the same object twice
      expect(await insert('k/2', sha('x'), 10)).toBe('23505'); // the same file on the task twice
    });

    it('refuses a comment or attachment for a task or employee that does not exist', async () => {
      expect(
        await refused(
          `INSERT INTO task_comments (task_id, author_employee_id, body) VALUES ($1, $2, 'x')`,
          [randomUUID(), ids.amy],
        ),
      ).toBe('23503');
    });
  });

  describe('comments', () => {
    it('lists a thread oldest first with the author name, pages it, and keeps tasks apart', async () => {
      const a = await newTask();
      const b = await newTask();
      await outer.query(
        `INSERT INTO task_comments (task_id, author_employee_id, body, created_at) VALUES
           ($1, $2, 'second', NOW() - INTERVAL '1 hour'),
           ($1, $3, 'first', NOW() - INTERVAL '2 hours'),
           ($1, $2, 'third', NOW()),
           ($4, $2, 'elsewhere', NOW())`,
        [a, ids.amy, ids.lead, b],
      );
      const all = await repo.listComments(a, 0, 50);
      expect(all.items.map((c) => c.body)).toEqual(['first', 'second', 'third']);
      expect(all.items[0]?.authorName).toBe('lead Collab');
      expect(all.total).toBe(3);
      const page = await repo.listComments(a, 1, 1);
      expect(page.items.map((c) => c.body)).toEqual(['second']);
      expect(page.total).toBe(3);
      expect((await repo.listComments(b, 0, 50)).items.map((c) => c.body)).toEqual(['elsewhere']);
    });

    it('stores a comment and returns it with the author', async () => {
      const task = await newTask();
      const made = await repo.insertComment(task, ids.amy as string, 'Looks good');
      expect(made).toMatchObject({ taskId: task, authorName: 'amy Collab', body: 'Looks good' });
    });
  });

  describe('attachments', () => {
    it('stores one, returns it without the hash, finds it on its task only, and deletes it', async () => {
      const task = await newTask();
      const other = await newTask();
      const made = await add(attachment(task, 'one'));
      expect(made).toMatchObject({
        taskId: task,
        uploadedByName: 'amy Collab',
        originalName: 'one.pdf',
        size: 100,
      });
      expect(JSON.stringify(made)).not.toContain(sha('one'));
      expect(await repo.findAttachment(task, made.id)).toMatchObject({
        id: made.id,
        storageKey: made.storageKey,
      });
      expect(await repo.findAttachment(other, made.id)).toBeNull();
      expect(await repo.hasAttachmentWithHash(task, sha('one'))).toBe(true);
      expect(await repo.hasAttachmentWithHash(other, sha('one'))).toBe(false);
      await repo.transaction((tx) => repo.deleteAttachment(tx, made.id));
      expect(await repo.findAttachment(task, made.id)).toBeNull();
      expect(await repo.listAttachments(task)).toEqual([]);
    });

    it('refuses the same file twice on a task with a 409', async () => {
      const task = await newTask();
      await add(attachment(task, 'same'));
      await expect(add(attachment(task, 'same'))).rejects.toMatchObject({ statusCode: 409 });
      await expect(add(attachment(await newTask(), 'same'))).resolves.toBeTruthy();
    });

    it(`holds at most ${MAX_ATTACHMENTS_PER_TASK} files per task with a 422`, async () => {
      const task = await newTask();
      for (let i = 0; i < MAX_ATTACHMENTS_PER_TASK; i += 1) await add(attachment(task, `f${i}`));
      await expect(add(attachment(task, 'one too many'))).rejects.toMatchObject({
        statusCode: 422,
      });
      expect(await repo.listAttachments(task)).toHaveLength(MAX_ATTACHMENTS_PER_TASK);
      // Another task has its own allowance.
      await expect(add(attachment(await newTask(), 'fresh'))).resolves.toBeTruthy();
    });
  });
});
