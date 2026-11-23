import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from './client';

describe('database integration setup', () => {
  afterAll(async () => {
    await closePool();
  });

  it('connects to the PostgreSQL in DATABASE_URL and finds the applied migrations', async () => {
    const pool = getPool();
    const version = await pool.query<{ server_version_num: string }>('SHOW server_version_num');
    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(160000);
    const applied = await pool.query<{ count: string }>('SELECT count(*) FROM schema_migrations');
    expect(Number(applied.rows[0]?.count)).toBeGreaterThan(0);
  });
});
