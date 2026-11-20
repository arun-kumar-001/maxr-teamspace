import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgEmployeeCreationRepository } from '../employees/creation/creation.repository';
import { PgAuthRepository } from './auth.repository';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('must_change_password against PostgreSQL', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '' };
  const asPool = (): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT mcp_tx',
      COMMIT: 'RELEASE SAVEPOINT mcp_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT mcp_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => outer.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: outer.query.bind(outer), connect: async () => inner } as unknown as Pool;
  };
  const flag = async (userId: string) =>
    (
      await outer.query<{ f: boolean }>(
        'SELECT must_change_password AS f FROM users WHERE id = $1',
        [userId],
      )
    ).rows[0]?.f;

  const employeeWithUser = async (n: number) => {
    const emp = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, 'M', 'C', $2, $3, $4, 'active') RETURNING id`,
      [`MC-${run}-${n}`, `mc-${run}-${n}@pw.test`, ids.dept, ids.desig],
    );
    const user = await outer.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', true) RETURNING id`,
      [emp.rows[0]?.id, `mc-${run}-${n}@pw.test`],
    );
    return user.rows[0]!.id;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`MCP ${run}`, `MCP-${run}`],
      )
    ).rows[0]!.id;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
        [ids.dept],
      )
    ).rows[0]!.id;
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

  it('is off for an existing account, readable by the sign-in code, and cleared by a password change', async () => {
    const userId = await employeeWithUser(1);
    const repo = new PgAuthRepository(() => outer as unknown as Pool);
    expect((await repo.findUserById(userId))?.mustChangePassword).toBe(false);

    await outer.query('UPDATE users SET must_change_password = true WHERE id = $1', [userId]);
    expect((await repo.findUserById(userId))?.mustChangePassword).toBe(true);

    await repo.updatePasswordHash(userId, 'new-hash');
    expect(await flag(userId)).toBe(false);
  });

  it('is switched on for the account created with a new employee', async () => {
    const repo = new PgEmployeeCreationRepository(asPool);
    const created = await repo.transaction((tx) =>
      repo.insertAccount(
        tx,
        {
          employeeCode: `MCN-${run}`,
          firstName: 'New',
          lastName: 'Hire',
          email: `new-${run}@pw.test`,
          departmentId: ids.dept,
          designationId: ids.desig,
          joiningDate: '2026-11-02',
          role: ROLES.STAFF,
        },
        'hash',
      ),
    );
    const user = await outer.query<{ id: string }>('SELECT id FROM users WHERE employee_id = $1', [
      created.id,
    ]);
    expect(await flag(user.rows[0]!.id)).toBe(true);
  });
});
