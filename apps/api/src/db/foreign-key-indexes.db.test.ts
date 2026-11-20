import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from './client';

describe('foreign key indexes (AGENTS.md section 6)', () => {
  afterAll(async () => {
    await closePool();
  });

  it('every single-column foreign key has an index that starts with that column', async () => {
    const res = await getPool().query<{ table_name: string; column_name: string }>(
      `SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
          AND NOT EXISTS (
            SELECT 1 FROM pg_index i
             WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
        ORDER BY 1, 2`,
    );
    expect(res.rows.map((r) => `${r.table_name}.${r.column_name}`)).toEqual([]);
  });
});
