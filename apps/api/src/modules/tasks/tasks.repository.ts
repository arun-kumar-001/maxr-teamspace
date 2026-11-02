import type { PoolClient } from 'pg';
import type { TaskPriority, TaskStatus } from './task-rules';
import {
  AssigneeRow,
  NewTask,
  PoolGetter,
  Task,
  TaskTx,
  TaskValues,
  TaskViewer,
} from './tasks.types';

export interface ListTasksParams {
  viewer: TaskViewer;
  /** `mine`: assigned to the viewer. `team`: assigned by the viewer or to their direct reports (an Admin: all). */
  mode: 'mine' | 'team';
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  assigneeEmployeeId?: string;
  dueFrom?: string;
  dueTo?: string;
  /** Only tasks past their due date as of this company date that are not completed. */
  overdueBefore?: string;
  offset: number;
  limit: number;
}

export interface ITasksRepository {
  transaction<T>(work: (tx: TaskTx) => Promise<T>): Promise<T>;
  /** The assignee's status and manager, read under a share lock so they cannot be deactivated mid-write. */
  findAssignee(tx: TaskTx, employeeId: string): Promise<AssigneeRow | null>;
  insert(tx: TaskTx, input: NewTask): Promise<string>;
  /** Locks the task row until the transaction ends. */
  lockForUpdate(tx: TaskTx, id: string): Promise<Omit<Task, 'isOverdue'> | null>;
  /** Writes the values, sets or clears `completed_at` to match the status, and bumps the version. */
  update(tx: TaskTx, id: string, values: TaskValues): Promise<void>;
  /** One task, only when the viewer is party to it, manages its assignee, or is an Admin. */
  find(id: string, viewer: TaskViewer): Promise<Omit<Task, 'isOverdue'> | null>;
  findMany(
    params: ListTasksParams,
  ): Promise<{ items: Array<Omit<Task, 'isOverdue'>>; total: number }>;
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
  assignee_employee_id: string;
  assignee_name: string;
  assigner_employee_id: string;
  assigner_name: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const toTask = (row: Row): Omit<Task, 'isOverdue'> => ({
  id: row.id,
  title: row.title,
  description: row.description,
  projectId: row.project_id,
  projectName: row.project_name,
  assigneeEmployeeId: row.assignee_employee_id,
  assigneeName: row.assignee_name,
  assignerEmployeeId: row.assigner_employee_id,
  assignerName: row.assigner_name,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  version: row.version,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// DATE columns are read as text so the driver does not turn them into local-midnight Dates.
const SELECT = `
  SELECT t.id, t.title, t.description, t.project_id, p.name AS project_name,
         t.assignee_employee_id, a.first_name || ' ' || a.last_name AS assignee_name,
         t.assigner_employee_id, r.first_name || ' ' || r.last_name AS assigner_name,
         t.status, t.priority, t.due_date::text AS due_date, t.completed_at, t.version,
         t.created_at, t.updated_at
    FROM tasks t
    JOIN employees a ON a.id = t.assignee_employee_id
    JOIN employees r ON r.id = t.assigner_employee_id
    LEFT JOIN projects p ON p.id = t.project_id`;

/** The viewer manages the task's assignee. */
const MANAGES = (param: string) =>
  `EXISTS (SELECT 1 FROM employees m WHERE m.id = t.assignee_employee_id AND m.manager_id = ${param})`;

export class PgTasksRepository implements ITasksRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: TaskTx) => Promise<T>): Promise<T> {
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

  async findAssignee(tx: TaskTx, employeeId: string): Promise<AssigneeRow | null> {
    const res = await tx.query<{ id: string; status: string; manager_id: string | null }>(
      `SELECT id, status, manager_id FROM employees WHERE id = $1 FOR SHARE`,
      [employeeId],
    );
    const row = res.rows[0];
    return row ? { employeeId: row.id, status: row.status, managerId: row.manager_id } : null;
  }

