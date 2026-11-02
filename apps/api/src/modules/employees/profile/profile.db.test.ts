import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { PgEmployeeDetailRepository } from '../detail/detail.repository';
import { EmployeeDetailService } from '../detail/detail.service';
import { ProfileService } from './profile.service';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('my profile against PostgreSQL', () => {
  let outer: PoolClient;
  let profile: ProfileService;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT prof_tx',
      COMMIT: 'RELEASE SAVEPOINT prof_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT prof_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const caller = (name: string) => ({
    actorId: randomUUID(),
    employeeId: ids[name] as string,
    roles: [ROLES.STAFF],
  });

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    profile = new ProfileService(
      new EmployeeDetailService(new PgEmployeeDetailRepository(() => nested(outer)), platform),
    );
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Profile ${run}`, `PR-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Owner', $2) RETURNING id`,
        [ids.dept, `PR-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['amy', 'ben']) {
      ids[name] = (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id, designation_id)
           VALUES ($1, $2, 'Profile', $3, '+91 90000 00000', $4, $5) RETURNING id`,
          [`PR-${run}-${name}`, name, `${name}-${run}@profile.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id as string;
    }
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

  const row = async (name: string) =>
    (
      await outer.query<{
        phone: string | null;
        version: number;
        first_name: string;
        status: string;
      }>(`SELECT phone, version, first_name, status FROM employees WHERE id = $1`, [ids[name]])
    ).rows[0];

  it("reads the caller's own record, joined with department and designation", async () => {
    const me = await profile.get(caller('amy'));
    expect(me).toMatchObject({
      id: ids.amy,
      employeeCode: `PR-${run}-amy`,
      department: { id: ids.dept },
      designation: { id: ids.desig },
      version: 1,
    });
  });

  it('changes the phone, bumps the version, and touches no one else and no other column', async () => {
    const updated = await profile.update({ version: 1, phone: '+91 97777 77777' }, caller('amy'));
    expect(updated).toMatchObject({ phone: '+91 97777 77777', version: 2 });
    expect(await row('amy')).toMatchObject({
      phone: '+91 97777 77777',
      first_name: 'amy',
      status: 'active',
    });
    expect(await row('ben')).toMatchObject({ phone: '+91 90000 00000', version: 1 });
  });

  it('answers 409 for a stale version, and keeps the record', async () => {
    await profile.update({ version: 1, phone: null }, caller('amy'));
    await expect(
      profile.update({ version: 1, phone: '+91 96666 66666' }, caller('amy')),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await row('amy'))?.phone).toBeNull();
  });

  it("cannot reach another employee: the record is always the caller's", async () => {
    await profile.update({ version: 1, phone: '+91 95555 55555' }, caller('ben'));
    expect((await row('amy'))?.phone).toBe('+91 90000 00000');
    expect((await row('ben'))?.phone).toBe('+91 95555 55555');
  });

  it('refuses a deactivated employee', async () => {
    await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.amy]);
    const v = (await row('amy'))?.version ?? 0;
    await expect(profile.update({ version: v, phone: null }, caller('amy'))).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});
