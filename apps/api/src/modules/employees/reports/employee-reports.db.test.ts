import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../../db/client';
import { makeApp } from '../../../test/helpers';
import { ReportRegistry } from '../../reports';
import { ScopeFilter } from '../../rbac';
import { signInAs } from '../../rbac/rbac.testing';
import type { BasicSettings } from '../../settings';
import {
  directoryReport,
  headcountReport,
  joinersLeaversReport,
  registerEmployeeReports,
} from './employee-reports';

/**
 * Real PostgreSQL inside one transaction that is rolled back: the reports run their queries on
 * the test's own connection, so everything they see is the data created here.
 */
describe('employee reports against PostgreSQL', () => {
  let outer: PoolClient;
  let timezone = 'Asia/Kolkata';
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const pool = () => ({ query: outer.query.bind(outer) }) as unknown as Pool;
  const settings = {
    getBasic: async () => ({ companyName: 'Test', timezone }) as unknown as BasicSettings,
  };
  const deps = () => ({ getPool: pool, settings });
  const ALL: ScopeFilter = { kind: 'all' };

  const add = async (
    name: string,
    dept: string,
    desig: string,
    options: {
      manager?: string;
      status?: string;
      joined?: string;
      deactivatedAt?: string;
      phone?: string;
    } = {},
  ) => {
    const res = await outer.query<{ id: string }>(
      `INSERT INTO employees (employee_code, first_name, last_name, email, phone, department_id,
                              designation_id, manager_id, status, joining_date)
       VALUES ($1, $2, 'Reports', $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        `RP-${run}-${name}`,
        name,
        `${name}-${run}@reports.test`,
        options.phone ?? null,
        dept,
        desig,
        options.manager ?? null,
        options.status ?? 'active',
        options.joined ?? '2026-01-15',
      ],
    );
    ids[name] = res.rows[0]?.id ?? '';
    if (options.deactivatedAt) {
      await outer.query(`UPDATE employees SET deactivated_at = $2 WHERE id = $1`, [
        ids[name],
        options.deactivatedAt,
      ]);
    }
  };

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const dept = async (code: string) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
          [`Reports ${code} ${run}`, `RP-${run}-${code}`],
        )
      ).rows[0]?.id ?? '';
    const desig = async (department: string, code: string) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title, code) VALUES ($1, $2, $3) RETURNING id`,
          [department, `Title ${code}`, `RP-${run}-${code}`],
        )
      ).rows[0]?.id ?? '';
    ids.deptA = await dept('A');
    ids.deptB = await dept('B');
    ids.desigA1 = await desig(ids.deptA, 'A1');
    ids.desigA2 = await desig(ids.deptA, 'A2');
    ids.desigB1 = await desig(ids.deptB, 'B1');

    await add('lead', ids.deptA, ids.desigA1, { joined: '2026-01-10' });
    await add('amy', ids.deptA, ids.desigA1, {
      manager: ids.lead,
      joined: '2026-03-01',
      phone: '+91 90000 00001',
    });
    await add('ben', ids.deptA, ids.desigA2, {
      manager: ids.lead,
      status: 'pending',
      joined: '2026-03-15',
    });
    await add('cara', ids.deptA, ids.desigA2, {
      status: 'deactivated',
      joined: '2025-06-01',
      deactivatedAt: '2026-03-10T10:00:00Z',
    });
    // 19:00 UTC on 31 Oct is 00:30 on 1 Nov in Asia/Kolkata.
    await add('dev', ids.deptB, ids.desigB1, {
      manager: ids.lead,
      status: 'deactivated',
      joined: '2025-01-01',
      deactivatedAt: '2026-10-31T19:00:00Z',
    });
    await add('eve', ids.deptB, ids.desigB1, { joined: '2026-03-20' });
  });

  // Each test runs in its own savepoint: a failed query or a changed row never leaks into the next.
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

  const team = (managerId: string): ScopeFilter => ({ kind: 'team', managerId });

  describe('employee-headcount', () => {
    const report = () => headcountReport(deps());
    const filters = (extra: Record<string, unknown> = {}) =>
      report().filters.parse({ departmentId: ids.deptA, ...extra });

    it('counts per department with each status and a total', async () => {
      const res = await report().run({ filters: filters(), scope: ALL, offset: 0, limit: 50 });
      expect(res.total).toBe(1);
      expect(res.rows).toEqual([
        { group: `Reports A ${run}`, active: 2, pending: 1, deactivated: 1, total: 4 },
      ]);
    });

    it('counts per designation, paged by group', async () => {
      const f = filters({ groupBy: 'designation' });
      const page1 = await report().run({ filters: f, scope: ALL, offset: 0, limit: 1 });
      const page2 = await report().run({ filters: f, scope: ALL, offset: 1, limit: 1 });
      expect(page1.total).toBe(2);
      expect(page1.rows).toEqual([
        { group: `Title A1 (Reports A ${run})`, active: 2, pending: 0, deactivated: 0, total: 2 },
      ]);
      expect(page2.rows).toEqual([
        { group: `Title A2 (Reports A ${run})`, active: 0, pending: 1, deactivated: 1, total: 2 },
      ]);
    });

    it('applies the record scope inside the query', async () => {
      const f = report().filters.parse({});
      const res = await report().run({
        filters: f,
        scope: team(ids.lead as string),
        offset: 0,
        limit: 50,
      });
      // lead's direct reports: amy, ben (dept A) and dev (dept B); the lead and the others are out.
      expect(res.rows.map((r) => [r.active, r.pending, r.deactivated, r.total])).toEqual([
        [1, 1, 0, 2],
        [0, 0, 1, 1],
      ]);
      expect(res.total).toBe(2);
      const none = await report().run({
        filters: f,
        scope: { kind: 'none' },
        offset: 0,
        limit: 50,
      });
      expect(none).toEqual({ rows: [], total: 0 });
    });

    it('rejects an unknown filter and a bad grouping', () => {
      expect(() => report().filters.parse({ groupBy: 'manager' })).toThrow();
      expect(() => report().filters.parse({ bogus: 1 })).toThrow();
    });
  });

  describe('joiners-leavers', () => {
    const report = () => joinersLeaversReport(deps());
    const q = (extra: Record<string, unknown> = {}) =>
      report().filters.parse({
        from: '2026-03-01',
        to: '2026-03-31',
        departmentId: ids.deptA,
        ...extra,
      });
    const names = (rows: Array<Record<string, unknown>>) =>
      rows.map((r) => `${r.date} ${r.event} ${String(r.employeeName).split(' ')[0]}`);

    it('lists joiners and leavers in the range, ordered by date', async () => {
      const res = await report().run({ filters: q(), scope: ALL, offset: 0, limit: 50 });
      expect(names(res.rows)).toEqual([
        '2026-03-01 joined amy',
        '2026-03-10 left cara',
        '2026-03-15 joined ben',
      ]);
      expect(res.total).toBe(3);
      expect(res.rows[0]).toMatchObject({
        department: `Reports A ${run}`,
        designation: 'Title A1',
      });
    });

    it('filters by event', async () => {
      const joined = await report().run({
        filters: q({ event: 'joined' }),
        scope: ALL,
        offset: 0,
        limit: 50,
      });
      expect(joined.rows.every((r) => r.event === 'joined')).toBe(true);
      const left = await report().run({
        filters: q({ event: 'left' }),
        scope: ALL,
        offset: 0,
        limit: 50,
      });
      expect(names(left.rows)).toEqual(['2026-03-10 left cara']);
    });

    it('puts a leaver on the calendar day of the company timezone', async () => {
      const range = {
        from: '2026-10-31',
        to: '2026-11-01',
        departmentId: ids.deptB,
        event: 'left',
      };
      timezone = 'Asia/Kolkata';
      const ist = await report().run({
        filters: report().filters.parse(range),
        scope: ALL,
        offset: 0,
        limit: 50,
      });
      expect(names(ist.rows)).toEqual(['2026-11-01 left dev']);
      timezone = 'UTC';
      const utc = await report().run({
        filters: report().filters.parse(range),
        scope: ALL,
        offset: 0,
        limit: 50,
      });
      expect(names(utc.rows)).toEqual(['2026-10-31 left dev']);
      timezone = 'Asia/Kolkata';
    });

    it('includes both end dates of the range', async () => {
      const f = report().filters.parse({
        from: '2026-03-01',
        to: '2026-03-01',
        departmentId: ids.deptA,
      });
      expect(
        names((await report().run({ filters: f, scope: ALL, offset: 0, limit: 50 })).rows),
      ).toEqual(['2026-03-01 joined amy']);
    });

    it('applies the record scope inside the query', async () => {
      const f = report().filters.parse({ from: '2026-01-01', to: '2026-12-31' });
      const res = await report().run({
        filters: f,
        scope: team(ids.lead as string),
        offset: 0,
        limit: 50,
      });
      const codes = res.rows.map((r) => r.employeeCode);
      expect(codes).toEqual(
        expect.arrayContaining([`RP-${run}-dev`, `RP-${run}-amy`, `RP-${run}-ben`]),
      );
      expect(codes).not.toContain(`RP-${run}-cara`);
      expect(codes).not.toContain(`RP-${run}-eve`);
      expect(res.rows.length).toBe(res.total);
    });

    it('pages without repeating rows', async () => {
      const f = q();
      const all = await report().run({ filters: f, scope: ALL, offset: 0, limit: 50 });
      const first = await report().run({ filters: f, scope: ALL, offset: 0, limit: 2 });
      const second = await report().run({ filters: f, scope: ALL, offset: 2, limit: 2 });
      expect([...first.rows, ...second.rows]).toEqual(all.rows);
    });

    it.each([
      ['from after to', { from: '2026-04-01', to: '2026-03-01' }],
      ['a range over a year', { from: '2025-01-01', to: '2026-12-31' }],
    ])('rejects %s with 400', async (_name, range) => {
      await expect(
        report().run({ filters: report().filters.parse(range), scope: ALL, offset: 0, limit: 50 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it.each([
      ['a missing from', { to: '2026-03-01' }],
      ['a date that does not exist', { from: '2026-02-30', to: '2026-03-01' }],
      ['the wrong format', { from: '01/03/2026', to: '2026-03-01' }],
    ])('refuses %s', (_name, bad) => {
      expect(() => report().filters.parse(bad)).toThrow();
    });
  });

  describe('employee-directory', () => {
    const report = () => directoryReport(deps());
    const f = (extra: Record<string, unknown> = {}) =>
      report().filters.parse({ departmentId: ids.deptA, ...extra });

    it('lists the directory with the manager name and only the declared columns', async () => {
      const res = await report().run({ filters: f(), scope: ALL, offset: 0, limit: 50 });
      expect(res.total).toBe(4);
      const amy = res.rows.find((r) => r.employeeCode === `RP-${run}-amy`);
      expect(amy).toEqual({
        employeeCode: `RP-${run}-amy`,
        employeeName: 'amy Reports',
        email: `amy-${run}@reports.test`,
        phone: '+91 90000 00001',
        department: `Reports A ${run}`,
        designation: 'Title A1',
        manager: 'lead Reports',
        status: 'active',
        joiningDate: '2026-03-01',
      });
      expect(Object.keys(amy ?? {})).toEqual(report().columns.map((c) => c.key));
      expect(res.rows.find((r) => r.employeeCode === `RP-${run}-lead`)?.manager).toBeNull();
    });

    it('filters by status, designation and manager', async () => {
      const codes = async (extra: Record<string, unknown>) =>
        (await report().run({ filters: f(extra), scope: ALL, offset: 0, limit: 50 })).rows.map(
          (r) => String(r.employeeCode).split('-').pop(),
        );
      expect(await codes({ status: 'pending' })).toEqual(['ben']);
      expect(await codes({ designationId: ids.desigA2 })).toEqual(['ben', 'cara']);
      expect(await codes({ managerId: ids.lead })).toEqual(['amy', 'ben']);
    });

    it('applies the record scope inside the query, and orders by name', async () => {
      const scoped = await report().run({
        filters: report().filters.parse({}),
        scope: team(ids.lead as string),
        offset: 0,
        limit: 50,
      });
      expect(scoped.rows.map((r) => String(r.employeeCode).split('-').pop())).toEqual([
        'amy',
        'ben',
        'dev',
      ]);
      expect(scoped.total).toBe(3);
    });
  });

  describe('deactivated_at', () => {
    const state = async (id: string) =>
      (
        await outer.query<{ status: string; deactivated_at: Date | null }>(
          `SELECT status, deactivated_at FROM employees WHERE id = $1`,
          [id],
        )
      ).rows[0];

    it('is set when an employee is deactivated and cleared when reactivated', async () => {
      expect((await state(ids.eve as string))?.deactivated_at).toBeNull();
      await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.eve]);
      expect((await state(ids.eve as string))?.deactivated_at).not.toBeNull();
      await outer.query(`UPDATE employees SET status = 'active' WHERE id = $1`, [ids.eve]);
      expect((await state(ids.eve as string))?.deactivated_at).toBeNull();
    });

    it('is set for an employee inserted as deactivated', async () => {
      await add('fay', ids.deptA as string, ids.desigA1 as string, { status: 'deactivated' });
      expect((await state(ids.fay as string))?.deactivated_at).not.toBeNull();
    });

    it('keeps the time of the first deactivation when other columns change', async () => {
      const before = (await state(ids.cara as string))?.deactivated_at?.toISOString();
      await outer.query(`UPDATE employees SET phone = '123456' WHERE id = $1`, [ids.cara]);
      expect((await state(ids.cara as string))?.deactivated_at?.toISOString()).toBe(before);
    });

    it('the database refuses a status and a deactivation time that disagree', async () => {
      await outer.query('SAVEPOINT mismatch');
      await expect(
        outer.query(`UPDATE employees SET deactivated_at = NULL WHERE id = $1`, [ids.cara]),
      ).rejects.toMatchObject({ code: '23514' });
      await outer.query('ROLLBACK TO SAVEPOINT mismatch');
    });
  });

  describe('through the API', () => {
    it('shows the three reports to Admin, HR Manager and Team Lead, never to Staff', async () => {
      const registry = new ReportRegistry();
      registerEmployeeReports(registry, deps());
      const { app, authKit } = makeApp({ reportRegistry: registry });
      const as = {
        admin: await signInAs(app, authKit, 'admin'),
        hr: await signInAs(app, authKit, 'hr_manager'),
        lead: await signInAs(app, authKit, 'team_lead'),
        staff: await signInAs(app, authKit, 'staff'),
      };
      for (const who of ['admin', 'hr', 'lead'] as const) {
        const list = await as[who].get('/api/v1/reports');
        expect(list.status).toBe(200);
        expect(list.body.data.map((r: { name: string }) => r.name)).toEqual([
          'employee-directory',
          'employee-headcount',
          'joiners-leavers',
        ]);
      }
      expect((await as.staff.get('/api/v1/reports/employee-directory')).status).toBe(403);

      const preview = await as.admin.get(
        `/api/v1/reports/employee-directory?departmentId=${ids.deptA}&pageSize=2`,
      );
      expect(preview.status).toBe(200);
      expect(preview.body.meta).toMatchObject({ total: 4, pageSize: 2 });

      const csv = await as.hr.get(
        `/api/v1/reports/employee-directory/export?departmentId=${ids.deptA}&format=csv`,
      );
      expect(csv.status).toBe(200);
      expect(csv.text).toContain(
        'Code,Employee,Email,Phone,Department,Designation,Manager,Status,Joining date',
      );

      const bad = await as.admin.get(
        '/api/v1/reports/joiners-leavers?from=2026-04-01&to=2026-03-01',
      );
      expect(bad.status).toBe(400);
    });
  });
});
