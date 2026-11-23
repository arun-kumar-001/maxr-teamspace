import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { PgEmployeePhotoRepository } from './photo.repository';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('employee photos against PostgreSQL', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', lead: '', member: '', outsider: '' };

  const nested = (): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT photo_tx',
      COMMIT: 'RELEASE SAVEPOINT photo_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT photo_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => outer.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: outer.query.bind(outer), connect: async () => inner } as unknown as Pool;
  };
  const repo = () => new PgEmployeePhotoRepository(nested);
  const employee = async (n: string, managerId?: string) =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, 'P', $2, $3, $4, $5, $6) RETURNING id`,
        [`PH-${run}-${n}`, n, `ph-${run}-${n}@photo.test`, ids.dept, ids.desig, managerId ?? null],
      )
    ).rows[0]!.id;

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Photo ${run}`, `PHO-${run}`],
      )
    ).rows[0]!.id;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
        [ids.dept],
      )
    ).rows[0]!.id;
    ids.lead = await employee('lead');
    ids.member = await employee('member', ids.lead);
    ids.outsider = await employee('outsider');
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  it('has no photo until one is stored', async () => {
    expect(await repo().find(ids.member, { kind: 'all' })).toBeNull();
  });

  it('stores a key with a version, and hands back the key it replaced', async () => {
    const first = await repo().replace(ids.member, 'profile-photos/2026/11/a');
    expect(first.replacedKey).toBeNull();
    expect(first.version).toBeGreaterThan(0);

    expect(await repo().find(ids.member, { kind: 'all' })).toEqual({
      key: 'profile-photos/2026/11/a',
      version: first.version,
    });

    const second = await repo().replace(ids.member, 'profile-photos/2026/11/b');
    expect(second.replacedKey).toBe('profile-photos/2026/11/a');
    expect(second.version).toBeGreaterThanOrEqual(first.version);
    expect((await repo().find(ids.member, { kind: 'all' }))?.key).toBe('profile-photos/2026/11/b');
  });

  it('only finds a photo inside the caller scope', async () => {
    await repo().replace(ids.member, 'profile-photos/2026/11/m');
    expect(await repo().find(ids.member, { kind: 'own', employeeId: ids.member })).not.toBeNull();
    expect(await repo().find(ids.member, { kind: 'own', employeeId: ids.outsider })).toBeNull();
    expect(await repo().find(ids.member, { kind: 'team', managerId: ids.lead })).not.toBeNull();
    expect(await repo().find(ids.member, { kind: 'team', managerId: ids.outsider })).toBeNull();
    expect(await repo().find(ids.member, { kind: 'none' })).toBeNull();
  });

  it('clears the photo and returns its key, then has nothing to return', async () => {
    await repo().replace(ids.member, 'profile-photos/2026/11/c');
    expect(await repo().clear(ids.member)).toBe('profile-photos/2026/11/c');
    expect(await repo().find(ids.member, { kind: 'all' })).toBeNull();
    expect(await repo().clear(ids.member)).toBeNull();
  });
});
