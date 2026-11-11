import { randomBytes } from 'node:crypto';
import { ROLES, type Role } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import {
  CreateUserInput,
  CreateUserResult,
  ReplaceRolesResult,
  RoleSummary,
  UpdateUserStatusResult,
  UserAccount,
  UserFindManyParams,
  UserSortField,
} from './users.types';

export interface IUsersRepository {
  findMany(params: UserFindManyParams): Promise<{ items: UserAccount[]; total: number }>;
  findById(id: string): Promise<UserAccount | null>;
  listRoles(): Promise<RoleSummary[]>;
  /**
   * Sets the complete role set in one transaction. Refuses (`last_admin`) a change that would
   * leave no active Admin, and serialises concurrent changes so two Admins cannot demote each
   * other at the same moment.
   */
  replaceRoles(userId: string, roles: readonly Role[]): Promise<ReplaceRolesResult>;
  /** Provisions a user account + linked employee record in one atomic transaction. */
  createUser(input: CreateUserInput): Promise<CreateUserResult>;
  /** Activates or deactivates a user account while enforcing self and last-admin safeguards. */
  setStatus(
    userId: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<UpdateUserStatusResult>;
}

interface UserRow {
  id: string;
  employee_id: string;
  employee_code: string;
  name: string;
  email: string;
  is_active: boolean;
  roles: string[];
  last_login_at: Date | string | null;
  created_at: Date | string;
}

const toAccount = (row: UserRow): UserAccount => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeCode: row.employee_code,
  name: row.name,
  email: row.email,
  isActive: row.is_active,
  roles: row.roles as Role[],
  lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});

const SELECT_ACCOUNT = `
  SELECT u.id, u.employee_id, e.employee_code,
         TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS name,
         u.email, u.is_active, u.last_login_at, u.created_at,
         COALESCE(array_agg(r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id`;

const GROUP_ACCOUNT = 'GROUP BY u.id, e.id';

/** API field -> SQL expression. A fixed list, so a client never chooses an identifier. */
const SORT_COLUMNS: Record<UserSortField, string> = {
  name: `LOWER(TRIM(CONCAT(e.last_name, ' ', e.first_name)))`,
  email: 'LOWER(u.email)',
  createdAt: 'u.created_at',
  lastLoginAt: 'u.last_login_at',
};

/** `%` and `_` are LIKE wildcards; a search for them must match them literally. */
const escapeLike = (value: string): string => value.replace(/([\\%_])/g, '\\$1');

