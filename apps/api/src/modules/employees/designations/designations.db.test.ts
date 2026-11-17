import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgDepartmentRepository } from '../departments/department.repository';
import { PgDesignationRepository } from './designation.repository';

describe('PgDesignationRepository (PostgreSQL Integration)', () => {
  const pool = getPool();
  const deptRepo = new PgDepartmentRepository(getPool);
  const desigRepo = new PgDesignationRepository(getPool);
  let deptId: string;
  const createdDesigIds: string[] = [];

  beforeAll(async () => {
    const res = await pool.query('SELECT 1 as connected');
    expect(res.rows[0]).toEqual({ connected: 1 });

    const dept = await deptRepo.create({
      name: 'Desig Integration Dept',
      code: `DID_${randomUUID().slice(0, 8)}`,
    });
    deptId = dept.id;
  });

  afterAll(async () => {
    if (createdDesigIds.length > 0) {
      await pool.query('DELETE FROM employees WHERE designation_id = ANY($1)', [createdDesigIds]);
      await pool.query('DELETE FROM designations WHERE id = ANY($1)', [createdDesigIds]);
    }
    if (deptId) {
      await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
    }
    await closePool();
  });

  it('removes the hierarchy level column from the migrated schema', async () => {
    const result = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'designations' AND column_name = $1",
      ['level'],
    );
    expect(result.rows).toEqual([]);
  });

  it('creates and finds a designation by id and code', async () => {
    const code = `DSG_${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await desigRepo.create({
      departmentId: deptId,
      title: 'Principal Engineer',
      code,
    });
    createdDesigIds.push(created.id);

    expect(created.id).toBeDefined();
    expect(created.departmentId).toBe(deptId);
    expect(created.title).toBe('Principal Engineer');
    expect(created.code).toBe(code);
    expect(created).not.toHaveProperty('level');
    expect(created.isActive).toBe(true);

    const byId = await desigRepo.findById(created.id);
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe(created.id);

    const byCodeCaseInsensitive = await desigRepo.findByCode(code.toLowerCase());
    expect(byCodeCaseInsensitive).not.toBeNull();
    expect(byCodeCaseInsensitive?.id).toBe(created.id);
  });

  it('enforces case-insensitive unique code constraint', async () => {
    const code = `DSG_${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await desigRepo.create({
      departmentId: deptId,
      title: 'First Title',
      code,
    });
    createdDesigIds.push(created.id);

    await expect(
      desigRepo.create({
        departmentId: deptId,
        title: 'Duplicate Code Title',
        code: code.toLowerCase(),
      }),
    ).rejects.toThrow();
  });

  it('enforces foreign key constraint on department_id', async () => {
    const fakeDeptId = randomUUID();
    await expect(
      desigRepo.create({
        departmentId: fakeDeptId,
        title: 'Orphan Desig',
        code: `ORPH_${randomUUID().slice(0, 6)}`,
      }),
    ).rejects.toThrow();
  });

  it('filters by departmentId and searches designations', async () => {
    const prefix = `SRCH_${randomUUID().slice(0, 6)}`;
    const d1 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} Specialist`,
      code: `${prefix}_1`,
    });
    const d2 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} Generalist`,
      code: `${prefix}_2`,
    });
    createdDesigIds.push(d1.id, d2.id);

    const res = await desigRepo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'title', order: 'asc' },
      departmentId: deptId,
      search: prefix,
    });

    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.id).sort()).toEqual([d1.id, d2.id].sort());
  });

  it('soft-deletes a designation and checks in-use employee protection', async () => {
    const desig = await desigRepo.create({
      departmentId: deptId,
      title: 'To Be Soft Deleted',
      code: `DEL_${randomUUID().slice(0, 8)}`,
    });
    createdDesigIds.push(desig.id);

    expect(await desigRepo.hasActiveEmployees(desig.id)).toBe(false);

    // Assign active employee
    const empCode = `EMP_${randomUUID().slice(0, 8)}`;
    const empEmail = `${empCode.toLowerCase()}@test.com`;
    const empRes = await pool.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, 'Jane', 'Smith', $2, $3, $4, 'active')
       RETURNING id`,
      [empCode, empEmail, deptId, desig.id],
    );
    const empId = empRes.rows[0]!.id;

    expect(await desigRepo.hasActiveEmployees(desig.id)).toBe(true);

    // Deactivate employee
    await pool.query("UPDATE employees SET status = 'deactivated' WHERE id = $1", [empId]);
    expect(await desigRepo.hasActiveEmployees(desig.id)).toBe(false);

    // Now soft delete designation
    const ok = await desigRepo.softDelete(desig.id);
    expect(ok).toBe(true);

    const fetched = await desigRepo.findById(desig.id);
    expect(fetched?.isActive).toBe(false);
  });

  it('checks if referenced department is active', async () => {
    expect(await desigRepo.isDepartmentActive(deptId)).toBe(true);
    expect(await desigRepo.isDepartmentActive(randomUUID())).toBe(false);
  });

  it('guarantees deterministic pagination across pages when sorting by duplicate titles', async () => {
    const prefix = `STABLE_DSG_${randomUUID().slice(0, 6)}`;
    const d1 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} Common Title`,
      code: `${prefix}_1`,
    });
    const d2 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} Common Title`,
      code: `${prefix}_2`,
    });
    const d3 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} Common Title`,
      code: `${prefix}_3`,
    });
    createdDesigIds.push(d1.id, d2.id, d3.id);

    const page1 = await desigRepo.findMany({
      offset: 0,
      limit: 2,
      sort: { column: 'title', order: 'asc' },
      search: prefix,
    });
    const page2 = await desigRepo.findMany({
      offset: 2,
      limit: 2,
      sort: { column: 'title', order: 'asc' },
      search: prefix,
    });

    expect(page1.total).toBe(3);
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(1);

    const page1Ids = page1.items.map((i) => i.id);
    const page2Ids = page2.items.map((i) => i.id);

    expect(page1Ids.includes(page2Ids[0]!)).toBe(false);
    expect([...page1Ids, ...page2Ids].sort()).toEqual([d1.id, d2.id, d3.id].sort());
  });

  it('escapes % and _ wildcards in search queries', async () => {
    const prefix = `ESC_DSG_${randomUUID().slice(0, 6)}`;
    const d1 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} 50% Effort`,
      code: `${prefix}_PCT`,
    });
    const d2 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix} 500 Effort`,
      code: `${prefix}_NUM`,
    });
    const d3 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix}_UnderscoreTitle`,
      code: `${prefix}_US`,
    });
    const d4 = await desigRepo.create({
      departmentId: deptId,
      title: `${prefix}XUnderscoreTitle`,
      code: `${prefix}_XUS`,
    });
    createdDesigIds.push(d1.id, d2.id, d3.id, d4.id);

    const pctRes = await desigRepo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'title', order: 'asc' },
      search: `${prefix} 50%`,
    });
    expect(pctRes.total).toBe(1);
    expect(pctRes.items[0]?.id).toBe(d1.id);

    const usRes = await desigRepo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'title', order: 'asc' },
      search: `${prefix}_Underscore`,
    });
    expect(usRes.total).toBe(1);
    expect(usRes.items[0]?.id).toBe(d3.id);
  });
});
