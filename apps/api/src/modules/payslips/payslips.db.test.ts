import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgPayslipsRepository } from './payslips.repository';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('payslips against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgPayslipsRepository;
  let employeeId: string;
  const run = randomUUID().slice(0, 8);

  const asPool = (client: PoolClient): Pool =>
    ({ query: client.query.bind(client) }) as unknown as Pool;

  const basicInDb = async (id: string) =>
    Number(
      (
        await outer.query<{ basic_current_paise: string }>(
          'SELECT basic_current_paise FROM payslips WHERE id = $1',
          [id],
        )
      ).rows[0]?.basic_current_paise,
    );

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgPayslipsRepository(() => asPool(outer));
    const dept = await outer.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Pay ${run}`, `PAY-${run}`],
    );
    const desig = await outer.query<{ id: string }>(
      `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
      [dept.rows[0]?.id],
    );
    const emp = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, 'Pay', 'Test', $2, $3, $4, 'active') RETURNING id`,
      [`PAY-${run}`, `pay-${run}@payslip.test`, dept.rows[0]?.id, desig.rows[0]?.id],
    );
    employeeId = emp.rows[0]?.id as string;
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

  const draft = () =>
    repo.create({
      employeeId,
      payMonth: 7,
      payYear: 2026,
      status: 'draft',
      designation: 'Engineer',
      basicSalary: 40000,
    });

  it('changes a draft', async () => {
    const created = await draft();
    const updated = await repo.update(created.id, { basicSalary: 41000 });
    expect(updated?.basicSalary).toBe(41000);
    expect(await basicInDb(created.id)).toBe(4_100_000);
  });

  it('does not change a published payslip, and says so by returning nothing', async () => {
    const created = await draft();
    await repo.publish(created.id);

    expect(await repo.update(created.id, { basicSalary: 99000 })).toBeNull();
    expect(await basicInDb(created.id)).toBe(4_000_000);
  });

  it('still reports a payslip that does not exist as missing', async () => {
    expect(await repo.update(randomUUID(), { basicSalary: 1 })).toBeNull();
  });
});
