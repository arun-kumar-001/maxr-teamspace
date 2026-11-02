import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgUsersRepository } from './users.repository';

/**
 * Real PostgreSQL. Everything runs inside one transaction that is rolled back, so the shared
 * test database is untouched and the "last Admin" case can deactivate the seeded Admins freely.
 * The repository opens its own transaction; here BEGIN/COMMIT/ROLLBACK become savepoints.
 */
describe('PgUsersRepository (PostgreSQL)', () => {
  let outer: PoolClient;
  let repo: PgUsersRepository;
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const inner = {
      query: (sql: string, values?: unknown[]) => {
        const map: Record<string, string> = {
          BEGIN: 'SAVEPOINT repo_tx',
          COMMIT: 'RELEASE SAVEPOINT repo_tx',
          ROLLBACK: 'ROLLBACK TO SAVEPOINT repo_tx',
        };
        return client.query(map[sql] ?? sql, values);
      },
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgUsersRepository(() => nested(outer));
    const dept = await outer.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ('Users Test', 'USERS-T') RETURNING id`,
    );
    const desig = await outer.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Users Tester', 'USERS-T') RETURNING id`,
      [dept.rows[0]?.id],
    );
    const add = async (name: string, roles: string[], active = true) => {
      const emp = await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, $2, 'Tester', $3, $4, $5) RETURNING id`,
        [`UT-${name}`, name, `${name}@users.test`, dept.rows[0]?.id, desig.rows[0]?.id],
      );
      const user = await outer.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', $3) RETURNING id`,
        [emp.rows[0]?.id, `${name}@users.test`, active],
      );
      ids[name] = user.rows[0]?.id ?? '';
      await outer.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = ANY($2::text[])`,
        [ids[name], roles],
      );
    };
    await add('zed', [ROLES.STAFF]);
    await add('yara', [ROLES.STAFF, ROLES.TEAM_LEAD]);
    await add('xena', [ROLES.STAFF], false);
    // Every Admin other than the one under test is out of the picture inside this transaction.
    await outer.query(
      `UPDATE users SET is_active = false WHERE id NOT IN (SELECT id FROM users WHERE email LIKE '%@users.test')`,
    );
    await add('root', [ROLES.ADMIN]);
  });

  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  const find = (extra: Record<string, unknown> = {}) =>
    repo.findMany({
      search: '@users.test',
      sortBy: 'name',
      sortOrder: 'asc',
      limit: 50,
      offset: 0,
      ...extra,
    });

  it('lists accounts with the employee name, code and sorted role keys', async () => {
    const { items, total } = await find();
    expect(total).toBe(4);
    const yara = items.find((u) => u.id === ids.yara);
    expect(yara).toMatchObject({
      name: 'yara Tester',
      employeeCode: 'UT-yara',
      isActive: true,
      roles: [ROLES.STAFF, ROLES.TEAM_LEAD],
    });
    expect(yara).not.toHaveProperty('passwordHash');
  });

  it('filters by role, by active state and by search, and sorts by name', async () => {
    expect((await find({ role: ROLES.TEAM_LEAD })).items.map((u) => u.id)).toEqual([ids.yara]);
    expect((await find({ isActive: false })).items.map((u) => u.id)).toEqual([ids.xena]);
    expect((await find({ search: 'ZED' })).items.map((u) => u.id)).toEqual([ids.zed]);
    expect((await find()).items.map((u) => u.id)).toEqual([ids.root, ids.xena, ids.yara, ids.zed]);
    expect((await find({ sortOrder: 'desc' })).items[0]?.id).toBe(ids.zed);
  });

  it('treats % and _ in a search literally', async () => {
    expect((await find({ search: '%' })).total).toBe(0);
    expect((await find({ search: 'UT_' })).total).toBe(0);
  });

  it('reads one account, or null', async () => {
    expect((await repo.findById(ids.zed as string))?.roles).toEqual([ROLES.STAFF]);
    expect(await repo.findById('00000000-0000-4000-8000-00000000dead')).toBeNull();
  });

  it('lists the four roles with their active account counts', async () => {
    const roles = await repo.listRoles();
    expect(roles.map((r) => r.key)).toEqual([
      ROLES.ADMIN,
      ROLES.HR_MANAGER,
      ROLES.STAFF,
      ROLES.TEAM_LEAD,
    ]);
    // zed and yara are active staff; xena is inactive and not counted.
    expect(roles.find((r) => r.key === ROLES.STAFF)?.activeUsers).toBeGreaterThanOrEqual(2);
    expect(roles.find((r) => r.key === ROLES.ADMIN)?.activeUsers).toBe(1);
  });

  it('replaces the roles and reports the previous ones', async () => {
    const result = await repo.replaceRoles(ids.zed as string, [ROLES.TEAM_LEAD, ROLES.HR_MANAGER]);
    expect(result).toMatchObject({ status: 'changed', before: [ROLES.STAFF] });
    expect((await repo.findById(ids.zed as string))?.roles).toEqual([
      ROLES.HR_MANAGER,
      ROLES.TEAM_LEAD,
    ]);
  });

  it('reports unchanged when the set is the same, in any order', async () => {
    const result = await repo.replaceRoles(ids.yara as string, [ROLES.TEAM_LEAD, ROLES.STAFF]);
    expect(result.status).toBe('unchanged');
  });

  it('reports not_found for an unknown account', async () => {
    const result = await repo.replaceRoles('00000000-0000-4000-8000-00000000dead', [ROLES.STAFF]);
    expect(result.status).toBe('not_found');
  });

  it('refuses to take the Admin role from the last active Admin and changes nothing', async () => {
    const result = await repo.replaceRoles(ids.root as string, [ROLES.STAFF]);
    expect(result.status).toBe('last_admin');
    expect((await repo.findById(ids.root as string))?.roles).toEqual([ROLES.ADMIN]);
  });

  it('allows it once another active Admin exists, and an inactive Admin does not count', async () => {
    await outer.query(`UPDATE users SET is_active = false WHERE id = $1`, [ids.zed]);
    await repo.replaceRoles(ids.zed as string, [ROLES.ADMIN]);
    // zed is an inactive Admin: root is still the only active one.
    expect((await repo.replaceRoles(ids.root as string, [ROLES.STAFF])).status).toBe('last_admin');
    await outer.query(`UPDATE users SET is_active = true WHERE id = $1`, [ids.zed]);
    expect((await repo.replaceRoles(ids.root as string, [ROLES.STAFF])).status).toBe('changed');
  });
});
