import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool, closePool } from '../../db/client';
import { isDatabaseAvailableSync } from '../../test/helpers';
import { SqlAuditStore } from './sql-audit-store';
import { AuditEntry } from './types';

const hasDatabase = isDatabaseAvailableSync();

describe.skipIf(!hasDatabase)('SqlAuditStore (Integration against PostgreSQL)', () => {
  const pool = getPool();
  const store = new SqlAuditStore(pool);

  beforeAll(async () => {
    // Ensure test database connection is healthy
    const res = await pool.query('SELECT 1 as connected');
    expect(res.rows[0]).toEqual({ connected: 1 });
  });

  afterAll(async () => {
    await closePool();
  });

  it('appends an audit entry and retrieves it from PostgreSQL', async () => {
    const entryId = randomUUID();
    const entry: AuditEntry = {
      id: entryId,
      occurredAt: new Date().toISOString(),
      action: 'employee.create',
      outcome: 'success',
      entityType: 'employee',
      entityId: '50000000-0000-0000-0000-000000000001',
      actorId: '60000000-0000-0000-0000-000000000001',
      actorRole: 'admin',
      requestId: 'req-test-audit-001',
      changes: { status: { from: 'pending', to: 'active' } },
      metadata: { ip: '127.0.0.1' },
    };

    await store.append(entry);

    const retrieved = await store.findById(entryId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(entryId);
    expect(retrieved?.action).toBe('employee.create');
    expect(retrieved?.outcome).toBe('success');
    expect(retrieved?.entityType).toBe('employee');
    expect(retrieved?.actorRole).toBe('admin');
    expect(retrieved?.changes).toEqual({ status: { from: 'pending', to: 'active' } });
    expect(retrieved?.metadata).toEqual({ ip: '127.0.0.1' });
  });

  it('participates in caller transaction and rolls back when transaction rolls back', async () => {
    const client = await pool.connect();
    const entryId = randomUUID();

    try {
      await client.query('BEGIN');

      const entry: AuditEntry = {
        id: entryId,
        occurredAt: new Date().toISOString(),
        action: 'employee.deactivate',
        outcome: 'success',
        entityType: 'employee',
        entityId: '50000000-0000-0000-0000-000000000004',
      };

      await store.append(entry, { transaction: client });

      // Inside transaction, it is visible
      const inTxRes = await client.query('SELECT id FROM audit_logs WHERE id = $1', [entryId]);
      expect(inTxRes.rows).toHaveLength(1);

      // Rollback transaction
      await client.query('ROLLBACK');

      // After rollback, entry must NOT exist in database
      const afterRollback = await store.findById(entryId);
      expect(afterRollback).toBeNull();
    } finally {
      client.release();
    }
  });

  it('participates in caller transaction and commits when transaction commits', async () => {
    const client = await pool.connect();
    const entryId = randomUUID();

    try {
      await client.query('BEGIN');

      const entry: AuditEntry = {
        id: entryId,
        occurredAt: new Date().toISOString(),
        action: 'auth.login_failed',
        outcome: 'denied',
        entityType: 'auth',
        requestId: 'req-commit-tx',
      };

      await store.append(entry, { transaction: client });
      await client.query('COMMIT');

      const afterCommit = await store.findById(entryId);
      expect(afterCommit).not.toBeNull();
      expect(afterCommit?.id).toBe(entryId);
      expect(afterCommit?.outcome).toBe('denied');
    } finally {
      client.release();
    }
  });

  describe('Append-Only Immutability Enforcement (shared-services.md §4.1)', () => {
    it('strictly prohibits UPDATE operations on audit_logs at the database level', async () => {
      const entryId = randomUUID();
      await store.append({
        id: entryId,
        occurredAt: new Date().toISOString(),
        action: 'test.immutable',
        outcome: 'success',
        entityType: 'test',
      });

      await expect(
        pool.query("UPDATE audit_logs SET action = 'tampered' WHERE id = $1", [entryId]),
      ).rejects.toThrow(
        /audit_logs is append-only: UPDATE, DELETE, and TRUNCATE operations are strictly prohibited/i,
      );
    });

    it('strictly prohibits DELETE operations on audit_logs at the database level', async () => {
      const entryId = randomUUID();
      await store.append({
        id: entryId,
        occurredAt: new Date().toISOString(),
        action: 'test.immutable',
        outcome: 'success',
        entityType: 'test',
      });

      await expect(pool.query('DELETE FROM audit_logs WHERE id = $1', [entryId])).rejects.toThrow(
        /audit_logs is append-only: UPDATE, DELETE, and TRUNCATE operations are strictly prohibited/i,
      );
    });

    it('strictly prohibits TRUNCATE operations on audit_logs at the database level', async () => {
      await expect(pool.query('TRUNCATE audit_logs')).rejects.toThrow(
        /audit_logs is append-only: UPDATE, DELETE, and TRUNCATE operations are strictly prohibited/i,
      );
    });
  });

  describe('Least-Privilege Application Role (maxr_app) Enforcement', () => {
    let appPool: Pool;

    beforeAll(async () => {
      // Ensure maxr_app has development password set for test execution
      await pool.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'maxr_app') THEN
            ALTER ROLE maxr_app WITH PASSWORD 'maxr_app_dev_password';
          END IF;
        END
        $$;
      `);

      appPool = new Pool({
        connectionString:
          'postgresql://maxr_app:maxr_app_dev_password@localhost:5432/maxr_teamspace',
      });
    });

    afterAll(async () => {
      await appPool.end();
    });

    it('confirms maxr_app has only SELECT and INSERT privileges on audit_logs', async () => {
      const res = await appPool.query(`
        SELECT
          has_table_privilege('maxr_app', 'audit_logs', 'SELECT') as can_select,
          has_table_privilege('maxr_app', 'audit_logs', 'INSERT') as can_insert,
          has_table_privilege('maxr_app', 'audit_logs', 'UPDATE') as can_update,
          has_table_privilege('maxr_app', 'audit_logs', 'DELETE') as can_delete,
          has_table_privilege('maxr_app', 'audit_logs', 'TRUNCATE') as can_truncate;
      `);
      expect(res.rows[0]).toEqual({
        can_select: true,
        can_insert: true,
        can_update: false,
        can_delete: false,
        can_truncate: false,
      });
    });

    it('allows maxr_app to insert and read audit records', async () => {
      const entryId = randomUUID();
      const appStore = new SqlAuditStore(appPool);

      await expect(
        appStore.append({
          id: entryId,
          occurredAt: new Date().toISOString(),
          action: 'app_role.verified',
          outcome: 'success',
          entityType: 'audit',
        }),
      ).resolves.not.toThrow();

      const retrieved = await appStore.findById(entryId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(entryId);
    });

    it('rejects UPDATE operations from maxr_app with permission denied (DAC enforcement)', async () => {
      const entryId = randomUUID();
      await pool.query(
        "INSERT INTO audit_logs (id, action, outcome, entity_type) VALUES ($1, 'dac.test', 'success', 'test')",
        [entryId],
      );

      await expect(
        appPool.query("UPDATE audit_logs SET action = 'tampered' WHERE id = $1", [entryId]),
      ).rejects.toThrow(/permission denied for table audit_logs/i);
    });

    it('rejects DELETE operations from maxr_app with permission denied (DAC enforcement)', async () => {
      const entryId = randomUUID();
      await pool.query(
        "INSERT INTO audit_logs (id, action, outcome, entity_type) VALUES ($1, 'dac.test', 'success', 'test')",
        [entryId],
      );

      await expect(
        appPool.query('DELETE FROM audit_logs WHERE id = $1', [entryId]),
      ).rejects.toThrow(/permission denied for table audit_logs/i);
    });

    it('rejects TRUNCATE operations from maxr_app with permission denied (DAC enforcement)', async () => {
      await expect(appPool.query('TRUNCATE audit_logs')).rejects.toThrow(
        /permission denied for table audit_logs/i,
      );
    });

    it('strictly forbids maxr_app from modifying triggers or altering the table', async () => {
      await expect(
        appPool.query('DROP TRIGGER trg_audit_logs_no_update_delete ON audit_logs'),
      ).rejects.toThrow(/must be owner of relation audit_logs/i);
    });
  });
});
