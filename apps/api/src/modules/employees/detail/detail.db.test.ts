import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { ScopeFilter } from '../../rbac';
import { PgEmployeeDetailRepository } from './detail.repository';
import { EmployeeDetailService } from './detail.service';

const silent = createLogger({ level: 'silent', write: () => undefined });
const ALL: ScopeFilter = { kind: 'all' };
const adminCaller = { actorId: randomUUID(), roles: [ROLES.ADMIN] };
const hrCaller = { actorId: randomUUID(), roles: [ROLES.HR_MANAGER] };

/**
 * Real PostgreSQL inside one transaction that is rolled back (savepoint per test). The
 * repository's own transaction becomes a savepoint, so a failed edit can still be shown to leave
 * nothing behind.
 */
describe('employee detail against PostgreSQL', () => {
  let outer: PoolClient;
  let service: EmployeeDetailService;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT detail_tx',
      COMMIT: 'RELEASE SAVEPOINT detail_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT detail_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const { platform } = createTestPlatform({ logger: silent });
    service = new EmployeeDetailService(
      new PgEmployeeDetailRepository(() => nested(outer)),
      platform,
    );
    const dept = async (code: string) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
          [`Detail ${code} ${run}`, `DT-${run}-${code}`],
        )
      ).rows[0]?.id ?? '';
    const desig = async (department: string, code: string) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title, code) VALUES ($1, $2, $3) RETURNING id`,
          [department, `Title ${code}`, `DT-${run}-${code}`],
        )
      ).rows[0]?.id ?? '';
    ids.deptA = await dept('A');
    ids.deptB = await dept('B');
    ids.desigA = await desig(ids.deptA as string, 'A');
    ids.desigB = await desig(ids.deptB as string, 'B');
    const person = async (name: string, manager?: string) => {
      const emp = await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id,
                                designation_id, manager_id, joining_date)
         VALUES ($1, $2, 'Detail', $3, '+91 90000 00000', $4, $5, $6, '2026-02-01') RETURNING id`,
        [
          `DT-${run}-${name}`,
          name,
          `${name}-${run}@detail.test`,
          ids.deptA,
          ids.desigA,
          manager ?? null,
        ],
      );
      ids[name] = emp.rows[0]?.id ?? '';
      const user = await outer.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash, last_login_at)
         VALUES ($1, $2, 'x', '2026-10-01T08:00:00Z') RETURNING id`,
        [ids[name], `${name}-${run}@detail.test`],
      );
      ids[`${name}User`] = user.rows[0]?.id ?? '';
      await outer.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = ANY($2::text[])`,
        [ids[`${name}User`], [ROLES.STAFF, ROLES.TEAM_LEAD]],
      );
    };
    await person('boss');
    await person('amy', ids.boss);
    await person('ben');
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
  });

  const team = (managerId: string): ScopeFilter => ({ kind: 'team', managerId });
  const state = async (id: string) =>
    (
      await outer.query<{ version: number; updated_at: Date; first_name: string; email: string }>(
        `SELECT version, updated_at, first_name, email FROM employees WHERE id = $1`,
        [id],
      )
    ).rows[0];

  it('reads the employee with department, designation, manager and login information', async () => {
    const d = await service.get(ids.amy as string, ALL, hrCaller);
    expect(d).toMatchObject({
      employeeCode: `DT-${run}-amy`,
      status: 'active',
      joiningDate: '2026-02-01',
      version: 1,
      department: { id: ids.deptA },
      designation: { id: ids.desigA, title: 'Title A' },
      manager: { id: ids.boss, employeeCode: `DT-${run}-boss` },
      account: {
        userId: ids.amyUser,
        isActive: true,
        lastLoginAt: '2026-10-01T08:00:00.000Z',
        roles: [ROLES.STAFF, ROLES.TEAM_LEAD],
      },
    });
    const lead = await service.get(ids.amy as string, ALL, {
      actorId: 'x',
      roles: [ROLES.TEAM_LEAD],
    });
    expect(lead.account).toBeUndefined();
  });

  it('applies the record scope inside the query', async () => {
    await expect(
      service.get(ids.amy as string, team(ids.boss as string), hrCaller),
    ).resolves.toBeDefined();
    await expect(
      service.get(ids.ben as string, team(ids.boss as string), hrCaller),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.get(ids.amy as string, { kind: 'none' }, hrCaller)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('the database bumps the version and the update time on every update', async () => {
    const before = await state(ids.ben as string);
    await outer.query(`UPDATE employees SET phone = '+91 91111 11111' WHERE id = $1`, [ids.ben]);
    const after = await state(ids.ben as string);
    expect(after?.version).toBe((before?.version ?? 0) + 1);
    expect(after?.updated_at.getTime()).toBeGreaterThanOrEqual(before?.updated_at.getTime() ?? 0);
  });

  it('the version cannot be set by hand: the trigger decides it', async () => {
    const before = (await state(ids.ben as string))?.version ?? 0;
    await outer.query(`UPDATE employees SET version = 999 WHERE id = $1`, [ids.ben]);
    expect((await state(ids.ben as string))?.version).toBe(before + 1);
  });

  it('edits the fields, bumps the version and keeps the sign-in email in step', async () => {
    const updated = await service.update(
      ids.amy as string,
      { version: 1, firstName: 'Amelia', phone: null, email: `amelia-${run}@detail.test` },
      adminCaller,
      ALL,
    );
    expect(updated).toMatchObject({ firstName: 'Amelia', phone: null, version: 2 });
    const user = await outer.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      ids.amyUser,
    ]);
    expect(user.rows[0]?.email).toBe(`amelia-${run}@detail.test`);
  });

  it('moves an employee to another department together with a matching designation', async () => {
    const updated = await service.update(
      ids.amy as string,
      { version: 1, departmentId: ids.deptB, designationId: ids.desigB },
      hrCaller,
      ALL,
    );
    expect(updated).toMatchObject({
      department: { id: ids.deptB },
      designation: { id: ids.desigB },
    });
  });

  it('refuses a department change that leaves the designation in the old department, and changes nothing', async () => {
    await expect(
      service.update(ids.amy as string, { version: 1, departmentId: ids.deptB }, hrCaller, ALL),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect((await state(ids.amy as string))?.version).toBe(1);
  });

  it('answers 409 for a stale version, a taken code and a taken email, and changes nothing', async () => {
    await service.update(ids.amy as string, { version: 1, firstName: 'One' }, hrCaller, ALL);
    await expect(
      service.update(ids.amy as string, { version: 1, firstName: 'Two' }, hrCaller, ALL),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.update(
        ids.amy as string,
        { version: 2, employeeCode: `dt-${run}-BEN` },
        adminCaller,
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.update(
        ids.amy as string,
        { version: 2, email: `BEN-${run}@detail.test` },
        adminCaller,
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await state(ids.amy as string)).toMatchObject({ version: 2, first_name: 'One' });
  });

  it("an email used by another account is refused; the employee's own code, in another letter case, is not a clash", async () => {
    await expect(
      service.update(
        ids.amy as string,
        { version: 1, email: `ben-${run}@detail.test` },
        adminCaller,
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    const recased = await service.update(
      ids.amy as string,
      { version: 1, employeeCode: `dt-${run}-AMY` },
      adminCaller,
      ALL,
    );
    expect(recased).toMatchObject({ employeeCode: `dt-${run}-AMY`, version: 2 });
  });

  it('refuses to edit a deactivated employee', async () => {
    await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.ben]);
    const v = (await state(ids.ben as string))?.version ?? 0;
    await expect(
      service.update(ids.ben as string, { version: v, firstName: 'X' }, hrCaller, ALL),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('does not change the version when nothing differs', async () => {
    const same = await service.update(
      ids.amy as string,
      { version: 1, firstName: 'amy', joiningDate: '2026-02-01' },
      hrCaller,
      ALL,
    );
    expect(same.version).toBe(1);
    expect((await state(ids.amy as string))?.version).toBe(1);
  });
});

/**
 * Two requests at the same moment need real commits and real row locks, which a rolled-back
 * transaction cannot show. Fixtures are committed with unique codes and deleted at the end.
 */
describe('employee detail: concurrent edits', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', desig: '', employee: '' };
  const { platform } = createTestPlatform({ logger: silent });
  /**
   * Pauses between reading the row and writing it, so both requests are inside their
   * transactions at the same time. Without the row lock both would pass the version check.
   */
  class SlowRepository extends PgEmployeeDetailRepository {
    override async isTaken(...args: Parameters<PgEmployeeDetailRepository['isTaken']>) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return super.isTaken(...args);
    }
  }
  const service = new EmployeeDetailService(new SlowRepository(getPool), platform);

  beforeAll(async () => {
    ids.dept = (
      await pool.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Concurrent ${run}`, `CC-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await pool.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Racer', $2) RETURNING id`,
        [ids.dept, `CC-${run}`],
      )
    ).rows[0]?.id as string;
    ids.employee = (
      await pool.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, 'Race', 'Person', $2, $3, $4) RETURNING id`,
        [`CC-${run}-E`, `race-${run}@detail.test`, ids.dept, ids.desig],
      )
    ).rows[0]?.id as string;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM employees WHERE id = $1`, [ids.employee]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
  });

  it('two edits on the same version: one wins, the other is a 409, nothing is lost', async () => {
    const settled = await Promise.allSettled([
      service.update(ids.employee, { version: 1, firstName: 'Alpha' }, hrCaller, ALL),
      service.update(ids.employee, { version: 1, lastName: 'Beta' }, hrCaller, ALL),
    ]);
    const winners = settled.filter((s) => s.status === 'fulfilled');
    const losers = settled.filter((s) => s.status === 'rejected');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect((losers[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 });
    const row = await pool.query<{ version: number; first_name: string; last_name: string }>(
      `SELECT version, first_name, last_name FROM employees WHERE id = $1`,
      [ids.employee],
    );
    expect(row.rows[0]?.version).toBe(2);
    // Exactly one of the two edits is stored, never a mix.
    const changed = [row.rows[0]?.first_name === 'Alpha', row.rows[0]?.last_name === 'Beta'];
    expect(changed.filter(Boolean)).toHaveLength(1);
  });
});

// Both groups share the pool; close it once, after the last test has run.
afterAll(async () => {
  await closePool();
});
