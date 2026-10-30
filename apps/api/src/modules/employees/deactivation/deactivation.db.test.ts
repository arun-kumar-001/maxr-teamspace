import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { PgDeactivationRepository } from './deactivation.repository';
import { EmployeeDeactivationService } from './deactivation.service';

const silent = createLogger({ level: 'silent', write: () => undefined });
const revoked: string[] = [];
const sessions = {
  async revokeAllForUser(userId: string) {
    revoked.push(userId);
    return 2;
  },
};
const caller = () => ({ actorId: randomUUID(), employeeId: randomUUID(), requestId: 'req' });

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The
 * repository's own transaction becomes a savepoint, so a refused deactivation can still be shown to
 * leave nothing behind.
 */
describe('employee deactivation against PostgreSQL', () => {
  let outer: PoolClient;
  let service: EmployeeDeactivationService;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT deact_tx',
      COMMIT: 'RELEASE SAVEPOINT deact_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT deact_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const person = async (
    name: string,
    options: { manager?: string; roles?: string[]; status?: string } = {},
  ) => {
    const emp = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                              designation_id, manager_id, status)
       VALUES ($1, $2, 'Deact', $3, $4, $5, $6, $7) RETURNING id`,
      [
        `DA-${run}-${name}`,
        name,
        `${name}-${run}@deact.test`,
        ids.dept,
        ids.desig,
        options.manager ?? null,
        options.status ?? 'active',
      ],
    );
    ids[name] = emp.rows[0]?.id ?? '';
    const user = await outer.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', $3) RETURNING id`,
      [ids[name], `${name}-${run}@deact.test`, (options.status ?? 'active') === 'active'],
    );
    ids[`${name}User`] = user.rows[0]?.id ?? '';
    await outer.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = ANY($2::text[])`,
      [ids[`${name}User`], options.roles ?? [ROLES.STAFF]],
    );
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const { platform } = createTestPlatform({ logger: silent });
    service = new EmployeeDeactivationService(
      new PgDeactivationRepository(() => nested(outer)),
      platform,
      sessions,
      silent,
    );
    ids.dept =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
          [`Deact ${run}`, `DA-${run}`],
        )
      ).rows[0]?.id ?? '';
    ids.desig =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Leaver', $2) RETURNING id`,
          [ids.dept, `DA-${run}`],
        )
      ).rows[0]?.id ?? '';
    await person('boss', { roles: [ROLES.TEAM_LEAD] });
    await person('amy', { manager: ids.boss });
    await person('ben', { manager: ids.boss, status: 'deactivated' });
    await person('pat', { status: 'pending' });
  });

  beforeEach(async () => {
    revoked.length = 0;
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
  });

  const employee = async (id: string) =>
    (
      await outer.query<{
        status: string;
        deactivated_at: Date | null;
        version: number;
        user_active: boolean;
      }>(
        `SELECT e.status, e.deactivated_at, e.version, u.is_active AS user_active
           FROM employees e JOIN users u ON u.employee_id = e.id WHERE e.id = $1`,
        [id],
      )
    ).rows[0];

  it('switches off the employee and the account, records when, and lists the people left without a manager', async () => {
    const before = await employee(ids.boss as string);
    const result = await service.deactivate(ids.boss as string, caller());
    expect(result).toMatchObject({
      status: 'deactivated',
      alreadyDeactivated: false,
      sessionsRevoked: 2,
      version: (before?.version ?? 0) + 1,
    });
    // Ben is already deactivated and does not need a manager.
    expect(result.directReports).toEqual([
      { id: ids.amy, employeeCode: `DA-${run}-amy`, name: 'amy Deact' },
    ]);
    expect(await employee(ids.boss as string)).toMatchObject({
      status: 'deactivated',
      user_active: false,
    });
    expect((await employee(ids.boss as string))?.deactivated_at).not.toBeNull();
    expect(revoked).toEqual([ids.bossUser]);
  });

  it('keeps the history: the employee, the account and the roles are still there', async () => {
    await service.deactivate(ids.amy as string, caller());
    const roles = await outer.query(`SELECT 1 FROM user_roles WHERE user_id = $1`, [ids.amyUser]);
    expect(roles.rowCount).toBe(1);
    expect(await employee(ids.amy as string)).toMatchObject({ status: 'deactivated' });
  });

  it('a repeat changes nothing in the database', async () => {
    await service.deactivate(ids.amy as string, caller());
    const first = await employee(ids.amy as string);
    const again = await service.deactivate(ids.amy as string, caller());
    expect(again.alreadyDeactivated).toBe(true);
    expect(await employee(ids.amy as string)).toMatchObject({
      version: first?.version,
      deactivated_at: first?.deactivated_at,
    });
  });

  it('deactivates an employee who was never activated', async () => {
    const result = await service.deactivate(ids.pat as string, caller());
    expect(result.alreadyDeactivated).toBe(false);
    expect(await employee(ids.pat as string)).toMatchObject({ status: 'deactivated' });
  });

  it('answers 404 for an unknown employee', async () => {
    await expect(service.deactivate(randomUUID(), caller())).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('refuses to deactivate the last active Admin, and leaves the rows alone', async () => {
    // Inside this rolled-back transaction every other Admin account is out of the picture.
    await outer.query(
      `UPDATE users SET is_active = false
        WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.key = $1)`,
      [ROLES.ADMIN],
    );
    await person('root', { roles: [ROLES.ADMIN] });
    await expect(service.deactivate(ids.root as string, caller())).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(await employee(ids.root as string)).toMatchObject({
      status: 'active',
      user_active: true,
    });
    expect(revoked).toHaveLength(0);

    await person('root2', { roles: [ROLES.ADMIN] });
    expect((await service.deactivate(ids.root as string, caller())).alreadyDeactivated).toBe(false);
  });

  it('does not count a pending or deactivated Admin as another Admin', async () => {
    await outer.query(
      `UPDATE users SET is_active = false
        WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.key = $1)`,
      [ROLES.ADMIN],
    );
    await person('root', { roles: [ROLES.ADMIN] });
    await person('idle', { roles: [ROLES.ADMIN], status: 'pending' });
    await person('gone', { roles: [ROLES.ADMIN], status: 'deactivated' });
    await expect(service.deactivate(ids.root as string, caller())).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

/**
 * Two Admins deactivating each other at the same moment need real commits and the real Admin-role
 * lock, which a rolled-back transaction cannot show. Fixtures are committed, the seeded Admin
 * accounts are switched off for the duration and switched back on in `finally`.
 */
describe('employee deactivation: two Admins at once', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', a: '', b: '', aUser: '', bUser: '' };
  let seededAdmins: string[] = [];

  /** Pauses between the last-Admin check and the write, so both requests are mid-transaction. */
  class SlowRepository extends PgDeactivationRepository {
    override async countOtherActiveAdmins(
      ...args: Parameters<PgDeactivationRepository['countOtherActiveAdmins']>
    ) {
      const count = await super.countOtherActiveAdmins(...args);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return count;
    }
  }

  beforeAll(async () => {
    const seeded = await pool.query<{ id: string }>(
      `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.key = $1
        WHERE u.is_active`,
      [ROLES.ADMIN],
    );
    seededAdmins = seeded.rows.map((r) => r.id);
    ids.dept = (
      await pool.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Race ${run}`, `RC-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await pool.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Racer', $2) RETURNING id`,
        [ids.dept, `RC-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['a', 'b'] as const) {
      const emp = await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, $2, 'Race', $3, $4, $5) RETURNING id`,
        [`RC-${run}-${name}`, name, `${name}-${run}@race.test`, ids.dept, ids.desig],
      );
      ids[name] = emp.rows[0]?.id as string;
      const user = await pool.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash) VALUES ($1, $2, 'x') RETURNING id`,
        [ids[name], `${name}-${run}@race.test`],
      );
      ids[`${name}User` as 'aUser' | 'bUser'] = user.rows[0]?.id as string;
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
        [ids[`${name}User` as 'aUser' | 'bUser'], ROLES.ADMIN],
      );
    }
  });

  afterAll(async () => {
    // The accounts first: users.employee_id restricts deleting an employee that has one.
    await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [[ids.aUser, ids.bUser]]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.a, ids.b]]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
  });

  it('exactly one of two Admins deactivating each other succeeds; the other is refused as the last Admin', async () => {
    const { platform } = createTestPlatform({ logger: silent });
    const service = new EmployeeDeactivationService(
      new SlowRepository(getPool),
      platform,
      sessions,
      silent,
    );
    try {
      await pool.query(`UPDATE users SET is_active = false WHERE id = ANY($1::uuid[])`, [
        seededAdmins,
      ]);
      const settled = await Promise.allSettled([
        service.deactivate(ids.a, { actorId: randomUUID(), employeeId: ids.b }),
        service.deactivate(ids.b, { actorId: randomUUID(), employeeId: ids.a }),
      ]);
      const winners = settled.filter((s) => s.status === 'fulfilled');
      const losers = settled.filter((s) => s.status === 'rejected');
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect((losers[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 422 });
      const stillActive = await pool.query(
        `SELECT 1 FROM users WHERE id = ANY($1::uuid[]) AND is_active`,
        [[ids.aUser, ids.bUser]],
      );
      expect(stillActive.rowCount).toBe(1);
    } finally {
      await pool.query(`UPDATE users SET is_active = true WHERE id = ANY($1::uuid[])`, [
        seededAdmins,
      ]);
    }
  });
});

// Both groups share the pool; close it once, after the last test has run.
afterAll(async () => {
  await closePool();
});
