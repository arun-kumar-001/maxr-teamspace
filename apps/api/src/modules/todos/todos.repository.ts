import type { Pool } from 'pg';
import {
  CreateTodoDto,
  ITodosRepository,
  ListTodosQuery,
  ListTodosResult,
  PersonalTodo,
  UpdateTodoDto,
} from './todos.types';

interface TodoRow {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: TodoRow): PersonalTodo {
  return {
    id: row.id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date ? String(row.due_date).substring(0, 10) : null,
    isCompleted: row.is_completed,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PostgresTodosRepository implements ITodosRepository {
  constructor(private readonly getPool: () => Pool) {}

  async list(employeeId: string, query?: ListTodosQuery): Promise<ListTodosResult> {
    const pool = this.getPool();
    const limit = query?.limit ?? 50;
    const offset = query?.offset ?? 0;

    const conditions: string[] = ['employee_id = $1'];
    const values: unknown[] = [employeeId];

    if (query?.completed !== undefined) {
      values.push(query.completed);
      conditions.push(`is_completed = $${values.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // 1. Total count
    const countSql = `SELECT COUNT(*)::int AS total FROM personal_todos WHERE ${whereClause}`;
    const countRes = await pool.query<{ total: number }>(countSql, values);
    const total = countRes.rows[0]?.total ?? 0;

    // 2. Paginated rows
    const queryValues = [...values, limit, offset];
    const dataSql = `
      SELECT id, employee_id, title, description, due_date, is_completed, completed_at, created_at, updated_at
      FROM personal_todos
      WHERE ${whereClause}
      ORDER BY is_completed ASC, due_date ASC NULLS LAST, created_at DESC
      LIMIT $${queryValues.length - 1} OFFSET $${queryValues.length}
    `;

    const { rows } = await pool.query<TodoRow>(dataSql, queryValues);
    const data = rows.map(mapRow);

    return {
      data,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + data.length < total,
      },
    };
  }

  async findById(id: string, employeeId: string): Promise<PersonalTodo | null> {
    const pool = this.getPool();
    const sql = `
      SELECT id, employee_id, title, description, due_date, is_completed, completed_at, created_at, updated_at
      FROM personal_todos
      WHERE id = $1 AND employee_id = $2
    `;
    const { rows } = await pool.query<TodoRow>(sql, [id, employeeId]);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async create(employeeId: string, dto: CreateTodoDto): Promise<PersonalTodo> {
    const pool = this.getPool();
    const sql = `
      INSERT INTO personal_todos (employee_id, title, description, due_date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, employee_id, title, description, due_date, is_completed, completed_at, created_at, updated_at
    `;
    const { rows } = await pool.query<TodoRow>(sql, [
      employeeId,
      dto.title,
      dto.description ?? null,
      dto.dueDate ?? null,
    ]);
    const row = rows[0];
    if (!row) throw new Error('Failed to insert todo');
    return mapRow(row);
  }

  async update(id: string, employeeId: string, dto: UpdateTodoDto): Promise<PersonalTodo | null> {
    const pool = this.getPool();
    const existing = await this.findById(id, employeeId);
    if (!existing) return null;

    const updates: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [id, employeeId];

    if (dto.title !== undefined) {
      values.push(dto.title);
      updates.push(`title = $${values.length}`);
    }
    if (dto.description !== undefined) {
      values.push(dto.description ?? null);
      updates.push(`description = $${values.length}`);
    }
    if (dto.dueDate !== undefined) {
      values.push(dto.dueDate ?? null);
      updates.push(`due_date = $${values.length}`);
    }
    if (dto.isCompleted !== undefined) {
      values.push(dto.isCompleted);
      updates.push(`is_completed = $${values.length}`);
      if (dto.isCompleted) {
        updates.push(`completed_at = NOW()`);
      } else {
        updates.push(`completed_at = NULL`);
      }
    }

    const sql = `
      UPDATE personal_todos
      SET ${updates.join(', ')}
      WHERE id = $1 AND employee_id = $2
      RETURNING id, employee_id, title, description, due_date, is_completed, completed_at, created_at, updated_at
    `;
    const { rows } = await pool.query<TodoRow>(sql, values);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async toggle(id: string, employeeId: string): Promise<PersonalTodo | null> {
    const pool = this.getPool();
    const sql = `
      UPDATE personal_todos
      SET is_completed = NOT is_completed,
          completed_at = CASE WHEN NOT is_completed THEN NOW() ELSE NULL END,
          updated_at = NOW()
      WHERE id = $1 AND employee_id = $2
      RETURNING id, employee_id, title, description, due_date, is_completed, completed_at, created_at, updated_at
    `;
    const { rows } = await pool.query<TodoRow>(sql, [id, employeeId]);
    const row = rows[0];
    return row ? mapRow(row) : null;
  }

  async delete(id: string, employeeId: string): Promise<boolean> {
    const pool = this.getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM personal_todos WHERE id = $1 AND employee_id = $2`,
      [id, employeeId],
    );
    return (rowCount ?? 0) > 0;
  }
}
