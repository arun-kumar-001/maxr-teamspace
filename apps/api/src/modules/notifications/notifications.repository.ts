import type { PoolClient } from 'pg';
import {
  AppNotification,
  DueTask,
  NewNotification,
  NotificationTx,
  PoolGetter,
  Recipient,
  StaleApproval,
} from './notifications.types';

export interface INotificationsRepository {
  transaction<T>(work: (tx: NotificationTx) => Promise<T>): Promise<T>;
  /** Creates the notification; null when the same dedupe key already exists for the recipient. */
  insert(input: NewNotification): Promise<AppNotification | null>;
  /** Only the recipient's own, newest first. */
  list(
    employeeId: string,
    options: { unreadOnly: boolean; offset: number; limit: number },
  ): Promise<{ items: AppNotification[]; total: number; unread: number }>;
  /** Marks one of the recipient's own notifications read (read again keeps the first time). Null when it is not theirs. */
  markRead(id: string, employeeId: string): Promise<AppNotification | null>;
  markAllRead(employeeId: string): Promise<number>;
  /** One in-app notification for every active employee, in the caller's transaction. Returns how many. */
  announce(tx: NotificationTx, title: string, body: string): Promise<number>;
  /** Deletes read notifications read before `cutoff`. Returns how many. */
  deleteReadBefore(cutoff: Date): Promise<number>;
  findRecipient(employeeId: string): Promise<Recipient | null>;
  findManagerOf(employeeId: string): Promise<Recipient | null>;
  /** Active HR Managers and Admins, except `excludeEmployeeId`. */
  findHrApprovers(excludeEmployeeId: string): Promise<Recipient[]>;
  /** Pending approvals whose current step has waited since before `cutoff`. */
  findStaleApprovals(cutoff: Date): Promise<StaleApproval[]>;
  /**
   * Open tasks due by tomorrow on the company calendar and not more than a week overdue, as of
   * `now`. The bound keeps the query small and stops a task that was missed years ago from being
   * reminded about forever.
   */
  findTasksDueSoon(now: Date): Promise<DueTask[]>;
}

interface Row {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: Date | null;
  created_at: Date;
}

const COLUMNS = `id, type, title, body, link, read_at, created_at`;
const toNotification = (row: Row): AppNotification => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link,
  readAt: row.read_at ? row.read_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
});

export class PgNotificationsRepository implements INotificationsRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: NotificationTx) => Promise<T>): Promise<T> {
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

  async insert(input: NewNotification): Promise<AppNotification | null> {
    const res = await this.getPool().query<Row>(
      `INSERT INTO notifications (recipient_employee_id, type, title, body, link, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (recipient_employee_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
       RETURNING ${COLUMNS}`,
      [input.recipientEmployeeId, input.type, input.title, input.body, input.link, input.dedupeKey],
    );
    return res.rows[0] ? toNotification(res.rows[0]) : null;
  }

  async list(
    employeeId: string,
    options: { unreadOnly: boolean; offset: number; limit: number },
  ): Promise<{ items: AppNotification[]; total: number; unread: number }> {
    const where = `recipient_employee_id = $1${options.unreadOnly ? ' AND read_at IS NULL' : ''}`;
    const counts = await this.getPool().query<{ total: string; unread: string }>(
      `SELECT COUNT(*) FILTER (WHERE ${options.unreadOnly ? 'read_at IS NULL' : 'TRUE'}) AS total,
              COUNT(*) FILTER (WHERE read_at IS NULL) AS unread
         FROM notifications WHERE recipient_employee_id = $1`,
      [employeeId],
    );
    const res = await this.getPool().query<Row>(
      `SELECT ${COLUMNS} FROM notifications WHERE ${where}
        ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`,
      [employeeId, options.limit, options.offset],
    );
    return {
      items: res.rows.map(toNotification),
      total: Number(counts.rows[0]?.total ?? 0),
      unread: Number(counts.rows[0]?.unread ?? 0),
    };
  }

