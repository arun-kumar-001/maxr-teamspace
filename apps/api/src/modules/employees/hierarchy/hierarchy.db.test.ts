import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { ScopeFilter } from '../../rbac';
import { PgEmployeeDirectoryRepository } from '../directory/directory.repository';
import { PgHierarchyRepository } from './hierarchy.repository';
import { HierarchyService } from './hierarchy.service';

const silent = createLogger({ level: 'silent', write: () => undefined });
const ALL: ScopeFilter = { kind: 'all' };
const caller = () => ({ actorId: randomUUID(), employeeId: randomUUID(), requestId: 'req' });
const team = (managerId: string): ScopeFilter => ({ kind: 'team', managerId });
const q = { page: 1, pageSize: 100 };

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The
 * repository's own transaction becomes a savepoint, so a refused move can still be shown to leave
 * the tree as it was.
 */
describe('reporting hierarchy against PostgreSQL', () => {
  let outer: PoolClient;
  let service: HierarchyService;
  let directory: PgEmployeeDirectoryRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT hier_tx',
      COMMIT: 'RELEASE SAVEPOINT hier_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT hier_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const person = async (name: string, options: { manager?: string; status?: string } = {}) => {
    const res = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                              designation_id, manager_id, status)
       VALUES ($1, $2, 'Tree', $3, $4, $5, $6, $7) RETURNING id`,
      [
        `HT-${run}-${name}`,
        name,
        `${name}-${run}@tree.test`,
        ids.dept,
        ids.desig,
        options.manager ?? null,
        options.status ?? 'active',
      ],
    );
    ids[name] = res.rows[0]?.id ?? '';
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const { platform } = createTestPlatform({ logger: silent });
    service = new HierarchyService(new PgHierarchyRepository(() => nested(outer)), platform);
    directory = new PgEmployeeDirectoryRepository(() => nested(outer));
    ids.dept =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
          [`Tree ${run}`, `HT-${run}`],
        )
      ).rows[0]?.id ?? '';
    ids.desig =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Node', $2) RETURNING id`,
          [ids.dept, `HT-${run}`],
        )
      ).rows[0]?.id ?? '';
    // top <- mid <- low <- leaf, plus a separate branch other <- kid, a leaver and a loner.
    await person('top');
    await person('mid', { manager: ids.top });
    await person('low', { manager: ids.mid });
    await person('leaf', { manager: ids.low });
    await person('other');
    await person('kid', { manager: ids.other });
    await person('gone', { manager: ids.top, status: 'deactivated' });
    await person('loner');
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

  const managerOf = async (id: string) =>
    (
      await outer.query<{ manager_id: string | null }>(
        `SELECT manager_id FROM employees WHERE id = $1`,
        [id],
      )
    ).rows[0]?.manager_id;
  /** The people the team scope shows for a manager, as the directory sees them (leavers left out). */
  const visibleTo = async (managerId: string) =>
    (
      await directory.findMany({
        offset: 0,
        limit: 100,
        sort: { column: 'name', order: 'asc' },
        filter: team(managerId),
      })
    ).items
      .filter((e) => e.status !== 'deactivated')
      .map((e) => e.id);

  describe('the loop check', () => {
    it.each([
      ['a direct report', 'top', 'mid'],
      ['a report several levels down', 'top', 'leaf'],
    ])('refuses %s as the new manager', async (_name, employee, newManager) => {
      await expect(
        service.changeManager(
          ids[employee] as string,
          { version: 1, managerId: ids[newManager] as string },
          caller(),
          ALL,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(await managerOf(ids[employee] as string)).toBeNull();
    });

    it('refuses the employee as their own manager', async () => {
      await expect(
        service.changeManager(
          ids.loner as string,
          { version: 1, managerId: ids.loner as string },
          caller(),
          ALL,
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('allows a manager on another branch, or higher up', async () => {
      await service.changeManager(
        ids.leaf as string,
        { version: 1, managerId: ids.kid as string },
        caller(),
        ALL,
      );
      expect(await managerOf(ids.leaf as string)).toBe(ids.kid);
      await service.changeManager(
        ids.low as string,
        { version: 1, managerId: ids.top as string },
        caller(),
        ALL,
      );
      expect(await managerOf(ids.low as string)).toBe(ids.top);
    });

    it('ends even when the data already holds a loop', async () => {
      await outer.query(`UPDATE employees SET manager_id = $2 WHERE id = $1`, [ids.top, ids.leaf]);
      const result = await service.changeManager(
        ids.loner as string,
        { version: 1, managerId: ids.mid as string },
        caller(),
        ALL,
      );
      expect(result.managerId).toBe(ids.mid);
    });
  });

  it('assigns a manager: the version moves and the manager is named', async () => {
    const change = await service.changeManager(
      ids.loner as string,
      { version: 1, managerId: ids.top as string },
      caller(),
      ALL,
    );
    expect(change).toMatchObject({
      managerId: ids.top,
      manager: { id: ids.top, employeeCode: `HT-${run}-top`, name: 'top Tree' },
      version: 2,
    });
  });

  it('removes a manager, and refuses an inactive or deactivated one', async () => {
    expect(
      (
        await service.changeManager(
          ids.mid as string,
          { version: 1, managerId: null },
          caller(),
          ALL,
        )
      ).manager,
    ).toBeNull();
    await outer.query(`UPDATE employees SET status = 'pending' WHERE id = $1`, [ids.kid]);
    await expect(
      service.changeManager(
        ids.loner as string,
        { version: 1, managerId: ids.kid as string },
        caller(),
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      service.changeManager(
        ids.loner as string,
        { version: 1, managerId: ids.gone as string },
        caller(),
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      service.changeManager(
        ids.gone as string,
        { version: 1, managerId: ids.top as string },
        caller(),
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('answers 409 for a stale version, and 404 for an unknown employee', async () => {
    await service.changeManager(
      ids.loner as string,
      { version: 1, managerId: ids.top as string },
      caller(),
      ALL,
    );
    await expect(
      service.changeManager(
        ids.loner as string,
        { version: 1, managerId: ids.other as string },
        caller(),
        ALL,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      service.changeManager(randomUUID(), { version: 1, managerId: null }, caller(), ALL),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  describe('team scope follows the reporting tree (contract with the directory)', () => {
    it('moves with the employee when the manager changes', async () => {
      expect(await visibleTo(ids.top as string)).toEqual([ids.mid]);
      await service.changeManager(
        ids.mid as string,
        { version: 1, managerId: ids.other as string },
        caller(),
        ALL,
      );
      expect(await visibleTo(ids.top as string)).toEqual([]);
      expect((await visibleTo(ids.other as string)).sort()).toEqual([ids.kid, ids.mid].sort());
    });

    it('is cleared when the manager is removed', async () => {
      await service.changeManager(
        ids.mid as string,
        { version: 1, managerId: null },
        caller(),
        ALL,
      );
      expect(await visibleTo(ids.top as string)).toEqual([]);
    });

    it('goes to the new manager once the reports of a deactivated manager are reassigned', async () => {
      await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.other]);
      // Still pointing at the leaver, as deactivation leaves them (#26).
      expect(await visibleTo(ids.other as string)).toEqual([ids.kid]);
      await service.changeManager(
        ids.kid as string,
        { version: 1, managerId: ids.top as string },
        caller(),
        ALL,
      );
      expect(await visibleTo(ids.other as string)).toEqual([]);
      expect((await visibleTo(ids.top as string)).sort()).toEqual([ids.kid, ids.mid].sort());
    });
  });

  describe('reading the chart', () => {
    it('lists the top without leavers, with direct report counts', async () => {
      const roots = await service.roots(
        { ...q, status: undefined },
        {
          kind: 'all',
        },
      );
      const mine = roots.data.filter((n) => n.employeeCode.startsWith(`HT-${run}`));
      expect(mine.map((n) => [n.employeeCode.split('-').pop(), n.directReportCount])).toEqual([
        ['loner', 0],
        ['other', 1],
        ['top', 1],
      ]);
      expect(mine.every((n) => n.designation === 'Node')).toBe(true);
    });

    it('opens one level at a time, and counts only people who are still employed', async () => {
      const level = await service.directReports(ids.top as string, q, ALL, caller());
      // `gone` is deactivated: left out of the level and of the counts, listed only when asked for.
      expect(level.data.map((n) => n.id)).toEqual([ids.mid]);
      expect(level.data.find((n) => n.id === ids.mid)?.directReportCount).toBe(1);
      const leavers = await service.directReports(
        ids.top as string,
        { ...q, status: 'deactivated' },
        ALL,
        caller(),
      );
      expect(leavers.data.map((n) => n.id)).toEqual([ids.gone]);
    });

    it('applies the scope to the rows and lets a Team Lead open their own team', async () => {
      const lead = { actorId: 'x', employeeId: ids.top as string };
      const own = await service.directReports(ids.top as string, q, team(ids.top as string), lead);
      expect(own.data.map((n) => n.id)).toEqual([ids.mid]);
      await expect(
        service.directReports(ids.other as string, q, team(ids.top as string), lead),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('answers 404 for an unknown employee', async () => {
      await expect(service.directReports(randomUUID(), q, ALL, caller())).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});

/**
 * Two moves at the same moment need real commits and the real tree lock, which a rolled-back
 * transaction cannot show. Four people: q reports to p, s reports to r. Moving p under s while r
 * moves under q closes the loop p > s > r > q > p, yet the two moves touch different rows, so no
 * row lock makes them wait for each other: only the lock on the whole tree does.
 */
describe('reporting hierarchy: two moves at once', () => {
  const pool = getPool();
  const run = randomUUID().slice(0, 8);
  const ids: Record<'dept' | 'desig' | 'p' | 'q' | 'r' | 's', string> = {
    dept: '',
    desig: '',
    p: '',
    q: '',
    r: '',
    s: '',
  };

  /** Pauses after the loop check, so both requests are mid-transaction. */
  class SlowRepository extends PgHierarchyRepository {
    override async isSelfOrDescendant(
      ...args: Parameters<PgHierarchyRepository['isSelfOrDescendant']>
    ) {
      const result = await super.isSelfOrDescendant(...args);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return result;
    }
  }

  beforeAll(async () => {
    ids.dept = (
      await pool.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Race ${run}`, `HR-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await pool.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Racer', $2) RETURNING id`,
        [ids.dept, `HR-${run}`],
      )
    ).rows[0]?.id as string;
    const add = async (name: 'p' | 'q' | 'r' | 's', manager: string | null) => {
      ids[name] = (
        await pool.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, manager_id)
           VALUES ($1, $2, 'Race', $3, $4, $5, $6) RETURNING id`,
          [`HR-${run}-${name}`, name, `${name}-${run}@treerace.test`, ids.dept, ids.desig, manager],
        )
      ).rows[0]?.id as string;
    };
    await add('p', null);
    await add('q', ids.p);
    await add('r', null);
    await add('s', ids.r);
  });

  afterAll(async () => {
    // Reports before their managers: manager_id is not cascading.
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.q, ids.s]]);
    await pool.query(`DELETE FROM employees WHERE id = ANY($1::uuid[])`, [[ids.p, ids.r]]);
    await pool.query(`DELETE FROM designations WHERE id = $1`, [ids.desig]);
    await pool.query(`DELETE FROM departments WHERE id = $1`, [ids.dept]);
  });

  it('p under s and r under q at the same moment: one succeeds, the other is refused as a loop', async () => {
    const { platform } = createTestPlatform({ logger: silent });
    const service = new HierarchyService(new SlowRepository(getPool), platform);
    const settled = await Promise.allSettled([
      service.changeManager(ids.p, { version: 1, managerId: ids.s }, caller(), ALL),
      service.changeManager(ids.r, { version: 1, managerId: ids.q }, caller(), ALL),
    ]);
    const refused = settled.filter((x) => x.status === 'rejected') as PromiseRejectedResult[];
    expect(settled.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0]?.reason).toMatchObject({ statusCode: 422 });

    // Whatever happened, the tree has no loop: walking up from anyone ends.
    const loops = await pool.query<{ id: string }>(
      `WITH RECURSIVE up(start, id, depth) AS (
         SELECT id, manager_id, 1 FROM employees WHERE id = ANY($1::uuid[])
         UNION ALL
         SELECT up.start, e.manager_id, up.depth + 1
           FROM employees e JOIN up ON e.id = up.id WHERE up.depth < 10
       )
       SELECT DISTINCT start AS id FROM up WHERE id = start`,
      [[ids.p, ids.q, ids.r, ids.s]],
    );
    expect(loops.rows).toEqual([]);
  });
});

// Both groups share the pool; close it once, after the last test has run.
afterAll(async () => {
  await closePool();
});
