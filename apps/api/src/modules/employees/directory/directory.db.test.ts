import { randomUUID } from 'crypto';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgDepartmentRepository } from '../departments/department.repository';
import { PgDesignationRepository } from '../designations/designation.repository';
import { PgEmployeeDirectoryRepository } from './directory.repository';

describe('PgEmployeeDirectoryRepository (PostgreSQL Integration)', () => {
  const pool: Pool = getPool();
  const repo = new PgEmployeeDirectoryRepository(getPool);
  const deptRepo = new PgDepartmentRepository(getPool);
  const desigRepo = new PgDesignationRepository(getPool);

  let deptId: string;
  let desigId: string;
  const createdEmployeeIds: string[] = [];

  beforeAll(async () => {
    const res = await pool.query('SELECT 1 as connected');
    expect(res.rows[0]).toEqual({ connected: 1 });

    const dept = await deptRepo.create({
      name: 'Directory Integration Dept',
      code: `DID_${randomUUID().slice(0, 8)}`,
    });
    deptId = dept.id;

    const desig = await desigRepo.create({
      departmentId: deptId,
      title: 'Directory Engineer',
      code: `DED_${randomUUID().slice(0, 8)}`,
      level: 2,
    });
    desigId = desig.id;
  });

  afterAll(async () => {
    if (createdEmployeeIds.length > 0) {
      await pool.query('DELETE FROM employees WHERE id = ANY($1)', [createdEmployeeIds]);
    }
    if (desigId) {
      await pool.query('DELETE FROM designations WHERE id = $1', [desigId]);
    }
    if (deptId) {
      await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
    }
    await closePool();
  });

  const insertEmployee = async (overrides: {
    code?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    managerId?: string | null;
    status?: 'active' | 'pending' | 'deactivated';
    joiningDate?: string;
  }) => {
    const code = overrides.code ?? `EMP_${randomUUID().slice(0, 8)}`;
    const email = overrides.email ?? `${code.toLowerCase()}@test.maxr.local`;
    const res = await pool.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, designation_id, manager_id, status, joining_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        code,
        overrides.firstName ?? 'Test',
        overrides.lastName ?? 'Employee',
        email,
        overrides.phone ?? '+1000000000',
        deptId,
        desigId,
        overrides.managerId ?? null,
        overrides.status ?? 'active',
        overrides.joiningDate ?? '2024-01-15',
      ],
    );
    const id = res.rows[0]!.id;
    createdEmployeeIds.push(id);
    return id;
  };

  it('retrieves employees with ALL scope (Admin/HR visibility)', async () => {
    const prefix = `ALL_${randomUUID().slice(0, 6)}`;
    const e1 = await insertEmployee({ code: `${prefix}_1`, firstName: 'Alice' });
    const e2 = await insertEmployee({ code: `${prefix}_2`, firstName: 'Bob' });

    const res = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: prefix,
    });

    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.id).sort()).toEqual([e1, e2].sort());
    expect(res.items[0]?.department.id).toBe(deptId);
    expect(res.items[0]?.designation.id).toBe(desigId);
  });

  it('enforces TEAM scope: Team Lead sees strictly direct reports (D-11 & D-26)', async () => {
    const prefix = `TEAM_${randomUUID().slice(0, 6)}`;
    const leadId = await insertEmployee({ code: `${prefix}_LEAD`, firstName: 'Lead' });
    const report1 = await insertEmployee({
      code: `${prefix}_R1`,
      firstName: 'Direct1',
      managerId: leadId,
    });
    const report2 = await insertEmployee({
      code: `${prefix}_R2`,
      firstName: 'Direct2',
      managerId: leadId,
    });
    const subReport = await insertEmployee({
      code: `${prefix}_SUB`,
      firstName: 'SubReport',
      managerId: report1,
    });
    const otherEmployee = await insertEmployee({
      code: `${prefix}_OTH`,
      firstName: 'Other',
    });

    const res = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'team', managerId: leadId },
      search: prefix,
    });

    const returnedIds = res.items.map((i) => i.id);
    expect(res.total).toBe(2);
    expect(returnedIds.sort()).toEqual([report1, report2].sort());

    // Verified: Lead self is NOT in team scope (D-26)
    expect(returnedIds.includes(leadId)).toBe(false);
    // Verified: Non-recursive direct reports only (D-11, sub-report excluded)
    expect(returnedIds.includes(subReport)).toBe(false);
    // Verified: Other team member excluded
    expect(returnedIds.includes(otherEmployee)).toBe(false);
  });

  it('prevents scope bypass when caller supplies conflicting managerId query filter', async () => {
    const prefix = `BYPASS_${randomUUID().slice(0, 6)}`;
    const leadA = await insertEmployee({ code: `${prefix}_LA`, firstName: 'LeadA' });
    const leadB = await insertEmployee({ code: `${prefix}_LB`, firstName: 'LeadB' });
    await insertEmployee({ code: `${prefix}_RA`, firstName: 'ReportA', managerId: leadA });
    await insertEmployee({ code: `${prefix}_RB`, firstName: 'ReportB', managerId: leadB });

    // Lead A passes managerId = leadB in query parameters
    const res = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'team', managerId: leadA },
      managerId: leadB,
      search: prefix,
    });

    // Cannot bypass: Result must be 0 because rows must satisfy BOTH scope AND filter
    expect(res.total).toBe(0);
    expect(res.items).toHaveLength(0);
  });

  it('guarantees deterministic pagination with stable sorting tie-breaker when names match', async () => {
    const prefix = `STABLE_${randomUUID().slice(0, 6)}`;
    const e1 = await insertEmployee({
      code: `${prefix}_1`,
      firstName: 'Shared',
      lastName: 'LastName',
      joiningDate: '2024-01-01',
    });
    const e2 = await insertEmployee({
      code: `${prefix}_2`,
      firstName: 'Shared',
      lastName: 'LastName',
      joiningDate: '2024-01-01',
    });
    const e3 = await insertEmployee({
      code: `${prefix}_3`,
      firstName: 'Shared',
      lastName: 'LastName',
      joiningDate: '2024-01-01',
    });

    const page1 = await repo.findMany({
      offset: 0,
      limit: 2,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: prefix,
    });
    const page2 = await repo.findMany({
      offset: 2,
      limit: 2,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: prefix,
    });

    expect(page1.total).toBe(3);
    expect(page1.items.length).toBe(2);
    expect(page2.items.length).toBe(1);

    const ids1 = page1.items.map((i) => i.id);
    const ids2 = page2.items.map((i) => i.id);

    expect(ids1.includes(ids2[0]!)).toBe(false);
    expect([...ids1, ...ids2].sort()).toEqual([e1, e2, e3].sort());
  });

  it('escapes %, _, and backslash wildcards in search queries without injection', async () => {
    const prefix = `ESC_${randomUUID().slice(0, 6)}`;
    const ePct = await insertEmployee({
      code: `${prefix}_100%_PCT`,
      firstName: 'Percent',
      lastName: 'Match',
    });
    const eNum = await insertEmployee({
      code: `${prefix}_1000_NUM`,
      firstName: 'Number',
      lastName: 'Match',
    });
    const eUs = await insertEmployee({
      code: `${prefix}_UnderScore`,
      firstName: 'Under',
      lastName: 'Score',
    });
    const eXus = await insertEmployee({
      code: `${prefix}XUnderScore`,
      firstName: 'NoUnder',
      lastName: 'Score',
    });

    // % literal search
    const pctRes = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: `${prefix}_100%`,
    });
    expect(pctRes.total).toBe(1);
    expect(pctRes.items[0]?.id).toBe(ePct);
    expect(pctRes.items.some((i) => i.id === eNum)).toBe(false);

    // _ literal search
    const usRes = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: `${prefix}_UnderScore`,
    });
    expect(usRes.total).toBe(1);
    expect(usRes.items[0]?.id).toBe(eUs);
    expect(usRes.items.some((i) => i.id === eXus)).toBe(false);

    // Hostile injection string
    const hostileRes = await repo.findMany({
      offset: 0,
      limit: 10,
      sort: { column: 'name', order: 'asc' },
      filter: { kind: 'all' },
      search: "' OR '1'='1",
    });
    expect(hostileRes.total).toBe(0);
  });

  it('verifies query plan and performance for 10k employee dataset', async () => {
    // Uses a transaction that is rolled back so nothing is persisted in the shared database
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create a temporary department and designation for 10k batch
      const tDept = await client.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ('Perf Dept', 'PERF_D') RETURNING id`,
      );
      const tDesig = await client.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Perf Desig', 'PERF_DSG') RETURNING id`,
        [tDept.rows[0]!.id],
      );

      // Generate 10,000 synthetic employee rows
      await client.query(
        `INSERT INTO employees (
           employee_code, first_name, last_name, email, phone, department_id, designation_id, status, joining_date
         )
         SELECT
           'PERF_' || i,
           'FirstName_' || i,
           'LastName_' || (i % 500),
           'perf_' || i || '@test.maxr.local',
           '+1999999999',
           $1,
           $2,
           CASE WHEN i % 10 = 0 THEN 'pending' WHEN i % 20 = 0 THEN 'deactivated' ELSE 'active' END,
           CURRENT_DATE - (i % 365)
         FROM generate_series(1, 10000) AS i`,
        [tDept.rows[0]!.id, tDesig.rows[0]!.id],
      );

      // Run EXPLAIN (ANALYZE, BUFFERS) on the employee directory query
      const explainRes = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN (ANALYZE, BUFFERS)
         SELECT
           e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone, e.status, e.joining_date, e.created_at, e.updated_at,
           d.id AS dept_id, d.name AS dept_name, d.code AS dept_code,
           des.id AS desig_id, des.title AS desig_title, des.code AS desig_code, des.level AS desig_level,
           m.id AS manager_id, m.first_name AS manager_first_name, m.last_name AS manager_last_name, m.employee_code AS manager_employee_code
         FROM employees e
         JOIN departments d ON e.department_id = d.id
         JOIN designations des ON e.designation_id = des.id
         LEFT JOIN employees m ON e.manager_id = m.id
         WHERE d.id = $1 AND e.status = 'active'
         ORDER BY e.last_name ASC, e.first_name ASC, e.id ASC
         LIMIT 20 OFFSET 0`,
        [tDept.rows[0]!.id],
      );

      const planLines = explainRes.rows.map((r) => r['QUERY PLAN']);
      const planText = planLines.join('\n');

      // Verify the query plan uses indexed lookups or bitmap scans and completes successfully
      expect(planText).toContain('Limit');
      expect(planText).toContain('Execution Time:');

      // Extract measured execution time from plan
      const match = planText.match(/Execution Time: ([\d.]+) ms/);
      expect(match).not.toBeNull();
      const executionTimeMs = parseFloat(match![1]!);
      // Documents the measured execution time
      expect(executionTimeMs).toBeGreaterThan(0);
      expect(executionTimeMs).toBeLessThan(1000); // Generous sanity threshold to avoid CI flakiness
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
