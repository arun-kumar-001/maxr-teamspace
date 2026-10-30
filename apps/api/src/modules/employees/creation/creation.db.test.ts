import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { testHasher } from '../../auth/auth.testing';
import { PgEmployeeCreationRepository } from './creation.repository';
import { EmployeeCreationService } from './creation.service';
import { CreateEmployeeDto } from './creation.types';

/**
 * Real PostgreSQL, inside one transaction that is rolled back at the end. The repository opens
 * its own transaction; here BEGIN/COMMIT/ROLLBACK become savepoints, so a failed creation can
 * still be shown to leave nothing behind.
 */
describe('employee creation against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgEmployeeCreationRepository;
  let service: EmployeeCreationService;
  const run = randomUUID().slice(0, 8);
  const ids = { dept: '', otherDept: '', desig: '', manager: '' };

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT creation_tx',
      COMMIT: 'RELEASE SAVEPOINT creation_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT creation_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const dto = (n: number, overrides: Partial<CreateEmployeeDto> = {}): CreateEmployeeDto => ({
    employeeCode: `CR-${run}-${n}`,
    firstName: 'Created',
    lastName: `Person${n}`,
    email: `created-${run}-${n}@creation.test`,
    departmentId: ids.dept,
    designationId: ids.desig,
    managerId: ids.manager,
    joiningDate: '2026-11-02',
    role: ROLES.STAFF,
    ...overrides,
  });

  const count = async (sql: string, values: unknown[]) =>
    (await outer.query<{ n: number }>(sql, values)).rows[0]?.n;

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgEmployeeCreationRepository(() => nested(outer));
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    service = new EmployeeCreationService(repo, platform, testHasher, silent);

    const dept = (code: string) =>
      outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Creation ${code}`, `CR-${run}-${code}`],
      );
    ids.dept = (await dept('A')).rows[0]?.id ?? '';
    ids.otherDept = (await dept('B')).rows[0]?.id ?? '';
    ids.desig =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Creator', $2) RETURNING id`,
          [ids.dept, `CR-${run}`],
        )
      ).rows[0]?.id ?? '';
    ids.manager =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
           VALUES ($1, 'Boss', 'Person', $2, $3, $4) RETURNING id`,
          [`CR-${run}-BOSS`, `boss-${run}@creation.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id ?? '';
  });

  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  it('stores a pending employee, an inactive user and the role, and links them', async () => {
    const created = await service.create(dto(1, { role: ROLES.TEAM_LEAD }), {
      actorId: randomUUID(),
      roles: [ROLES.ADMIN],
    });
    const row = await outer.query(
      `SELECT e.status, e.manager_id, e.joining_date::text AS joining_date, e.email,
              u.is_active, u.employee_id, u.email AS user_email, u.password_hash,
              array_agg(r.key) AS roles
         FROM employees e
         JOIN users u ON u.employee_id = e.id
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
        WHERE e.id = $1
        GROUP BY e.id, u.id`,
      [created.id],
    );
    expect(row.rows[0]).toMatchObject({
      status: 'pending',
      manager_id: ids.manager,
      joining_date: '2026-11-02',
      is_active: false,
      employee_id: created.id,
      user_email: created.email,
      roles: [ROLES.TEAM_LEAD],
    });
    expect(row.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(created.joiningDate).toBe('2026-11-02');
  });

  it('refuses a repeated code or email before inserting, and the index is the backstop', async () => {
    const first = await service.create(dto(2), { actorId: randomUUID(), roles: [ROLES.ADMIN] });
    await expect(
      service.create(dto(3, { employeeCode: first.employeeCode.toLowerCase() }), {
        actorId: randomUUID(),
        roles: [ROLES.ADMIN],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.create(dto(4, { email: first.email.toUpperCase() }), {
        actorId: randomUUID(),
        roles: [ROLES.ADMIN],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Two requests that both passed the check at the same moment: the unique index decides.
    await outer.query('SAVEPOINT backstop');
    await expect(
      repo.insertAccount(outer, dto(5, { employeeCode: first.employeeCode }), 'x'),
    ).rejects.toMatchObject({ code: '23505' });
    await outer.query('ROLLBACK TO SAVEPOINT backstop');
  });

  it('a failure while creating the user account leaves no employee behind', async () => {
    // An account with this email already exists for someone else: the employees row would be fine,
    // the users insert is what fails, after the employee was inserted.
    const taken = `taken-${run}@creation.test`;
    const holder = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
       VALUES ($1, 'Holder', 'Person', $2, $3, $4) RETURNING id`,
      [`CR-${run}-HOLD`, `holder-${run}@creation.test`, ids.dept, ids.desig],
    );
    await outer.query(
      `INSERT INTO users (employee_id, email, password_hash) VALUES ($1, $2, 'x')`,
      [holder.rows[0]?.id, taken],
    );
    const before = await count(`SELECT COUNT(*)::int AS n FROM employees`, []);
    await expect(
      repo.transaction((tx) =>
        repo.insertAccount(tx, dto(6, { email: taken, employeeCode: `CR-${run}-FAIL` }), 'x'),
      ),
    ).rejects.toMatchObject({ code: '23505' });
    expect(await count(`SELECT COUNT(*)::int AS n FROM employees`, [])).toBe(before);
    expect(
      await count(`SELECT COUNT(*)::int AS n FROM employees WHERE employee_code = $1`, [
        `CR-${run}-FAIL`,
      ]),
    ).toBe(0);
  });

  it('reads the department, designation and manager the new employee points at', async () => {
    const refs = await repo.transaction((tx) =>
      repo.lockReferences(tx, {
        departmentId: ids.dept,
        designationId: ids.desig,
        managerId: ids.manager,
      }),
    );
    expect(refs).toEqual({
      department: { isActive: true },
      designation: { isActive: true, departmentId: ids.dept },
      manager: { status: 'active' },
    });
    const missing = await repo.transaction((tx) =>
      repo.lockReferences(tx, {
        departmentId: randomUUID(),
        designationId: randomUUID(),
        managerId: randomUUID(),
      }),
    );
    expect(missing).toEqual({ department: null, designation: null, manager: null });
  });

  it('refuses a designation that belongs to another department with 422', async () => {
    await expect(
      service.create(dto(7, { departmentId: ids.otherDept }), {
        actorId: randomUUID(),
        roles: [ROLES.ADMIN],
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('refuses a deactivated manager and an inactive department with 422', async () => {
    await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.manager]);
    await expect(
      service.create(dto(8), { actorId: randomUUID(), roles: [ROLES.ADMIN] }),
    ).rejects.toMatchObject({ statusCode: 422 });
    await outer.query(`UPDATE employees SET status = 'active' WHERE id = $1`, [ids.manager]);
    await outer.query(`UPDATE departments SET is_active = false WHERE id = $1`, [ids.dept]);
    await expect(
      service.create(dto(9), { actorId: randomUUID(), roles: [ROLES.ADMIN] }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
