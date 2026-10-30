import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import {
  DeactivationRecord,
  DeactivationTarget,
  DeactivationTx,
  DirectReport,
  EmployeeStatus,
} from './deactivation.types';

export interface IDeactivationRepository {
  transaction<T>(work: (tx: DeactivationTx) => Promise<T>): Promise<T>;
  /**
   * The one lock every change to the Admin role holds (the role assignment in #27 takes it too),
   * so two Admins deactivating each other at the same moment cannot both pass the last-Admin check.
   */
  lockAdminRole(tx: DeactivationTx): Promise<void>;
  lockTarget(tx: DeactivationTx, employeeId: string): Promise<DeactivationTarget | null>;
  countOtherActiveAdmins(tx: DeactivationTx, excludeUserId: string): Promise<number>;
  /** Marks the employee deactivated and the account inactive; returns the new version and time. */
  deactivate(tx: DeactivationTx, target: DeactivationTarget): Promise<DeactivationRecord>;
  /** Their current record, for an employee that was already deactivated. */
  readRecord(tx: DeactivationTx, employeeId: string): Promise<DeactivationRecord>;
  listDirectReports(tx: DeactivationTx, employeeId: string): Promise<DirectReport[]>;
}

export class PgDeactivationRepository implements IDeactivationRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: DeactivationTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async lockAdminRole(tx: DeactivationTx): Promise<void> {
    await tx.query(`SELECT id FROM roles WHERE key = $1 FOR UPDATE`, [ROLES.ADMIN]);
  }

  async lockTarget(tx: DeactivationTx, employeeId: string): Promise<DeactivationTarget | null> {
    const employee = await tx.query<{ id: string; status: EmployeeStatus }>(
      `SELECT id, status FROM employees WHERE id = $1 FOR UPDATE`,
      [employeeId],
    );
    const row = employee.rows[0];
    if (!row) return null;
    const user = await tx.query<{ id: string; is_active: boolean; is_admin: boolean }>(
      `SELECT u.id, u.is_active,
              EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                       WHERE ur.user_id = u.id AND r.key = $2) AS is_admin
         FROM users u WHERE u.employee_id = $1 FOR UPDATE OF u`,
      [employeeId, ROLES.ADMIN],
    );
    const account = user.rows[0];
    return {
      employeeId: row.id,
      status: row.status,
      userId: account?.id ?? null,
      userActive: account?.is_active ?? false,
      holdsAdminRole: account?.is_admin ?? false,
    };
  }

  async countOtherActiveAdmins(tx: DeactivationTx, excludeUserId: string): Promise<number> {
    const res = await tx.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.key = $1
         JOIN users u ON u.id = ur.user_id
         JOIN employees e ON e.id = u.employee_id
        WHERE u.is_active AND e.status = 'active' AND u.id <> $2`,
      [ROLES.ADMIN, excludeUserId],
    );
    return res.rows[0]?.count ?? 0;
  }

  async deactivate(tx: DeactivationTx, target: DeactivationTarget): Promise<DeactivationRecord> {
    // The trigger on employees records the time and bumps the version.
    const res = await tx.query<{ deactivated_at: Date | string; version: number }>(
      `UPDATE employees SET status = 'deactivated' WHERE id = $1 RETURNING deactivated_at, version`,
      [target.employeeId],
    );
    if (target.userId) {
      await tx.query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`, [
        target.userId,
      ]);
    }
    const row = res.rows[0] as { deactivated_at: Date | string; version: number };
    return { deactivatedAt: new Date(row.deactivated_at).toISOString(), version: row.version };
  }

  async readRecord(tx: DeactivationTx, employeeId: string): Promise<DeactivationRecord> {
    const res = await tx.query<{ deactivated_at: Date | string; version: number }>(
      `SELECT deactivated_at, version FROM employees WHERE id = $1`,
      [employeeId],
    );
    const row = res.rows[0] as { deactivated_at: Date | string; version: number };
    return { deactivatedAt: new Date(row.deactivated_at).toISOString(), version: row.version };
  }

  async listDirectReports(tx: DeactivationTx, employeeId: string): Promise<DirectReport[]> {
    const res = await tx.query<{ id: string; employee_code: string; name: string }>(
      `SELECT id, employee_code, TRIM(CONCAT(first_name, ' ', last_name)) AS name
         FROM employees
        WHERE manager_id = $1 AND status <> 'deactivated'
        ORDER BY last_name, first_name, id`,
      [employeeId],
    );
    return res.rows.map((r) => ({ id: r.id, employeeCode: r.employee_code, name: r.name }));
  }
}
