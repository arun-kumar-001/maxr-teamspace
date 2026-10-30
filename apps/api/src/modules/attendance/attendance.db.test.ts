import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { ScopeFilter, scopeToSql } from '../rbac/scope';

describe('attendance module database & index verification (Issue #34)', () => {
  let client: PoolClient;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');

    // Create test department and designation
    const dept = await client.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ('Attendance Test Dept', 'ATT-DEPT') RETURNING id`,
    );
    const desig = await client.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Attendance Tester', 'ATT-DESIG') RETURNING id`,
      [dept.rows[0]?.id],
    );

    // Create test employees: lead -> (anna, ben); carl has no manager
    const addEmployee = async (name: string, managerId?: string) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'Test', $3, $4, $5, $6) RETURNING id`,
        [
          `ATT-${name}`,
          name,
          `${name}@attendance.test`,
          dept.rows[0]?.id,
          desig.rows[0]?.id,
          managerId ?? null,
        ],
      );
      ids[name] = res.rows[0]?.id ?? '';
    };

    await addEmployee('lead');
    await addEmployee('anna', ids.lead);
    await addEmployee('ben', ids.lead);
    await addEmployee('carl');
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    await closePool();
  });

  it('guarantees at most one open attendance session per employee via partial unique index', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const empId = ids.anna;

    // 1. Initial check-in (open session) succeeds
    const firstSession = await client.query<{ id: string }>(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, status)
       VALUES ($1, $2, NOW(), NULL, 'PRESENT') RETURNING id`,
      [empId, today],
    );
    expect(firstSession.rows[0]?.id).toBeDefined();

    // 2. Concurrent check-in while previous session is open must violate unique index
    await expect(
      client.query(
        `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, status)
         VALUES ($1, $2, NOW(), NULL, 'PRESENT') RETURNING id`,
        [empId, today],
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'idx_attendance_single_open_session',
    });

    // 3. Close the active session
    await client.query(
      `UPDATE attendance_records SET check_out_time = NOW(), duration_minutes = 240 WHERE id = $1`,
      [firstSession.rows[0]?.id],
    );

    // 4. Second check-in now succeeds (since check_out_time is no longer NULL)
    const secondSession = await client.query<{ id: string }>(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, status)
       VALUES ($1, $2, NOW(), NULL, 'PRESENT') RETURNING id`,
      [empId, today],
    );
    expect(secondSession.rows[0]?.id).toBeDefined();
    expect(secondSession.rows[0]?.id).not.toBe(firstSession.rows[0]?.id);
  });

  it('enforces RBAC scope SQL correctly across roles', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Seed attendance for ben and carl
    await client.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, status)
       VALUES ($1, $2, NOW(), NOW() + interval '1 hour', 'PRESENT')`,
      [ids.ben, today],
    );
    await client.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, status)
       VALUES ($1, $2, NOW(), NOW() + interval '1 hour', 'PRESENT')`,
      [ids.carl, today],
    );

    const queryWithScope = async (filter: ScopeFilter): Promise<string[]> => {
      const { clause, values } = scopeToSql(filter, 'a.employee_id', 1);
      const res = await client.query<{ employee_code: string }>(
        `SELECT e.employee_code 
         FROM attendance_records a
         JOIN employees e ON a.employee_id = e.id
         WHERE e.employee_code LIKE 'ATT-%' AND ${clause}
         ORDER BY e.employee_code`,
        values,
      );
      return res.rows.map((r) => r.employee_code);
    };

    // 1. Admin / HR ('all') sees all records
    const allRecords = await queryWithScope({ kind: 'all' });
    expect(allRecords).toContain('ATT-anna');
    expect(allRecords).toContain('ATT-ben');
    expect(allRecords).toContain('ATT-carl');

    // 2. Team Lead ('team') sees direct reports (anna and ben), NOT carl or self
    const teamRecords = await queryWithScope({ kind: 'team', managerId: ids.lead ?? '' });
    expect(teamRecords).toEqual(expect.arrayContaining(['ATT-anna', 'ATT-ben']));
    expect(teamRecords).not.toContain('ATT-carl');
    expect(teamRecords).not.toContain('ATT-lead');

    // 3. Staff ('own') sees only own records
    const ownRecords = await queryWithScope({ kind: 'own', employeeId: ids.ben ?? '' });
    expect(ownRecords).toEqual(['ATT-ben']);

    // 4. Denied scope ('none') sees nothing
    const noRecords = await queryWithScope({ kind: 'none' });
    expect(noRecords).toEqual([]);
  });
});
