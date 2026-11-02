import { ROLES, type Role } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import {
  ReplaceRolesResult,
  RoleSummary,
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

  private async loadAccount(db: Pool | PoolClient, id: string): Promise<UserAccount | null> {
    const res = await db.query<UserRow>(`${SELECT_ACCOUNT} WHERE u.id = $1 ${GROUP_ACCOUNT}`, [id]);
    return res.rows[0] ? toAccount(res.rows[0]) : null;
  }
}
