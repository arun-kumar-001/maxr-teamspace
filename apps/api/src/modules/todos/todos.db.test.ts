import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PostgresTodosRepository } from './todos.repository';

describe('todos against PostgreSQL', () => {
  const pool = getPool();
  const repo = new PostgresTodosRepository(getPool);
  const run = randomUUID().slice(0, 8);
  const ids = {
    dept: '',
    desig: '',
    emp1: '',
    emp2: '',
  };

  beforeAll(async () => {
    // 1. Department
    const dept = await pool.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Todos Dept ${run}`, `TD-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';

    // 2. Designation
    const desig = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Todo Tester', $2) RETURNING id`,
      [ids.dept, `TDD-${run}`],
    );
    ids.desig = desig.rows[0]?.id ?? '';

    // 3. Employees
    const addEmp = async (suffix: string) => {
      const res = await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, $2, 'Tester', $3, $4, $5) RETURNING id`,
        [
          `TD-${run}-${suffix}`,
          `Emp${suffix}`,
          `emp-${suffix}-${run}@todos.test`,
          ids.dept,
          ids.desig,
        ],
      );
      return res.rows[0]?.id ?? '';
    };

    ids.emp1 = await addEmp('1');
    ids.emp2 = await addEmp('2');
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM personal_todos WHERE employee_id = ANY($1::uuid[])`, [
      [ids.emp1, ids.emp2],
    ]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.emp1, ids.emp2]]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
    await closePool();
  });

  it('performs full CRUD with pagination and filtering against PostgreSQL', async () => {
    // 1. Create multiple to-dos for emp1
    const created1 = await repo.create(ids.emp1, {
      title: 'First PostgreSQL Todo',
      description: 'Test description 1',
      dueDate: '2026-11-15',
    });
    expect(created1.id).toBeDefined();
    expect(created1.employeeId).toBe(ids.emp1);
    expect(created1.title).toBe('First PostgreSQL Todo');
    expect(created1.isCompleted).toBe(false);

    await repo.create(ids.emp1, {
      title: 'Second PostgreSQL Todo',
      dueDate: '2026-11-20',
    });

    await repo.create(ids.emp1, {
      title: 'Third PostgreSQL Todo',
    });

    // 2. Pagination on emp1 list
    const page1 = await repo.list(ids.emp1, { limit: 2, offset: 0 });
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.total).toBe(3);
    expect(page1.meta.limit).toBe(2);
    expect(page1.meta.offset).toBe(0);
    expect(page1.meta.hasMore).toBe(true);

    const page2 = await repo.list(ids.emp1, { limit: 2, offset: 2 });
    expect(page2.data).toHaveLength(1);
    expect(page2.meta.total).toBe(3);
    expect(page2.meta.offset).toBe(2);
    expect(page2.meta.hasMore).toBe(false);

    // 3. Isolation: emp2 sees zero to-dos
    const emp2List = await repo.list(ids.emp2, { limit: 10, offset: 0 });
    expect(emp2List.data).toHaveLength(0);
    expect(emp2List.meta.total).toBe(0);

    // 4. Get by ID
    const fetched = await repo.findById(created1.id, ids.emp1);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('First PostgreSQL Todo');

    // Cross-employee get returns null
    const crossFetch = await repo.findById(created1.id, ids.emp2);
    expect(crossFetch).toBeNull();

    // 5. Update
    const updated = await repo.update(created1.id, ids.emp1, {
      title: 'Updated Todo Title',
      isCompleted: true,
    });
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Updated Todo Title');
    expect(updated?.isCompleted).toBe(true);
    expect(updated?.completedAt).not.toBeNull();

    // 6. Toggle
    const toggled = await repo.toggle(created1.id, ids.emp1);
    expect(toggled).not.toBeNull();
    expect(toggled?.isCompleted).toBe(false);
    expect(toggled?.completedAt).toBeNull();

    // Toggle back to completed
    await repo.toggle(created1.id, ids.emp1);

    // 7. Filter completed = true vs completed = false
    const completedOnly = await repo.list(ids.emp1, { completed: true, limit: 10, offset: 0 });
    expect(completedOnly.data).toHaveLength(1);
    expect(completedOnly.data[0]?.id).toBe(created1.id);

    const pendingOnly = await repo.list(ids.emp1, { completed: false, limit: 10, offset: 0 });
    expect(pendingOnly.data).toHaveLength(2);

    // 8. Delete
    const deleted = await repo.delete(created1.id, ids.emp1);
    expect(deleted).toBe(true);
    const afterDelete = await repo.findById(created1.id, ids.emp1);
    expect(afterDelete).toBeNull();
  });

  it('rolls back transaction on error without persisting data', async () => {
    let failedTodoId: string | null = null;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const res = await client.query<{ id: string }>(
        `INSERT INTO personal_todos (employee_id, title) VALUES ($1, $2) RETURNING id`,
        [ids.emp1, 'Transaction rollback test'],
      );
      failedTodoId = res.rows[0]?.id ?? null;
      throw new Error('Forced transaction failure');
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      expect((err as Error).message).toBe('Forced transaction failure');
    } finally {
      client.release();
    }

    expect(failedTodoId).not.toBeNull();
    if (failedTodoId) {
      const check = await repo.findById(failedTodoId, ids.emp1);
      expect(check).toBeNull();
    }
  });

  it('automatically cascades deletion of personal_todos when employee is deleted', async () => {
    // 1. Create a temporary employee
    const tempEmp = await pool.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
       VALUES ($1, 'Cascade', 'Tester', $2, $3, $4) RETURNING id`,
      [`TD-CAS-${run}`, `cascade-${run}@todos.test`, ids.dept, ids.desig],
    );
    const cascadeEmpId = tempEmp.rows[0]?.id;
    expect(cascadeEmpId).toBeDefined();
    if (!cascadeEmpId) throw new Error('Failed to create cascade test employee');

    // 2. Create personal to-dos for this employee
    const todo = await repo.create(cascadeEmpId, {
      title: 'Should be cascade deleted',
      dueDate: '2026-11-30',
    });
    expect(todo.id).toBeDefined();

    // Verify row exists in DB
    const countBefore = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM personal_todos WHERE employee_id = $1`,
      [cascadeEmpId],
    );
    expect(parseInt(countBefore.rows[0]?.count ?? '0', 10)).toBe(1);

    // 3. Delete employee from employees table
    await pool.query(`DELETE FROM employees WHERE id = $1`, [cascadeEmpId]);

    // 4. Assert that personal_todos row was removed automatically via ON DELETE CASCADE
    const countAfter = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM personal_todos WHERE employee_id = $1`,
      [cascadeEmpId],
    );
    expect(parseInt(countAfter.rows[0]?.count ?? '0', 10)).toBe(0);
  });
});
