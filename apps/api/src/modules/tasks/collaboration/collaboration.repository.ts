import type { PoolClient } from 'pg';
import { conflict, unprocessable } from '../../../http/errors';
import type { PoolGetter } from '../tasks.types';
import {
  CollabTx,
  MAX_ATTACHMENTS_PER_TASK,
  NewAttachment,
  StoredAttachment,
  TaskComment,
} from './collaboration.types';

export interface ICollaborationRepository {
  transaction<T>(work: (tx: CollabTx) => Promise<T>): Promise<T>;
  insertComment(taskId: string, authorEmployeeId: string, body: string): Promise<TaskComment>;
  /** Oldest first. */
  listComments(
    taskId: string,
    offset: number,
    limit: number,
  ): Promise<{ items: TaskComment[]; total: number }>;
  /**
   * Adds an attachment under a per-task lock, so the limit holds when two uploads arrive at once.
   * A 422 when the task already holds the maximum; a 409 when the same file is already attached.
   */
  insertAttachment(tx: CollabTx, input: NewAttachment): Promise<StoredAttachment>;
  hasAttachmentWithHash(taskId: string, sha256: string): Promise<boolean>;
  listAttachments(taskId: string): Promise<StoredAttachment[]>;
  findAttachment(taskId: string, attachmentId: string): Promise<StoredAttachment | null>;
  deleteAttachment(tx: CollabTx, attachmentId: string): Promise<void>;
}

interface CommentRow {
  id: string;
  task_id: string;
  author_employee_id: string;
  author_name: string;
  body: string;
  created_at: Date;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  uploaded_by_employee_id: string;
  uploaded_by_name: string;
  storage_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  created_at: Date;
}

const toComment = (row: CommentRow): TaskComment => ({
  id: row.id,
  taskId: row.task_id,
  authorEmployeeId: row.author_employee_id,
  authorName: row.author_name,
  body: row.body,
  createdAt: row.created_at.toISOString(),
});

const toAttachment = (row: AttachmentRow): StoredAttachment => ({
  id: row.id,
  taskId: row.task_id,
  uploadedByEmployeeId: row.uploaded_by_employee_id,
  uploadedByName: row.uploaded_by_name,
  storageKey: row.storage_key,
  originalName: row.original_name,
  contentType: row.content_type,
  size: row.size_bytes,
  createdAt: row.created_at.toISOString(),
});

const COMMENT_SELECT = `
  SELECT c.id, c.task_id, c.author_employee_id, e.first_name || ' ' || e.last_name AS author_name,
         c.body, c.created_at
    FROM task_comments c JOIN employees e ON e.id = c.author_employee_id`;

const ATTACHMENT_SELECT = `
  SELECT a.id, a.task_id, a.uploaded_by_employee_id, e.first_name || ' ' || e.last_name AS uploaded_by_name,
         a.storage_key, a.original_name, a.content_type, a.size_bytes, a.created_at
    FROM task_attachments a JOIN employees e ON e.id = a.uploaded_by_employee_id`;

export class PgCollaborationRepository implements ICollaborationRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: CollabTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async insertComment(
    taskId: string,
    authorEmployeeId: string,
    body: string,
  ): Promise<TaskComment> {
    const res = await this.getPool().query<{ id: string }>(
      `INSERT INTO task_comments (task_id, author_employee_id, body) VALUES ($1, $2, $3) RETURNING id`,
      [taskId, authorEmployeeId, body],
    );
    const row = await this.getPool().query<CommentRow>(`${COMMENT_SELECT} WHERE c.id = $1`, [
      (res.rows[0] as { id: string }).id,
    ]);
    return toComment(row.rows[0] as CommentRow);
  }

  async listComments(taskId: string, offset: number, limit: number) {
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM task_comments WHERE task_id = $1`,
      [taskId],
    );
    const res = await this.getPool().query<CommentRow>(
      `${COMMENT_SELECT} WHERE c.task_id = $1 ORDER BY c.created_at, c.id LIMIT $2 OFFSET $3`,
      [taskId, limit, offset],
    );
    return { items: res.rows.map(toComment), total: Number(total.rows[0]?.count ?? 0) };
  }

  async insertAttachment(tx: CollabTx, input: NewAttachment): Promise<StoredAttachment> {
    // Counting and inserting must not interleave with another upload to the same task.
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `task-attachments:${input.taskId}`,
    ]);
    const count = await tx.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM task_attachments WHERE task_id = $1`,
      [input.taskId],
    );
    if (Number(count.rows[0]?.count ?? 0) >= MAX_ATTACHMENTS_PER_TASK) {
      throw unprocessable(`A task can hold at most ${MAX_ATTACHMENTS_PER_TASK} files`);
    }
    try {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO task_attachments
           (task_id, uploaded_by_employee_id, storage_key, original_name, content_type, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          input.taskId,
          input.uploadedByEmployeeId,
          input.storageKey,
          input.originalName,
          input.contentType,
          input.size,
          input.sha256,
        ],
      );
      const row = await tx.query<AttachmentRow>(`${ATTACHMENT_SELECT} WHERE a.id = $1`, [
        (res.rows[0] as { id: string }).id,
      ]);
      return toAttachment(row.rows[0] as AttachmentRow);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict('This file is already attached to the task');
      }
      throw err;
    }
  }

  async hasAttachmentWithHash(taskId: string, sha256: string): Promise<boolean> {
    const res = await this.getPool().query(
      `SELECT 1 FROM task_attachments WHERE task_id = $1 AND sha256 = $2`,
      [taskId, sha256],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listAttachments(taskId: string): Promise<StoredAttachment[]> {
    const res = await this.getPool().query<AttachmentRow>(
      `${ATTACHMENT_SELECT} WHERE a.task_id = $1 ORDER BY a.created_at, a.id`,
      [taskId],
    );
    return res.rows.map(toAttachment);
  }

  async findAttachment(taskId: string, attachmentId: string): Promise<StoredAttachment | null> {
    const res = await this.getPool().query<AttachmentRow>(
      `${ATTACHMENT_SELECT} WHERE a.task_id = $1 AND a.id = $2`,
      [taskId, attachmentId],
    );
    return res.rows[0] ? toAttachment(res.rows[0]) : null;
  }

  async deleteAttachment(tx: CollabTx, attachmentId: string): Promise<void> {
    await tx.query(`DELETE FROM task_attachments WHERE id = $1`, [attachmentId]);
  }
}
