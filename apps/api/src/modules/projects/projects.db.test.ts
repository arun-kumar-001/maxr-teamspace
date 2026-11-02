import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { PgProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';

const ALL = { kind: 'all' } as const;

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The shared
 * development database may hold other projects, so checks name the fixtures they care about.
 */
describe('projects against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgProjectsRepository;
  let service: ProjectsService;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};
  const caller = { actorId: randomUUID(), employeeId: '' };

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT project_tx',
      COMMIT: 'RELEASE SAVEPOINT project_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT project_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const employee = async (
    name: string,
    options: { role?: string; managerId?: string; status?: string; userActive?: boolean } = {},
  ) => {
    const id = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
                                designation_id, manager_id, status)
         VALUES ($1, $2, 'Proj', $3, $4, $5, $6, $7) RETURNING id`,
        [
          `PJ-${run}-${name}`,
          name,
          `${name}-${run}@proj.test`,
          ids.dept,
          ids.desig,
          options.managerId ?? null,
          options.status ?? 'active',
        ],
      )
    ).rows[0]?.id as string;
    if (options.role) {
      const user = await outer.query<{ id: string }>(
        `INSERT INTO users (employee_id, email, password_hash, is_active) VALUES ($1, $2, 'x', $3) RETURNING id`,
        [id, `${name}-${run}@proj.test`, options.userActive ?? true],
      );
      await outer.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE key = $2`,
        [user.rows[0]?.id, options.role],
      );
    }
    return id;
  };
  const project = async (code: string, owner: string, name = `Project ${code}`, extra = 'active') =>
    (
      await outer.query<{ id: string }>(
        `INSERT INTO projects (code, name, owner_employee_id, status) VALUES ($1, $2, $3, $4) RETURNING id`,
        [`${code}-${run}`.toUpperCase(), name, owner, extra],
      )
    ).rows[0]?.id as string;
  const join = (projectId: string, employeeId: string) =>
    outer.query(`INSERT INTO project_members (project_id, employee_id) VALUES ($1, $2)`, [
      projectId,
      employeeId,
    ]);
  const refused = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    repo = new PgProjectsRepository(() => nested(outer));
    service = new ProjectsService(repo, platform);
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Proj ${run}`, `PJ-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `PJ-${run}`],
      )
    ).rows[0]?.id as string;
    ids.lead = await employee('lead', { role: 'team_lead' });
    ids.other = await employee('other', { role: 'team_lead' });
    ids.admin = await employee('admin', { role: 'admin' });
    ids.amy = await employee('amy', { role: 'staff', managerId: ids.lead });
    ids.ben = await employee('ben', { role: 'staff', managerId: ids.lead });
    ids.cat = await employee('cat', { role: 'staff', managerId: ids.other });
    ids.gone = await employee('gone', { managerId: ids.lead, status: 'deactivated' });
    ids.offLead = await employee('offlead', { role: 'team_lead', userActive: false });
    ids.staffRole = ids.amy;
    caller.employeeId = ids.lead;
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

  describe('the migration', () => {
    it('refuses a malformed code, a duplicate code, an unknown status and dates out of order', async () => {
      const insert = (
        code: string,
        status = 'active',
        start: string | null = null,
        end: string | null = null,
      ) =>
        refused(
          `INSERT INTO projects (code, name, owner_employee_id, status, start_date, end_date) VALUES ($1, 'n', $2, $3, $4, $5)`,
          [code, ids.lead, status, start, end],
        );
      expect(await insert('lower')).toBe('23514');
      expect(await insert('1ABC')).toBe('23514');
      expect(await insert('A')).toBe('23514');
      expect(await insert('OK-1', 'paused')).toBe('23514');
      expect(await insert('OK-2', 'active', '2026-12-01', '2026-11-01')).toBe('23514');
      expect(await insert('OK-3', 'active', '2026-11-01', '2026-11-01')).toBeNull();
      await project('DUP', ids.lead as string);
      expect(await insert(`DUP-${run}`.toUpperCase())).toBe('23505');
    });

    it('allows a member once per project, and takes members with the project', async () => {
      const id = await project('MEM', ids.lead as string);
      await join(id, ids.amy as string);
      expect(
        await refused(`INSERT INTO project_members (project_id, employee_id) VALUES ($1, $2)`, [
          id,
          ids.amy,
        ]),
      ).toBe('23505');
      await outer.query(`DELETE FROM projects WHERE id = $1`, [id]);
      const left = await outer.query(`SELECT 1 FROM project_members WHERE project_id = $1`, [id]);
      expect(left.rowCount).toBe(0);
    });
  });

  describe('visibility', () => {
    it('shows a project to its owner, its members and an Admin, and to nobody else', async () => {
      const id = await project('VIS', ids.lead as string);
      await join(id, ids.lead as string);
      await join(id, ids.amy as string);
      const sees = async (employeeId: string) =>
        (await repo.findDetail(id, { kind: 'own', employeeId })) !== null;
      expect(await sees(ids.lead as string)).toBe(true);
      expect(await sees(ids.amy as string)).toBe(true);
      expect(await sees(ids.ben as string)).toBe(false);
      expect(await sees(ids.other as string)).toBe(false);
      expect(await repo.findDetail(id, ALL)).not.toBeNull();
      expect(await repo.findDetail(id, { kind: 'team', managerId: ids.lead as string })).toBeNull();
      expect(await repo.findDetail(id, { kind: 'none' })).toBeNull();
    });

    it('sees a project it owns even without a member row', async () => {
      const id = await project('OWN', ids.lead as string);
      expect(
        await repo.findDetail(id, { kind: 'own', employeeId: ids.lead as string }),
      ).not.toBeNull();
    });

    it('lists only what is visible, with the member count, and filters by status and text', async () => {
      const mine = await project('MINE', ids.lead as string, 'Website relaunch');
      await join(mine, ids.lead as string);
      await join(mine, ids.amy as string);
      const theirs = await project('THEIRS', ids.other as string, 'Payroll audit');
      await join(theirs, ids.cat as string);
      const old = await project('OLD', ids.lead as string, 'Old site', 'archived');
      await join(old, ids.lead as string);
      const page = { offset: 0, limit: 50 };
      const asLead = await repo.list({
        ...page,
        filter: { kind: 'own', employeeId: ids.lead as string },
      });
      const codes = asLead.items.map((p) => p.code);
      expect(codes).toEqual(
        expect.arrayContaining([`MINE-${run}`.toUpperCase(), `OLD-${run}`.toUpperCase()]),
      );
      expect(codes).not.toContain(`THEIRS-${run}`.toUpperCase());
      expect(asLead.items.find((p) => p.id === mine)?.memberCount).toBe(2);
      const archived = await repo.list({
        ...page,
        filter: { kind: 'own', employeeId: ids.lead as string },
        status: 'archived',
      });
      expect(archived.items.map((p) => p.id)).toEqual([old]);
      const byName = await repo.list({ ...page, filter: ALL, q: 'payroll' });
      expect(byName.items.map((p) => p.id)).toContain(theirs);
      expect(byName.items.map((p) => p.id)).not.toContain(mine);
      const paged = await repo.list({
        offset: 0,
        limit: 1,
        filter: { kind: 'own', employeeId: ids.lead as string },
      });
      expect(paged.items).toHaveLength(1);
      expect(paged.total).toBe(asLead.total);
    });

    it('treats % and _ in a search as plain characters', async () => {
      const id = await project('PCT', ids.lead as string, '100% done');
      await project('OTHER', ids.lead as string, 'Something else');
      const found = await repo.list({ offset: 0, limit: 50, filter: ALL, q: '100%' });
      expect(found.items.map((p) => p.id)).toEqual([id]);
      const underscore = await repo.list({ offset: 0, limit: 50, filter: ALL, q: '_' });
      expect(underscore.items.every((p) => /_/.test(`${p.name}${p.code}`))).toBe(true);
    });

    it('lists members by name with their joining time', async () => {
      const id = await project('ORD', ids.lead as string);
      await join(id, ids.ben as string);
      await join(id, ids.amy as string);
      const detail = await repo.findDetail(id, ALL);
      expect(detail?.members.map((m) => m.name)).toEqual(['amy Proj', 'ben Proj']);
    });
  });

  describe('eligibility', () => {
    it('lets an active Team Lead or Admin own a project, and nobody else', async () => {
      const check = (employeeId: string) => repo.isEligibleOwner(outer, employeeId);
      expect(await check(ids.lead as string)).toBe(true);
      expect(await check(ids.admin as string)).toBe(true);
      expect(await check(ids.amy as string)).toBe(false); // staff
      expect(await check(ids.offLead as string)).toBe(false); // account switched off
      expect(await check(ids.gone as string)).toBe(false); // deactivated
      expect(await check(randomUUID())).toBe(false);
    });

    it('lets the owner and their active direct reports be members, and nobody else', async () => {
      const bad = await repo.ineligibleMembers(outer, ids.lead as string, [
        ids.lead as string,
        ids.amy as string,
        ids.cat as string, // another lead's report
        ids.gone as string, // deactivated
        ids.admin as string, // not a report
        '88000000-0000-4000-8000-000000000001', // does not exist
      ]);
      expect(bad.sort()).toEqual(
        [ids.cat, ids.gone, ids.admin, '88000000-0000-4000-8000-000000000001'].sort(),
      );
      expect(await repo.ineligibleMembers(outer, ids.lead as string, [])).toEqual([]);
    });
  });

  describe('through the service', () => {
    it('creates a project with its owner and members, and bumps the version on every change', async () => {
      const made = await service.create(
        {
          code: `SVC-${run}`.toUpperCase(),
          name: 'Service made',
          memberIds: [ids.amy as string, ids.ben as string],
        },
        caller,
        { kind: 'team', managerId: ids.lead as string },
      );
      expect(made).toMatchObject({ ownerEmployeeId: ids.lead, memberCount: 3, version: 1 });
      const lead = { kind: 'own', employeeId: ids.lead as string } as const;
      const team = { kind: 'team', managerId: ids.lead as string } as const;
      const renamed = await service.update(
        made.id,
        { name: 'Renamed', version: 1 },
        caller,
        lead,
        team,
      );
      expect(renamed.version).toBe(2);
      await expect(
        service.update(made.id, { name: 'Again', version: 1 }, caller, lead, team),
      ).rejects.toMatchObject({ statusCode: 409 });
      const archived = await service.update(
        made.id,
        { status: 'archived', version: 2 },
        caller,
        lead,
        team,
      );
      expect(archived.status).toBe('archived');
      await expect(
        service.addMember(made.id, ids.cat as string, caller, lead, team),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('refuses a duplicate code with a 409 and leaves nothing half made', async () => {
      await service.create({ code: `DUP-${run}`.toUpperCase(), name: 'First' }, caller, ALL);
      await expect(
        service.create(
          { code: `DUP-${run}`.toUpperCase(), name: 'Second', memberIds: [ids.amy as string] },
          caller,
          ALL,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const left = await repo.list({ offset: 0, limit: 50, filter: ALL, q: `DUP-${run}` });
      expect(left.total).toBe(1);
    });

    it('tells other modules who can work on a project', async () => {
      const id = await project('ACC', ids.lead as string);
      await join(id, ids.lead as string);
      await join(id, ids.amy as string);
      const access = await service.access(id);
      expect(access?.status).toBe('active');
      expect(access?.ownerEmployeeId).toBe(ids.lead);
      expect(access?.memberEmployeeIds.sort()).toEqual([ids.lead, ids.amy].sort());
      expect(await service.access(randomUUID())).toBeNull();
    });
  });
});
