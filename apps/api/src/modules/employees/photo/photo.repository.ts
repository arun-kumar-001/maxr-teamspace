import type { Pool } from 'pg';
import { ScopeFilter, scopeToSql } from '../../rbac';
import type { IEmployeePhotoRepository, StoredPhoto } from './photo.types';

export class PgEmployeePhotoRepository implements IEmployeePhotoRepository {
  constructor(private readonly getPool: () => Pool) {}

  async find(employeeId: string, scope: ScopeFilter): Promise<StoredPhoto | null> {
    const { clause, values } = scopeToSql(scope, 'e.id', 2);
    const res = await this.getPool().query<{ key: string | null; version: string | null }>(
      `SELECT e.profile_photo_key AS key,
              (EXTRACT(EPOCH FROM e.profile_photo_updated_at) * 1000)::bigint AS version
         FROM employees e
        WHERE e.id = $1 AND ${clause}`,
      [employeeId, ...values],
    );
    const row = res.rows[0];
    return row?.key && row.version !== null ? { key: row.key, version: Number(row.version) } : null;
  }

  async replace(employeeId: string, key: string) {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const old = await client.query<{ key: string | null }>(
        'SELECT profile_photo_key AS key FROM employees WHERE id = $1 FOR UPDATE',
        [employeeId],
      );
      const updated = await client.query<{ version: string }>(
        `UPDATE employees SET profile_photo_key = $2, profile_photo_updated_at = NOW()
          WHERE id = $1
          RETURNING (EXTRACT(EPOCH FROM profile_photo_updated_at) * 1000)::bigint AS version`,
        [employeeId, key],
      );
      await client.query('COMMIT');
      return {
        replacedKey: old.rows[0]?.key ?? null,
        version: Number(updated.rows[0]?.version),
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async clear(employeeId: string): Promise<string | null> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const old = await client.query<{ key: string | null }>(
        'SELECT profile_photo_key AS key FROM employees WHERE id = $1 FOR UPDATE',
        [employeeId],
      );
      await client.query(
        'UPDATE employees SET profile_photo_key = NULL, profile_photo_updated_at = NULL WHERE id = $1',
        [employeeId],
      );
      await client.query('COMMIT');
      return old.rows[0]?.key ?? null;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
