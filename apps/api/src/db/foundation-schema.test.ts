import { afterAll, describe, expect, it } from 'vitest';
import { ROLES, ROLE_DISPLAY_NAMES } from '@maxr/shared';
import { getPool, closePool } from './client';

describe('Foundation Schema Constraints & Data Integrity (TL-04)', () => {
  const pool = getPool();

  afterAll(async () => {
    await closePool();
  });

  describe('Canonical Roles & Display Names', () => {
    it('contains exactly the 4 canonical roles confirmed in D-01', async () => {
      const res = await pool.query<{ key: string; name: string }>(
        'SELECT key, name FROM roles ORDER BY key ASC',
      );
      const keys = res.rows.map((r) => r.key);
      expect(keys).toEqual([ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.STAFF, ROLES.TEAM_LEAD]);

      // Verify display names match the single canonical ROLE_DISPLAY_NAMES constant
      for (const row of res.rows) {
        const expectedName = ROLE_DISPLAY_NAMES[row.key as keyof typeof ROLE_DISPLAY_NAMES];
        expect(row.name).toBe(expectedName);
      }
    });

    it('contains seeded permission catalog and role mappings', async () => {
      const permRes = await pool.query('SELECT count(*) as count FROM permissions');
      expect(Number(permRes.rows[0].count)).toBeGreaterThan(20);

      const mappingRes = await pool.query<{ role_key: string; perm_count: string }>(`
        SELECT r.key as role_key, count(rp.permission_id) as perm_count
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        GROUP BY r.key;
      `);
      expect(mappingRes.rows.length).toBe(4);

      const adminPerms = mappingRes.rows.find((r) => r.role_key === ROLES.ADMIN);
      expect(Number(adminPerms?.perm_count)).toBeGreaterThanOrEqual(30);
    });
  });

  describe('User - Employee 1:1 Relationship (G-04)', () => {
    it('enforces NOT NULL on users.employee_id', async () => {
      await expect(
        pool.query(
          "INSERT INTO users (email, password_hash) VALUES ('test-null-emp@maxr.internal', 'hash')",
        ),
      ).rejects.toThrow(/null value in column "employee_id"/i);
    });

    it('enforces UNIQUE on users.employee_id', async () => {
      // EMP-0001 is already linked to admin user in seed
      await expect(
        pool.query(`
          INSERT INTO users (employee_id, email, password_hash)
          VALUES ('50000000-0000-0000-0000-000000000001', 'duplicate-emp@maxr.internal', 'hash');
        `),
      ).rejects.toThrow(/violates unique constraint/i);
    });

    it('enforces foreign key on users.employee_id referencing employees', async () => {
      await expect(
        pool.query(`
          INSERT INTO users (employee_id, email, password_hash)
          VALUES ('99999999-9999-9999-9999-999999999999', 'nonexistent-emp@maxr.internal', 'hash');
        `),
      ).rejects.toThrow(/violates foreign key constraint/i);
    });
  });

  describe('Referential Integrity & Delete Restraints', () => {
    it('restricts deleting a department that has active designations', async () => {
      // Engineering department has designations linked
      await expect(pool.query("DELETE FROM departments WHERE code = 'ENG'")).rejects.toThrow(
        /violates foreign key constraint/i,
      );
    });

    it('restricts deleting a designation that has active employees', async () => {
      // ENG-DIR has EMP-0001 linked
      await expect(pool.query("DELETE FROM designations WHERE code = 'ENG-DIR'")).rejects.toThrow(
        /violates foreign key constraint/i,
      );
    });
  });

  describe('Status Check Constraints', () => {
    it('rejects invalid employee status', async () => {
      await expect(
        pool.query(`
          INSERT INTO employees (
            employee_code, first_name, last_name, email, department_id, designation_id, status
          ) VALUES (
            'EMP-INVALID-STATUS', 'Test', 'User', 'invalid-status@maxr.internal',
            '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001',
            'unknown_status'
          );
        `),
      ).rejects.toThrow(/check constraint "employees_status_check"/i);
    });

    it('rejects invalid audit log outcome', async () => {
      await expect(
        pool.query(`
          INSERT INTO audit_logs (action, outcome, entity_type)
          VALUES ('test.action', 'invalid_outcome', 'test_entity');
        `),
      ).rejects.toThrow(/check constraint "audit_logs_outcome_check"/i);
    });

    it('rejects invalid notification outbox status', async () => {
      await expect(
        pool.query(`
          INSERT INTO notification_outbox (payload, status)
          VALUES ('{}'::jsonb, 'invalid_status');
        `),
      ).rejects.toThrow(/check constraint "notification_outbox_status_check"/i);
    });
  });
});
