import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { config } from '../config/env';
import { createArgon2Hasher, type PasswordHasher } from '../modules/auth/password-hasher';
import { closePool, getPool } from './client';

/** Held for the length of the transaction so two runs at once cannot both create an admin. */
const BOOTSTRAP_LOCK_KEY = 7_421_903_551;

const DEFAULT_DEPARTMENT = { code: 'ADMIN', name: 'Administration' } as const;
const DEFAULT_DESIGNATION = 'System Administrator';
const DEFAULT_EMPLOYEE_CODE = 'ADMIN-001';

export const bootstrapAdminSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .max(128, 'Password must be at most 128 characters'),
    firstName: z.string().trim().min(1).max(100).default('System'),
    lastName: z.string().trim().min(1).max(100).default('Administrator'),
    employeeCode: z.string().trim().min(1).max(50).default(DEFAULT_EMPLOYEE_CODE),
  })
  .strict();

export type BootstrapAdminInput = z.input<typeof bootstrapAdminSchema>;

export type BootstrapAdminResult =
  { status: 'created'; userId: string; email: string } | { status: 'already_exists' };

type Db = Pick<PoolClient, 'query'>;

async function findOrCreateDepartment(db: Db): Promise<string> {
  const found = await db.query<{ id: string }>(
    `SELECT id FROM departments WHERE lower(code) = lower($1) LIMIT 1`,
    [DEFAULT_DEPARTMENT.code],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await db.query<{ id: string }>(
    `INSERT INTO departments (name, code, is_active) VALUES ($1, $2, true) RETURNING id`,
    [DEFAULT_DEPARTMENT.name, DEFAULT_DEPARTMENT.code],
  );
  return (created.rows[0] as { id: string }).id;
}

async function findOrCreateDesignation(db: Db, departmentId: string): Promise<string> {
  const found = await db.query<{ id: string }>(
    `SELECT id FROM designations WHERE department_id = $1 AND title = $2 LIMIT 1`,
    [departmentId, DEFAULT_DESIGNATION],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await db.query<{ id: string }>(
    `INSERT INTO designations (department_id, title, is_active) VALUES ($1, $2, true) RETURNING id`,
    [departmentId, DEFAULT_DESIGNATION],
  );
  return (created.rows[0] as { id: string }).id;
}

/**
 * Creates the first Admin of a new installation. The development seed refuses to run in
 * production, and no migration creates a user, so a fresh production database has nobody who can
 * sign in until this runs. It does nothing when an active Admin already exists.
 *
 * The password is read by the caller from the environment and is never logged or stored; only its
 * Argon2id hash is written.
 */
export async function createFirstAdmin(
  pool: Pick<Pool, 'connect'>,
  rawInput: BootstrapAdminInput,
  hasher: PasswordHasher,
): Promise<BootstrapAdminResult> {
  const input = bootstrapAdminSchema.parse(rawInput);
  const passwordHash = await hasher.hash(input.password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK_KEY]);

    const existing = await client.query(
      `SELECT 1
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
        WHERE r.key = 'admin' AND u.is_active
        LIMIT 1`,
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      return { status: 'already_exists' };
    }

    const taken = await client.query<{ what: string }>(
      `SELECT 'email' AS what FROM users WHERE lower(email) = $1
       UNION ALL SELECT 'email' FROM employees WHERE lower(email) = $1
       UNION ALL SELECT 'employee code' FROM employees WHERE lower(employee_code) = lower($2)`,
      [input.email, input.employeeCode],
    );
    if (taken.rows[0]) {
      throw new Error(
        `The ${taken.rows[0].what} is already used by another account. Choose a different one.`,
      );
    }

    const departmentId = await findOrCreateDepartment(client);
    const designationId = await findOrCreateDesignation(client, departmentId);

    const employee = await client.query<{ id: string }>(
      `INSERT INTO employees
         (employee_code, first_name, last_name, email, department_id, designation_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id`,
      [
        input.employeeCode,
        input.firstName,
        input.lastName,
        input.email,
        departmentId,
        designationId,
      ],
    );
    const employeeId = (employee.rows[0] as { id: string }).id;

    const user = await client.query<{ id: string }>(
      `INSERT INTO users (employee_id, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [employeeId, input.email, passwordHash],
    );
    const userId = (user.rows[0] as { id: string }).id;

    const role = await client.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = 'admin'`,
      [userId],
    );
    if (role.rowCount !== 1) {
      throw new Error('The admin role is missing. Run the database migrations first.');
    }

    await client.query(
      `INSERT INTO audit_logs (action, outcome, actor_role, entity_type, entity_id, request_id, metadata)
       VALUES ('users.bootstrap_admin', 'success', 'system', 'user', $1, $2, $3)`,
      [userId, randomUUID(), JSON.stringify({ source: 'create-admin command' })],
    );

    await client.query('COMMIT');
    return { status: 'created', userId, email: input.email };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** One readable line. Validation messages name the field, never the value that was given. */
function describeError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ');
  }
  return err instanceof Error ? err.message : String(err);
}

/** `npm run db:create-admin`, with ADMIN_EMAIL and ADMIN_PASSWORD in the environment. */
async function main(): Promise<void> {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_EMPLOYEE_CODE } =
    process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) and run again.');
  }
  // A password argument on the command line would end up in shell history and process lists.
  if (config.NODE_ENV === 'production' && process.argv.length > 2) {
    throw new Error('This command takes no arguments. Pass values through the environment.');
  }

  const result = await createFirstAdmin(
    getPool(),
    {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      ...(ADMIN_FIRST_NAME ? { firstName: ADMIN_FIRST_NAME } : {}),
      ...(ADMIN_LAST_NAME ? { lastName: ADMIN_LAST_NAME } : {}),
      ...(ADMIN_EMPLOYEE_CODE ? { employeeCode: ADMIN_EMPLOYEE_CODE } : {}),
    },
    createArgon2Hasher(),
  );

  // eslint-disable-next-line no-console
  console.info(
    result.status === 'created'
      ? `[CreateAdmin] Created the first admin: ${result.email}. Sign in and change the password.`
      : '[CreateAdmin] An active admin already exists. Nothing was changed.',
  );
}

if (require.main === module) {
  main()
    .then(() => closePool())
    .catch(async (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[CreateAdmin Failed]', describeError(err));
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
