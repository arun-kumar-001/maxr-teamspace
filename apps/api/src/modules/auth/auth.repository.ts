import type { Pool } from 'pg';
import { AuthRepository, AuthUser, FailureWindow } from './auth.types';

interface UserRow {
  id: string;
  employee_id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  employee_status: string;
  first_name: string;
  last_name: string;
  roles: string[] | null;
}

const USER_SELECT = `
  SELECT u.id, u.employee_id, u.email, u.password_hash, u.is_active,
         e.status AS employee_status, e.first_name, e.last_name,
         COALESCE(array_agg(r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
    FROM users u
    JOIN employees e ON e.id = u.employee_id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id`;

const toUser = (row: UserRow): AuthUser => ({
  id: row.id,
  employeeId: row.employee_id,
  email: row.email,
  passwordHash: row.password_hash,
  isActive: row.is_active,
  employeeStatus: row.employee_status,
  firstName: row.first_name,
  lastName: row.last_name,
  roles: row.roles ?? [],
});

/** `getPool` is lazy so building the app opens no connection. */
export class PgAuthRepository implements AuthRepository {
  constructor(private readonly getPool: () => Pool) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const res = await this.getPool().query<UserRow>(
      `${USER_SELECT} WHERE LOWER(u.email) = LOWER($1) GROUP BY u.id, e.id`,
      [email],
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const res = await this.getPool().query<UserRow>(
      `${USER_SELECT} WHERE u.id = $1 GROUP BY u.id, e.id`,
      [id],
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  }

  async getPermissionKeys(roleKeys: string[]): Promise<string[]> {
    if (roleKeys.length === 0) return [];
    const res = await this.getPool().query<{ key: string }>(
      `SELECT DISTINCT p.key
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN roles r ON r.id = rp.role_id
        WHERE r.key = ANY($1::text[])
        ORDER BY p.key`,
      [roleKeys],
    );
    return res.rows.map((row) => row.key);
  }

  async recordLoginAttempt(attempt: {
    identifier: string;
    ip: string;
    success: boolean;
  }): Promise<void> {
    await this.getPool().query(
      'INSERT INTO login_attempts (ip_address, identifier, success) VALUES ($1, $2, $3)',
      [attempt.ip.slice(0, 45), attempt.identifier.slice(0, 255), attempt.success],
    );
  }

  async recentFailures(identifier: string, since: Date): Promise<FailureWindow> {
    const res = await this.getPool().query<{ count: number; oldest: Date | null }>(
      `SELECT count(*)::int AS count, min(attempted_at) AS oldest
         FROM login_attempts
        WHERE identifier = $1
          AND success = false
          AND attempted_at > GREATEST(
                $2::timestamptz,
                COALESCE((SELECT max(attempted_at) FROM login_attempts WHERE identifier = $1 AND success = true), 'epoch'::timestamptz))`,
      [identifier, since],
    );
    const row = res.rows[0];
    return { count: row?.count ?? 0, oldestAt: row?.oldest ?? null };
  }

  async touchLastLogin(userId: string, at: Date): Promise<void> {
    await this.getPool().query(
      'UPDATE users SET last_login_at = $2, updated_at = NOW() WHERE id = $1',
      [userId, at],
    );
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.getPool().query(
      'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1',
      [userId, passwordHash],
    );
  }
}
