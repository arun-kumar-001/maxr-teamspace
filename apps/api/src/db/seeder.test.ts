import { afterAll, describe, expect, it } from 'vitest';
import { ROLES, ROLE_DISPLAY_NAMES } from '@maxr/shared';
import { runDevSeed } from './seeder';
import { getPool, closePool } from './client';
import { config } from '../config/env';
import { isDatabaseAvailableSync } from '../test/helpers';

const hasDatabase = isDatabaseAvailableSync();

describe('Database Seeder (runDevSeed)', () => {
  it('refuses to execute when NODE_ENV is production (security violation guard)', async () => {
    const originalEnv = config.NODE_ENV;
    try {
      // Temporarily simulate production environment
      (config as { NODE_ENV: string }).NODE_ENV = 'production';
      await expect(runDevSeed()).rejects.toThrow(
        /\[Seeder Security Violation\] Cannot execute development seed in production environment!/i,
      );
    } finally {
      (config as { NODE_ENV: string }).NODE_ENV = originalEnv;
    }
  });

  describe.skipIf(!hasDatabase)('Live Database Seed Execution (Integration)', () => {
    const pool = getPool();

    afterAll(async () => {
      await closePool();
    });

    it('executes idempotently without error when run twice in development/test environment', async () => {
      // Run seed twice
      await expect(runDevSeed()).resolves.not.toThrow();
      await expect(runDevSeed()).resolves.not.toThrow();
    });

    it('verifies seeded roles use canonical keys and match ROLE_DISPLAY_NAMES exactly', async () => {
      await runDevSeed();
      const res = await pool.query<{ key: string; name: string }>(
        'SELECT key, name FROM roles ORDER BY key ASC',
      );

      const expectedKeys = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.STAFF, ROLES.TEAM_LEAD];
      expect(res.rows.map((r) => r.key)).toEqual(expectedKeys);

      for (const row of res.rows) {
        const canonicalName = ROLE_DISPLAY_NAMES[row.key as keyof typeof ROLE_DISPLAY_NAMES];
        expect(row.name).toBe(canonicalName);
      }
    });
  });
});
