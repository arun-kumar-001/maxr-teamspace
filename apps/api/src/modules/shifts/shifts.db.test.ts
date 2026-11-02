import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { PgShiftsRepository } from './shifts.repository';
import { ShiftsService } from './shifts.service';

const GENERAL = '70000000-0000-4000-8000-000000000001';
const POLICY = '70000000-0000-4000-8000-000000000002';
const caller = { actorId: randomUUID(), employeeId: randomUUID(), requestId: 'req' };
const ALL = { kind: 'all' } as const;

/**
 * Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). The
 * repository's own transaction becomes a savepoint, so a refused assignment can still be shown to
 * leave the previous one as it was.
 */
describe('shifts and attendance policy against PostgreSQL', () => {
  let outer: PoolClient;
  let service: ShiftsService;
  let timezone = 'Asia/Kolkata';
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT shifts_tx',
      COMMIT: 'RELEASE SAVEPOINT shifts_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT shifts_tx',
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
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    service = new ShiftsService(new PgShiftsRepository(() => nested(outer)), platform, {
      getBasic: async () =>
        ({
          companyName: 'T',
          timezone,
          workWeek: { start: 'Monday', end: 'Friday', days: [] },
        }) as never,
    });
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Shifts ${run}`, `SH-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `SH-${run}`],
      )
    ).rows[0]?.id as string;
    for (const name of ['amy', 'ben']) {
      ids[name] = (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
           VALUES ($1, $2, 'Shift', $3, $4, $5) RETURNING id`,
          [`SH-${run}-${name}`, name, `${name}-${run}@shift.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id as string;
    }
  });

  beforeEach(async () => {
    timezone = 'Asia/Kolkata';
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

  const insertAssignment = (employee: string, from: string, to: string | null) =>
    outer.query(
      `INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to) VALUES ($1, $2, $3, $4)`,
      [employee, GENERAL, from, to],
    );
  const refused = async (sql: string, values: unknown[] = []) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  describe('the migration', () => {
    it('seeds the General shift of decision D-13 and the policy', async () => {
      const shift = await service.getShift(GENERAL);
      expect(shift).toMatchObject({
        code: 'GENERAL',
        startTime: '09:00',
        endTime: '18:00',
        graceMinutes: 15,
        crossesMidnight: false,
        isActive: true,
      });
      expect(await service.getPolicy()).toMatchObject({
        fullDayMinutes: 480,
        halfDayMinutes: 240,
        defaultShift: { id: GENERAL },
        timezone: 'Asia/Kolkata',
      });
    });

    it('computes whether a shift runs past midnight in the database', async () => {
      const created = await service.createShift(
        { code: `N-${run}`, name: 'Night', startTime: '22:00', endTime: '06:00', graceMinutes: 10 },
        caller,
      );
      expect(created.crossesMidnight).toBe(true);
      const short = await service.updateShift(
        created.id,
        { startTime: '01:00', endTime: '05:00' },
        caller,
      );
      expect(short.crossesMidnight).toBe(false);
    });

    it.each([
      [
        'a shift that starts and ends together',
        `INSERT INTO shifts (code, name, start_time, end_time) VALUES ('X1', 'x', '10:00', '10:00')`,
        '23514',
      ],
      [
        'grace over 240',
        `INSERT INTO shifts (code, name, start_time, end_time, grace_minutes) VALUES ('X2', 'x', '09:00', '17:00', 241)`,
        '23514',
      ],
      [
        'a repeated code in another letter case',
        `INSERT INTO shifts (code, name, start_time, end_time) VALUES ('general', 'x', '09:00', '17:00')`,
        '23505',
      ],
      [
        'an assignment ending before it starts',
        `INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to) VALUES ('${randomUUID()}', '${GENERAL}', '2026-03-10', '2026-03-01')`,
        '23514',
      ],
      [
        'a half day as long as a full day',
        `UPDATE attendance_policies SET half_day_minutes = full_day_minutes`,
        '23514',
      ],
      [
        'a second policy row',
        `INSERT INTO attendance_policies (id, default_shift_id) VALUES (gen_random_uuid(), '${GENERAL}')`,
        '23514',
      ],
      ['deleting the default shift', `DELETE FROM shifts WHERE id = '${GENERAL}'`, '23503'],
    ])('the database refuses %s', async (_name, sql, code) => {
      expect(await refused(sql)).toBe(code);
    });
  });

  describe('overlapping assignments are impossible', () => {
    it.each([
      ['an overlapping range', ['2026-01-01', '2026-03-31'], ['2026-03-15', '2026-04-15']],
      ['a range inside it', ['2026-01-01', '2026-03-31'], ['2026-02-01', '2026-02-10']],
      ['a range around it', ['2026-02-01', '2026-02-10'], ['2026-01-01', '2026-03-31']],
      ['the same single day', ['2026-03-01', '2026-03-01'], ['2026-03-01', '2026-03-01']],
      [
        'an open-ended range over a bounded one',
        ['2026-02-01', '2026-02-10'],
        ['2026-01-01', null],
      ],
      [
        'a bounded range inside an open-ended one',
        ['2026-01-01', null],
        ['2026-02-01', '2026-02-10'],
      ],
      ['two open-ended ranges', ['2026-01-01', null], ['2026-06-01', null]],
    ])('the database refuses %s', async (_name, first, second) => {
      await insertAssignment(ids.amy as string, first[0] as string, first[1] as string | null);
      const code = await refused(
        `INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to) VALUES ($1, $2, $3, $4)`,
        [ids.amy, GENERAL, second[0], second[1]],
      );
      expect(code).toBe('23P01');
    });

    it('allows the day after, and the same dates for another employee', async () => {
      await insertAssignment(ids.amy as string, '2026-01-01', '2026-03-31');
      await insertAssignment(ids.amy as string, '2026-04-01', null);
      await insertAssignment(ids.ben as string, '2026-01-01', '2026-03-31');
      const n = await outer.query(
        `SELECT 1 FROM employee_shifts WHERE employee_id = ANY($1::uuid[])`,
        [[ids.amy, ids.ben]],
      );
      expect(n.rowCount).toBe(3);
    });
  });

  describe('assigning through the service', () => {
    const assign = (
      employeeId: string,
      from: string,
      to: string | null = null,
      shiftId = GENERAL,
    ) => service.assign({ employeeId, shiftId, effectiveFrom: from, effectiveTo: to }, caller);

    it('ends the current open-ended assignment the day before the new one', async () => {
      const night = await service.createShift(
        {
          code: `NI-${run}`,
          name: 'Night',
          startTime: '22:00',
          endTime: '06:00',
          graceMinutes: 10,
        },
        caller,
      );
      await assign(ids.amy as string, '2026-01-01');
      await assign(ids.amy as string, '2026-03-01', null, night.id);
      const list = await service.listAssignments(ids.amy as string, ALL, caller);
      expect(
        list.map((a) => [
          a.shift.id === night.id ? 'night' : 'general',
          a.effectiveFrom,
          a.effectiveTo,
        ]),
      ).toEqual([
        ['night', '2026-03-01', null],
        ['general', '2026-01-01', '2026-02-28'],
      ]);
    });

    it('a refused overlap leaves the earlier assignment exactly as it was', async () => {
      await assign(ids.amy as string, '2026-01-01', '2026-03-31');
      await expect(assign(ids.amy as string, '2026-03-15', '2026-04-15')).rejects.toMatchObject({
        statusCode: 409,
      });
      const list = await service.listAssignments(ids.amy as string, ALL, caller);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31' });
    });

    it('resolves the shift on the first day, the last day and outside the range', async () => {
      const night = await service.createShift(
        {
          code: `NR-${run}`,
          name: 'Night',
          startTime: '22:00',
          endTime: '06:00',
          graceMinutes: 10,
        },
        caller,
      );
      await assign(ids.amy as string, '2026-03-01', '2026-03-31', night.id);
      const code = async (d: string) => (await service.shiftOn(ids.amy as string, d)).code;
      expect(await code('2026-02-28')).toBe('GENERAL');
      expect(await code('2026-03-01')).toBe(`NR-${run}`);
      expect(await code('2026-03-31')).toBe(`NR-${run}`);
      expect(await code('2026-04-01')).toBe('GENERAL');
    });

    it('refuses a deactivated employee and an unknown one', async () => {
      await outer.query(`UPDATE employees SET status = 'deactivated' WHERE id = $1`, [ids.ben]);
      await expect(assign(ids.ben as string, '2026-03-01')).rejects.toMatchObject({
        statusCode: 422,
      });
      await expect(assign(randomUUID(), '2026-03-01')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('lets a Team Lead read their report and nobody else, in SQL', async () => {
      await outer.query(`UPDATE employees SET manager_id = $2 WHERE id = $1`, [ids.amy, ids.ben]);
      const team = { kind: 'team', managerId: ids.ben as string } as const;
      const lead = { ...caller, employeeId: ids.ben as string };
      await expect(service.listAssignments(ids.amy as string, team, lead)).resolves.toEqual([]);
      await expect(service.listAssignments(ids.ben as string, team, lead)).resolves.toEqual([]);
      await expect(
        service.listAssignments(
          ids.amy as string,
          { kind: 'team', managerId: randomUUID() },
          caller,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deactivating a shift', () => {
    it('is refused while the default, or while an assignment is in force; allowed after it ended', async () => {
      await expect(service.updateShift(GENERAL, { isActive: false }, caller)).rejects.toMatchObject(
        { statusCode: 422 },
      );
      const s = await service.createShift(
        { code: `DE-${run}`, name: 'Short', startTime: '08:00', endTime: '12:00', graceMinutes: 5 },
        caller,
      );
      await service.assign(
        {
          employeeId: ids.amy as string,
          shiftId: s.id,
          effectiveFrom: '2099-01-01',
          effectiveTo: null,
        },
        caller,
      );
      await expect(service.updateShift(s.id, { isActive: false }, caller)).rejects.toMatchObject({
        statusCode: 422,
      });

      const t = await service.createShift(
        { code: `DF-${run}`, name: 'Past', startTime: '08:00', endTime: '12:00', graceMinutes: 5 },
        caller,
      );
      await service.assign(
        {
          employeeId: ids.ben as string,
          shiftId: t.id,
          effectiveFrom: '2020-01-01',
          effectiveTo: '2020-12-31',
        },
        caller,
      );
      expect((await service.updateShift(t.id, { isActive: false }, caller)).isActive).toBe(false);
    });
  });

  describe('the policy', () => {
    it('changes in the database and reports the new values', async () => {
      const p = await service.updatePolicy({ fullDayMinutes: 540, halfDayMinutes: 270 }, caller);
      expect(p).toMatchObject({ fullDayMinutes: 540, halfDayMinutes: 270 });
      const row = await outer.query<{ full_day_minutes: number }>(
        `SELECT full_day_minutes FROM attendance_policies WHERE id = $1`,
        [POLICY],
      );
      expect(row.rows[0]?.full_day_minutes).toBe(540);
    });

    it('refuses a half day that is not shorter than the full day, and an inactive default', async () => {
      await expect(service.updatePolicy({ halfDayMinutes: 480 }, caller)).rejects.toMatchObject({
        statusCode: 422,
      });
      const s = await service.createShift(
        { code: `PO-${run}`, name: 'Off', startTime: '08:00', endTime: '12:00', graceMinutes: 5 },
        caller,
      );
      await service.updateShift(s.id, { isActive: false }, caller);
      await expect(service.updatePolicy({ defaultShiftId: s.id }, caller)).rejects.toMatchObject({
        statusCode: 422,
      });
    });
  });
});