export class PgUsersRepository implements IUsersRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findMany(params: UserFindManyParams) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      conditions.push(sql.replace('?', `$${values.length}`));
    };

    if (params.search) {
      const pattern = `%${escapeLike(params.search)}%`;
      values.push(pattern);
      const n = `$${values.length}`;
      conditions.push(
        `(CONCAT(e.first_name, ' ', e.last_name) ILIKE ${n} ESCAPE '\\'
          OR u.email ILIKE ${n} ESCAPE '\\' OR e.employee_code ILIKE ${n} ESCAPE '\\')`,
      );
    }
    if (params.isActive !== undefined) add('u.is_active = ?', params.isActive);
    if (params.role) {
      add(
        `EXISTS (SELECT 1 FROM user_roles fur JOIN roles fr ON fr.id = fur.role_id
                  WHERE fur.user_id = u.id AND fr.key = ?)`,
        params.role,
      );
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const direction = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const count = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM users u JOIN employees e ON e.id = u.employee_id ${where}`,
      values,
    );
    const paging = [...values, params.limit, params.offset];
    // u.id last: accounts that tie on the sort column keep one order across pages.
    const res = await this.getPool().query<UserRow>(
      `${SELECT_ACCOUNT}
       ${where}
       ${GROUP_ACCOUNT}
       ORDER BY ${SORT_COLUMNS[params.sortBy]} ${direction} NULLS LAST, u.id ${direction}
       LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
      paging,
    );
    return { items: res.rows.map(toAccount), total: count.rows[0]?.count ?? 0 };
  }

  async findById(id: string): Promise<UserAccount | null> {
    return this.loadAccount(this.getPool(), id);
  }

  async listRoles(): Promise<RoleSummary[]> {
    const res = await this.getPool().query<{
      id: string;
      key: Role;
      name: string;
      description: string | null;
      active_users: number;
    }>(
      `SELECT r.id, r.key, r.name, r.description,
              COUNT(u.id) FILTER (WHERE u.is_active)::int AS active_users
         FROM roles r
         LEFT JOIN user_roles ur ON ur.role_id = r.id
         LEFT JOIN users u ON u.id = ur.user_id
        GROUP BY r.id
        ORDER BY r.key`,
    );
    return res.rows.map((row) => ({
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      activeUsers: row.active_users,
    }));
  }

  async replaceRoles(userId: string, roles: readonly Role[]): Promise<ReplaceRolesResult> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      // One lock for every role change: the last-admin check below reads other rows, so
      // without it two concurrent demotions could each see the other admin still in place.
      await client.query(`SELECT id FROM roles WHERE key = $1 FOR UPDATE`, [ROLES.ADMIN]);
      const current = await this.loadAccount(client, userId);
      if (!current) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      const before = [...current.roles].sort();
      const after = [...roles].sort();
      if (before.join() === after.join()) {
        await client.query('ROLLBACK');
        return { status: 'unchanged', user: current };
      }
      if (current.isActive && before.includes(ROLES.ADMIN) && !after.includes(ROLES.ADMIN)) {
        const others = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id AND r.key = $1
             JOIN users u ON u.id = ur.user_id
            WHERE u.is_active AND u.id <> $2`,
          [ROLES.ADMIN, userId],
        );
        if ((others.rows[0]?.count ?? 0) === 0) {
          await client.query('ROLLBACK');
          return { status: 'last_admin' };
        }
      }
      await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE key = ANY($2::text[])`,
        [userId, after],
      );
      await client.query(`UPDATE users SET updated_at = NOW() WHERE id = $1`, [userId]);
      const updated = await this.loadAccount(client, userId);
      await client.query('COMMIT');
      return { status: 'changed', user: updated as UserAccount, before: before as Role[] };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const email = input.email.trim().toLowerCase();
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE LOWER(email) = $1
         UNION ALL
         SELECT id FROM employees WHERE LOWER(email) = $1
         LIMIT 1`,
        [email],
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return { status: 'duplicate_email' };
      }

      let departmentId = input.departmentId;
      if (departmentId) {
        const deptCheck = await client.query<{ id: string }>(
          `SELECT id FROM departments WHERE id = $1 AND is_active = true`,
          [departmentId],
        );
        if (deptCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return { status: 'missing_reference', message: 'Selected department was not found' };
        }
      } else {
        const defaultDept = await client.query<{ id: string }>(
          `SELECT id FROM departments WHERE is_active = true ORDER BY created_at ASC LIMIT 1`,
        );
        departmentId = defaultDept.rows[0]?.id;
      }

      let designationId = input.designationId;
      if (designationId) {
        const desigCheck = await client.query<{ id: string }>(
          `SELECT id FROM designations WHERE id = $1 AND is_active = true`,
          [designationId],
        );
        if (desigCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return { status: 'missing_reference', message: 'Selected designation was not found' };
        }
      } else {
        const defaultDesig = await client.query<{ id: string }>(
          `SELECT id FROM designations
            WHERE is_active = true
            ORDER BY (department_id = $1) DESC, created_at ASC
            LIMIT 1`,
          [departmentId ?? null],
        );
        designationId = defaultDesig.rows[0]?.id;
      }

      if (!departmentId || !designationId) {
        await client.query('ROLLBACK');
        return {
          status: 'missing_reference',
          message: 'An active department and designation are required before creating users',
        };
      }

      const employeeCode = `USR-${randomBytes(3).toString('hex').toUpperCase()}`;
      const isActive = input.isActive ?? true;
      const employeeStatus = isActive ? 'active' : 'deactivated';
      const empRes = await client.query<{ id: string }>(
        `INSERT INTO employees (
           employee_code, first_name, last_name, email, department_id, designation_id, status, joining_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
         RETURNING id`,
        [
          employeeCode,
          input.firstName,
          input.lastName,
          email,
          departmentId,
          designationId,
          employeeStatus,
        ],
      );
      const employeeId = empRes.rows[0]?.id as string;

      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [employeeId, email, input.passwordHash, isActive],
      );
      const userId = userRes.rows[0]?.id as string;

      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT $1, id FROM roles WHERE key = ANY($2::text[])`,
        [userId, [...input.roles]],
      );

      const created = await this.loadAccount(client, userId);
      await client.query('COMMIT');
      return { status: 'created', user: created as UserAccount };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
        return { status: 'duplicate_email' };
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async setStatus(
    userId: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<UpdateUserStatusResult> {
    if (!isActive && userId === actorUserId) {
      return { status: 'self_deactivate' };
    }

    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT id FROM roles WHERE key = $1 FOR UPDATE`, [ROLES.ADMIN]);
      const current = await this.loadAccount(client, userId);
      if (!current) {
        await client.query('ROLLBACK');
        return { status: 'not_found' };
      }
      if (current.isActive === isActive) {
        await client.query('ROLLBACK');
        return { status: 'unchanged', user: current };
      }
      if (!isActive && current.roles.includes(ROLES.ADMIN)) {
        const others = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id AND r.key = $1
             JOIN users u ON u.id = ur.user_id
            WHERE u.is_active AND u.id <> $2`,
          [ROLES.ADMIN, userId],
        );
        if ((others.rows[0]?.count ?? 0) === 0) {
          await client.query('ROLLBACK');
          return { status: 'last_admin' };
        }
      }

      await client.query(`UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1`, [
        userId,
        isActive,
      ]);
      await client.query(
        `UPDATE employees
            SET status = CASE WHEN $2 THEN 'active' ELSE 'deactivated' END,
                deactivated_at = CASE WHEN $2 THEN NULL ELSE COALESCE(deactivated_at, NOW()) END,
                updated_at = NOW()
          WHERE id = $1`,
        [current.employeeId, isActive],
      );

      const updated = await this.loadAccount(client, userId);
      await client.query('COMMIT');
      return { status: 'changed', user: updated as UserAccount, before: current.isActive };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  private async loadAccount(db: Pool | PoolClient, id: string): Promise<UserAccount | null> {
    const res = await db.query<UserRow>(`${SELECT_ACCOUNT} WHERE u.id = $1 ${GROUP_ACCOUNT}`, [id]);
    return res.rows[0] ? toAccount(res.rows[0]) : null;
  }
}