  async markRead(id: string, employeeId: string): Promise<AppNotification | null> {
    const res = await this.getPool().query<Row>(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
        WHERE id = $1 AND recipient_employee_id = $2 RETURNING ${COLUMNS}`,
      [id, employeeId],
    );
    return res.rows[0] ? toNotification(res.rows[0]) : null;
  }

  async markAllRead(employeeId: string): Promise<number> {
    const res = await this.getPool().query(
      `UPDATE notifications SET read_at = NOW()
        WHERE recipient_employee_id = $1 AND read_at IS NULL`,
      [employeeId],
    );
    return res.rowCount ?? 0;
  }

  async announce(tx: NotificationTx, title: string, body: string): Promise<number> {
    const res = await tx.query(
      `INSERT INTO notifications (recipient_employee_id, type, title, body)
       SELECT id, 'announcement', $1, $2 FROM employees WHERE status = 'active'`,
      [title, body],
    );
    return res.rowCount ?? 0;
  }

  async deleteReadBefore(cutoff: Date): Promise<number> {
    const res = await this.getPool().query(
      `DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at < $1`,
      [cutoff],
    );
    return res.rowCount ?? 0;
  }

  async findRecipient(employeeId: string): Promise<Recipient | null> {
    const res = await this.getPool().query<{ id: string; email: string }>(
      `SELECT id, email FROM employees WHERE id = $1 AND status = 'active'`,
      [employeeId],
    );
    return res.rows[0] ? { employeeId: res.rows[0].id, email: res.rows[0].email } : null;
  }

  async findManagerOf(employeeId: string): Promise<Recipient | null> {
    const res = await this.getPool().query<{ id: string; email: string }>(
      `SELECT m.id, m.email FROM employees e
         JOIN employees m ON m.id = e.manager_id AND m.status = 'active'
        WHERE e.id = $1`,
      [employeeId],
    );
    return res.rows[0] ? { employeeId: res.rows[0].id, email: res.rows[0].email } : null;
  }

  async findHrApprovers(excludeEmployeeId: string): Promise<Recipient[]> {
    const res = await this.getPool().query<{ id: string; email: string }>(
      `SELECT DISTINCT e.id, e.email
         FROM employees e
         JOIN users u ON u.employee_id = e.id AND u.is_active
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.key IN ('hr_manager', 'admin')
        WHERE e.status = 'active' AND e.id <> $1
        ORDER BY e.id`,
      [excludeEmployeeId],
    );
    return res.rows.map((row) => ({ employeeId: row.id, email: row.email }));
  }

  async findTasksDueSoon(now: Date): Promise<DueTask[]> {
    // "Today" is the company's date: the timezone setting is read in the same statement.
    const res = await this.getPool().query<{
      id: string;
      assignee_employee_id: string;
      due_date: string;
    }>(
      `WITH today AS (
         SELECT ($1::timestamptz AT TIME ZONE COALESCE((SELECT timezone FROM company_settings LIMIT 1), 'UTC'))::date AS d
       )
       SELECT t.id, t.assignee_employee_id, t.due_date::text AS due_date
         FROM tasks t, today
        WHERE t.status <> 'completed'
          AND t.due_date BETWEEN today.d - 7 AND today.d + 1
        ORDER BY t.due_date, t.id`,
      [now],
    );
    return res.rows.map((row) => ({
      taskId: row.id,
      assigneeEmployeeId: row.assignee_employee_id,
      dueDate: row.due_date,
    }));
  }

  async findStaleApprovals(cutoff: Date): Promise<StaleApproval[]> {
    // The step has waited since the previous decision, or since the request for the first step.
    const res = await this.getPool().query<{
      id: string;
      subject_type: string;
      requester_employee_id: string;
      stage: 'manager' | 'hr';
    }>(
      `SELECT a.id, a.subject_type, a.requester_employee_id, a.stages[a.current_stage + 1] AS stage
         FROM approvals a
        WHERE a.status = 'pending'
          AND COALESCE((SELECT MAX(d.decided_at) FROM approval_decisions d WHERE d.approval_id = a.id),
                       a.created_at) < $1
        ORDER BY a.created_at`,
      [cutoff],
    );
    return res.rows.map((row) => ({
      approvalId: row.id,
      subjectType: row.subject_type,
      requesterEmployeeId: row.requester_employee_id,
      stage: row.stage,
    }));
  }
}