  async insert(tx: TaskTx, input: NewTask): Promise<string> {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO tasks (title, description, project_id, assignee_employee_id,
                          assigner_employee_id, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        input.title,
        input.description,
        input.projectId,
        input.assigneeEmployeeId,
        input.assignerEmployeeId,
        input.priority,
        input.dueDate,
      ],
    );
    return (res.rows[0] as { id: string }).id;
  }

  async lockForUpdate(tx: TaskTx, id: string): Promise<Omit<Task, 'isOverdue'> | null> {
    const locked = await tx.query(`SELECT 1 FROM tasks WHERE id = $1 FOR UPDATE`, [id]);
    if (locked.rowCount === 0) return null;
    const res = await tx.query<Row>(`${SELECT} WHERE t.id = $1`, [id]);
    return res.rows[0] ? toTask(res.rows[0]) : null;
  }

  async update(tx: TaskTx, id: string, values: TaskValues): Promise<void> {
    await tx.query(
      `UPDATE tasks
          SET title = $2, description = $3, project_id = $4, assignee_employee_id = $5,
              priority = $6, due_date = $7, status = $8::varchar,
              completed_at = CASE WHEN $8::varchar = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
              version = version + 1, updated_at = NOW()
        WHERE id = $1`,
      [
        id,
        values.title,
        values.description,
        values.projectId,
        values.assigneeEmployeeId,
        values.priority,
        values.dueDate,
        values.status,
      ],
    );
  }

  async find(id: string, viewer: TaskViewer): Promise<Omit<Task, 'isOverdue'> | null> {
    const visible = viewer.all
      ? 'TRUE'
      : `(t.assignee_employee_id = $2 OR t.assigner_employee_id = $2 OR ${MANAGES('$2')})`;
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE t.id = $1 AND ${visible}`,
      viewer.all ? [id] : [id, viewer.employeeId],
    );
    return res.rows[0] ? toTask(res.rows[0]) : null;
  }

  async findMany(
    params: ListTasksParams,
  ): Promise<{ items: Array<Omit<Task, 'isOverdue'>>; total: number }> {
    const values: unknown[] = [];
    const add = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    let where: string;
    if (params.mode === 'mine') {
      where = `t.assignee_employee_id = ${add(params.viewer.employeeId)}`;
    } else if (params.viewer.all) {
      where = 'TRUE';
    } else {
      const me = add(params.viewer.employeeId);
      where = `(t.assigner_employee_id = ${me} OR ${MANAGES(me)})`;
    }
    if (params.status) where += ` AND t.status = ${add(params.status)}`;
    if (params.priority) where += ` AND t.priority = ${add(params.priority)}`;
    if (params.projectId) where += ` AND t.project_id = ${add(params.projectId)}`;
    if (params.assigneeEmployeeId) {
      where += ` AND t.assignee_employee_id = ${add(params.assigneeEmployeeId)}`;
    }
    if (params.dueFrom) where += ` AND t.due_date >= ${add(params.dueFrom)}::date`;
    if (params.dueTo) where += ` AND t.due_date <= ${add(params.dueTo)}::date`;
    if (params.overdueBefore) {
      where += ` AND t.status <> 'completed' AND t.due_date < ${add(params.overdueBefore)}::date`;
    }
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM tasks t WHERE ${where}`,
      values,
    );
    const limit = add(params.limit);
    const offset = add(params.offset);
    const res = await this.getPool().query<Row>(
      // Open work first, soonest due first (undated last), then the most urgent.
      `${SELECT} WHERE ${where}
        ORDER BY (t.status = 'completed'), t.due_date NULLS LAST,
                 CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                 t.created_at, t.id
        LIMIT ${limit} OFFSET ${offset}`,
      values,
    );
    return { items: res.rows.map(toTask), total: Number(total.rows[0]?.count ?? 0) };
  }
}
