import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgApprovalsRepository } from './approvals.repository';
import type { ApprovalTx } from './approvals.types';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('who else could decide, against PostgreSQL', () => {
  let outer: PoolClient;
  const repo = new PgApprovalsRepository(getPool);
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '' };
  const tx = () => outer as unknown as ApprovalTx;

  const person = async (
    n: number,
    roleKey: string,
    opts: { active?: boolean; status?: string } = {},
  ) => {
    const emp = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, 'P', $2, $3, $4, $5, $6) RETURNING id`,
      [
        `SA-${run}-${n}`,
        `N${n}`,
        `sa-${run}-${n}@sole.test`,
        ids.dept,
        ids.desig,
        opts.status ?? 'active',
      ],
    );
    const employeeId = emp.rows[0]?.id as string;
    const user = await outer.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', $3) RETURNING id`,
      [employeeId, `sa-${run}-${n}@sole.test`, opts.active ?? true],
    );
    await outer.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
      [user.rows[0]?.id, roleKey],
    );
    return employeeId;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const dept = await outer.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Sole ${run}`, `SOLE-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';
    ids.desig =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
          [ids.dept],
        )
      ).rows[0]?.id ?? '';
    // Existing seeded Admins and HR Managers would hide the cases below, so take them out of play.
    await outer.query(
      `UPDATE users SET is_active = false WHERE employee_id NOT IN (SELECT id FROM employees WHERE employee_code LIKE 'SA-${run}-%')`,
    );
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

  it('is false when the only person holding the role is the one asking', async () => {
    const me = await person(1, 'admin');
    expect(await repo.existsOtherActiveWithRole(['admin'], me, tx())).toBe(false);
  });

  it('is true when a second active person holds the role', async () => {
    const me = await person(1, 'admin');
    await person(2, 'admin');
    expect(await repo.existsOtherActiveWithRole(['admin'], me, tx())).toBe(true);
  });

  it('does not count someone whose account is switched off or whose employment is not active (still pending)', async () => {
    const me = await person(1, 'admin');
    await person(2, 'admin', { active: false });
    await person(3, 'admin', { status: 'pending' });
    expect(await repo.existsOtherActiveWithRole(['admin'], me, tx())).toBe(false);
  });

  it('does not count people holding only other roles, and accepts any of several roles', async () => {
    const me = await person(1, 'hr_manager');
    await person(2, 'staff');
    expect(await repo.existsOtherActiveWithRole(['hr_manager'], me, tx())).toBe(false);
    await person(3, 'admin');
    expect(await repo.existsOtherActiveWithRole(['hr_manager'], me, tx())).toBe(false);
    expect(await repo.existsOtherActiveWithRole(['hr_manager', 'admin'], me, tx())).toBe(true);
  });
});
