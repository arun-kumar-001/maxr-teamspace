import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  log: [] as string[],
  appliedIds: [] as string[],
  failMigrations: false,
  released: 0,
}));

// A fake connection that records what the runner sends. The real PostgreSQL run is covered
// by the "Database" job in CI (migrate twice, seed twice).
vi.mock('./client', () => ({
  closePool: vi.fn(),
  getPool: () => ({
    connect: async () => ({
      release: () => {
        h.released += 1;
      },
      query: async (sql: string) => {
        const text = sql.trim();
        if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          h.log.push('ENSURE_TRACKING_TABLE');
          return { rows: [] };
        }
        if (text.startsWith('SELECT id, name FROM schema_migrations')) {
          return { rows: h.appliedIds.map((id) => ({ id, name: `${id}.sql` })) };
        }
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) {
          h.log.push(text);
          return { rows: [] };
        }
        if (text.startsWith('INSERT INTO schema_migrations')) {
          h.log.push('RECORD');
          return { rows: [] };
        }
        h.log.push('MIGRATION_SQL');
        if (h.failMigrations) {
          throw new Error('syntax error at or near "BROKEN"');
        }
        return { rows: [] };
      },
    }),
  }),
}));

import { getMigrationsDir, runMigrations } from './migrator';

const files = () =>
  fs
    .readdirSync(getMigrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort();
const ids = () => files().map((f) => f.replace(/\.sql$/, ''));

beforeEach(() => {
  h.log = [];
  h.appliedIds = [];
  h.failMigrations = false;
  h.released = 0;
});

describe('migration files', () => {
  it('there is at least one migration and each name is <14-digit timestamp>_<snake_case>.sql', () => {
    expect(files().length).toBeGreaterThan(0);
    for (const f of files()) {
      expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
    }
  });

  it('timestamps are unique, so the order is unambiguous', () => {
    const stamps = files().map((f) => f.slice(0, 14));
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('every migration is idempotent-safe SQL that is not empty', () => {
    for (const f of files()) {
      const sql = fs.readFileSync(path.join(getMigrationsDir(), f), 'utf-8');
      expect(sql.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('runMigrations', () => {
  it('applies every pending migration, each one inside its own transaction, and records it', async () => {
    const result = await runMigrations();
    expect(result.applied).toEqual(files());
    expect(result.total).toBe(files().length);
    const perMigration = ['BEGIN', 'MIGRATION_SQL', 'RECORD', 'COMMIT'];
    expect(h.log).toEqual(['ENSURE_TRACKING_TABLE', ...files().flatMap(() => perMigration)]);
    expect(h.released).toBe(1);
  });

  it('a second run applies nothing (idempotent)', async () => {
    h.appliedIds = ids();
    const result = await runMigrations();
    expect(result.applied).toEqual([]);
    expect(result.total).toBe(files().length);
    expect(h.log).toEqual(['ENSURE_TRACKING_TABLE']);
  });

  it('only applies the migrations that are missing', async () => {
    const all = ids();
    h.appliedIds = all.slice(0, -1);
    const result = await runMigrations();
    expect(result.applied).toEqual(files().slice(-1));
  });

  it('rolls back, does not record, releases the connection and rethrows when a migration fails', async () => {
    h.failMigrations = true;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(runMigrations()).rejects.toThrow(/syntax error/);
    quiet.mockRestore();
    expect(h.log).toEqual(['ENSURE_TRACKING_TABLE', 'BEGIN', 'MIGRATION_SQL', 'ROLLBACK']);
    expect(h.log).not.toContain('COMMIT');
    expect(h.log).not.toContain('RECORD');
    expect(h.released).toBe(1);
  });
});
