import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgDepartmentRepository } from './department.repository';

describe('PgDepartmentRepository (PostgreSQL Integration)', () => {
  const pool = getPool();
  const repo = new PgDepartmentRepository(getPool);
  const createdIds: string[] = [];

  beforeAll(async () => {
    const res = await pool.query('SELECT 1 as connected');
    expect(res.rows[0]).toEqual({ connected: 1 });
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await pool.query('DELETE FROM employees WHERE department_id = ANY($1)', [createdIds]);
      await pool.query('DELETE FROM designations WHERE department_id = ANY($1)', [createdIds]);
      await pool.query('DELETE FROM departments WHERE id = ANY($1)', [createdIds]);
    }
    await closePool();
  });

  it('creates and finds a department by id and code', async () => {
    const code = `D_${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await repo.create({ name: 'Database Dept', code });
    createdIds.push(created.id);

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Database Dept');
    expect(created.code).toBe(code);
    expect(created.isActive).toBe(true);

    const byId = await repo.findById(created.id);
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(created.id);

    const byCodeCaseInsensitive = await repo.findByCode(code.toLowerCase());
    expect(byCodeCaseInsensitive).not.toBeNull();
    expect(byCodeCaseInsensitive?.id).toBe(created.id);
  });

  it('enforces case-insensitive unique code constraint in PostgreSQL', async () => {
    const code = `D_${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await repo.create({ name: 'First Dept', code });
    createdIds.push(created.id);

    await expect(
      repo.create({ name: 'Duplicate Dept', code: code.toLowerCase() }),
    ).rejects.toThrow();
  });

  it('paginates and searches departments', async () => {
    const prefix = `SEARCH_${randomUUID().slice(0, 6)}`;
    const d1 = await repo.create({ name: `${prefix} Alpha`, code: `${prefix}_A` });
    const d2 = await repo.create({ name: `${prefix} Beta`, code: `${prefix}_B` });
    createdIds.push(d1.id, d2.id);

    const res = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      search: prefix,
    });

    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.id).sort()).toEqual([d1.id, d2.id].sort());
  });

  it('soft-deletes a department', async () => {
    const code = `D_${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await repo.create({ name: 'To Soft Delete', code });
    createdIds.push(created.id);

    const ok = await repo.softDelete(created.id);
    expect(ok).toBe(true);

    const fetched = await repo.findById(created.id);
    expect(fetched?.isActive).toBe(false);
  });

  it('detects active designations and employees for in-use protection', async () => {
    const code = `D_${randomUUID().slice(0, 8).toUpperCase()}`;
    const dept = await repo.create({ name: 'In-Use Test Dept', code });
    createdIds.push(dept.id);

    // No designations or employees yet
    expect(await repo.hasActiveDesignations(dept.id)).toBe(false);
    expect(await repo.hasActiveEmployees(dept.id)).toBe(false);

    // Insert designation
    const desigRes = await pool.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code, level, is_active)
       VALUES ($1, 'Test Desig', $2, 1, true)
       RETURNING id`,
      [dept.id, `DSG_${randomUUID().slice(0, 8)}`],
    );
    const desigId = desigRes.rows[0]!.id;

    expect(await repo.hasActiveDesignations(dept.id)).toBe(true);

    // Deactivate designation
    await pool.query('UPDATE designations SET is_active = false WHERE id = $1', [desigId]);
    expect(await repo.hasActiveDesignations(dept.id)).toBe(false);

    // Insert active employee
    const empCode = `EMP_${randomUUID().slice(0, 8)}`;
    const empEmail = `${empCode.toLowerCase()}@test.com`;
    const empRes = await pool.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, 'John', 'Doe', $2, $3, $4, 'active')
       RETURNING id`,
      [empCode, empEmail, dept.id, desigId],
    );
    const empId = empRes.rows[0]!.id;

    expect(await repo.hasActiveEmployees(dept.id)).toBe(true);

    // Deactivate employee
    await pool.query("UPDATE employees SET status = 'deactivated' WHERE id = $1", [empId]);
    expect(await repo.hasActiveEmployees(dept.id)).toBe(false);
  });
});
