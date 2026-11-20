import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testHasher } from '../modules/auth/auth.testing';
import { closePool, getPool } from './client';
import { createFirstAdmin } from './create-admin';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('first admin bootstrap against PostgreSQL', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const PASSWORD = `Bootstrap-${run}-pass!`;
  const input = (patch: Record<string, unknown> = {}) => ({
    email: `first-admin-${run}@bootstrap.test`,
    password: PASSWORD,
    employeeCode: `BOOT-${run}`,
    ...patch,
  });

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT bootstrap_tx',
      COMMIT: 'RELEASE SAVEPOINT bootstrap_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT bootstrap_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const count = async (sql: string, values: unknown[] = []) =>
    Number((await outer.query<{ n: string }>(sql, values)).rows[0]?.n);
  const activeAdmins = () =>
    count(
      `SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id WHERE r.key = 'admin' AND u.is_active`,
    );

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
    // A development database already has seeded admins; a new installation has none.
    await outer.query(
      `UPDATE users SET is_active = false
        WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                      WHERE r.key = 'admin')`,
    );
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  it('creates an active admin who can sign in with the given password', async () => {
    expect(await activeAdmins()).toBe(0);
    const result = await createFirstAdmin(nested(outer), input(), testHasher);
    expect(result.status).toBe('created');
    expect(await activeAdmins()).toBe(1);

    const row = await outer.query<{ password_hash: string; status: string }>(
      `SELECT u.password_hash, e.status FROM users u JOIN employees e ON e.id = u.employee_id
        WHERE lower(u.email) = $1`,
      [`first-admin-${run}@bootstrap.test`],
    );
    expect(row.rows[0]?.status).toBe('active');
    expect(await testHasher.verify(row.rows[0]?.password_hash as string, PASSWORD)).toBe(true);
  });

  it('stores only the hash: the password appears nowhere in the account rows', async () => {
    await createFirstAdmin(nested(outer), input(), testHasher);
    const dump = await outer.query<{ text: string }>(
      `SELECT (u::text || ' ' || e::text) AS text FROM users u JOIN employees e ON e.id = u.employee_id
        WHERE lower(u.email) = $1`,
      [`first-admin-${run}@bootstrap.test`],
    );
    expect(dump.rows[0]?.text).not.toContain(PASSWORD);
  });

  it('records the creation in the audit log without the email or the password', async () => {
    const result = await createFirstAdmin(nested(outer), input(), testHasher);
    if (result.status !== 'created') throw new Error('expected a created admin');
    const audit = await outer.query<{ metadata: unknown; changes: unknown }>(
      `SELECT metadata, changes FROM audit_logs
        WHERE action = 'users.bootstrap_admin' AND entity_id = $1`,
      [result.userId],
    );
    expect(audit.rows).toHaveLength(1);
    const text = JSON.stringify(audit.rows[0]);
    expect(text).not.toContain(PASSWORD);
    expect(text).not.toContain('bootstrap.test');
  });

  it('does nothing when an active admin already exists, so running it twice is safe', async () => {
    await createFirstAdmin(nested(outer), input(), testHasher);
    const before = await count(`SELECT COUNT(*) AS n FROM users`);
    const again = await createFirstAdmin(
      nested(outer),
      input({ email: `second-${run}@bootstrap.test`, employeeCode: `BOOT2-${run}` }),
      testHasher,
    );
    expect(again).toEqual({ status: 'already_exists' });
    expect(await count(`SELECT COUNT(*) AS n FROM users`)).toBe(before);
  });

  it('refuses an email that another account already uses and leaves nothing behind', async () => {
    const taken = await outer.query<{ email: string }>(`SELECT email FROM employees LIMIT 1`);
    const before = await count(`SELECT COUNT(*) AS n FROM employees`);
    await expect(
      createFirstAdmin(nested(outer), input({ email: taken.rows[0]?.email }), testHasher),
    ).rejects.toThrow(/already used/);
    expect(await count(`SELECT COUNT(*) AS n FROM employees`)).toBe(before);
    expect(await activeAdmins()).toBe(0);
  });

  it.each([
    ['a password shorter than 12 characters', { password: 'short-pass1' }],
    ['an invalid email', { email: 'not-an-email' }],
  ])('rejects %s before touching the database', async (_name, patch) => {
    const before = await count(`SELECT COUNT(*) AS n FROM users`);
    await expect(createFirstAdmin(nested(outer), input(patch), testHasher)).rejects.toThrow();
    expect(await count(`SELECT COUNT(*) AS n FROM users`)).toBe(before);
  });

  it('the users table has no password column other than the hash', async () => {
    const res = await outer.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name ILIKE '%password%'`,
    );
    expect(res.rows.map((r) => r.column_name)).toEqual(['password_hash']);
  });
});
