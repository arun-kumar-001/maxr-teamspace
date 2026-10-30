import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { NO_ACCESS, ScopeFilter, scopeToSql } from './scope';

/**
 * Runs the generated scope conditions against a real PostgreSQL inside a transaction that is
 * rolled back, so nothing is left behind. Org: lead -> (anna, ben); ben -> (carl); dora has no manager.
 */
describe('scopeToSql against PostgreSQL', () => {
  let client: PoolClient;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    client = await getPool().connect();
    await client.query('BEGIN');
    const dept = await client.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ('Scope Test', 'SCOPE-T') RETURNING id`,
    );
    const desig = await client.query<{ id: string }>(
      `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Scope Tester', 'SCOPE-T') RETURNING id`,
      [dept.rows[0]?.id],
    );
    const add = async (name: string, manager?: string) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
         VALUES ($1, $2, 'T', $3, $4, $5, $6) RETURNING id`,
        [
          `SC-${name}`,
          name,
          `${name}@scope.test`,
          dept.rows[0]?.id,
          desig.rows[0]?.id,
          manager ?? null,
        ],
      );
      ids[name] = res.rows[0]?.id ?? '';
    };
    await add('lead');
    await add('anna', ids.lead);
    await add('ben', ids.lead);
    await add('carl', ids.ben);
    await add('dora');
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await closePool();
  });

  const visible = async (filter: ScopeFilter): Promise<string[]> => {
    const { clause, values } = scopeToSql(filter, 'e.id', 1);
    const res = await client.query<{ first_name: string }>(
      `SELECT e.first_name FROM employees e WHERE e.employee_code LIKE 'SC-%' AND ${clause} ORDER BY e.first_name`,
      values,
    );
    return res.rows.map((r) => r.first_name);
  };

  it('all: everyone', async () => {
    expect(await visible({ kind: 'all' })).toEqual(['anna', 'ben', 'carl', 'dora', 'lead']);
  });

  it('own: only the caller', async () => {
    expect(await visible({ kind: 'own', employeeId: ids.anna as string })).toEqual(['anna']);
  });

  it('team: direct reports only (not the lead, not reports of reports)', async () => {
    expect(await visible({ kind: 'team', managerId: ids.lead as string })).toEqual(['anna', 'ben']);
    expect(await visible({ kind: 'team', managerId: ids.ben as string })).toEqual(['carl']);
    expect(await visible({ kind: 'team', managerId: ids.dora as string })).toEqual([]);
  });

  it('none: nothing, even though rows exist', async () => {
    expect(await visible(NO_ACCESS)).toEqual([]);
  });

  it('a hostile id is a bound parameter, never SQL', async () => {
    await client.query('SAVEPOINT hostile');
    await expect(visible({ kind: 'own', employeeId: "x' OR '1'='1" })).rejects.toThrow(/uuid/i);
    await client.query('ROLLBACK TO SAVEPOINT hostile');
    expect(await visible({ kind: 'all' })).toHaveLength(5);
  });
});
