import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgAttendanceRepository } from './attendance.repository';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('attendance records: the time checks and the stored status', () => {
  let outer: PoolClient;
  let repo: PgAttendanceRepository;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    repo = new PgAttendanceRepository(
      () => ({ query: outer.query.bind(outer) }) as unknown as Pool,
    );
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Att ${run}`, `AT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Clerk', $2) RETURNING id`,
        [ids.dept, `AT-${run}`],
      )
    ).rows[0]?.id as string;
    ids.emp = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
         VALUES ($1, 'Att', 'Test', $2, $3, $4) RETURNING id`,
        [`AT-${run}-E`, `att-${run}@attendance.test`, ids.dept, ids.desig],
      )
    ).rows[0]?.id as string;
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

  const codeOf = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  it('stores the status the service decided', async () => {
    const late = await repo.createCheckIn(ids.emp as string, '2026-10-30', {}, undefined, 'late');
    expect(late.status).toBe('late');
    await repo.createCheckOut(late.id, new Date().toISOString(), 5);
    const present = await repo.createCheckIn(ids.emp as string, '2026-10-30', {});
    expect(present.status).toBe('present');
  });

  it('refuses a check-out before the check-in', async () => {
    expect(
      await codeOf(
        `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time)
         VALUES ($1, '2026-10-30', '2026-10-30T10:00:00Z', '2026-10-30T09:59:59Z')`,
        [ids.emp],
      ),
    ).toBe('23514');
  });

  it('refuses a check-out earlier than the check-in on an existing session', async () => {
    const open = await repo.createCheckIn(ids.emp as string, '2026-10-30', {});
    expect(
      await codeOf(
        `UPDATE attendance_records SET check_out_time = check_in_time - interval '1 minute' WHERE id = $1`,
        [open.id],
      ),
    ).toBe('23514');
  });

  it('refuses a negative duration', async () => {
    expect(
      await codeOf(
        `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, duration_minutes)
         VALUES ($1, '2026-10-30', '2026-10-30T10:00:00Z', '2026-10-30T11:00:00Z', -1)`,
        [ids.emp],
      ),
    ).toBe('23514');
  });

  it('allows a check-out at the same instant, a zero duration and a session spanning midnight', async () => {
    await outer.query(
      `INSERT INTO attendance_records (employee_id, work_date, check_in_time, check_out_time, duration_minutes)
       VALUES ($1, '2026-10-30', '2026-10-30T10:00:00Z', '2026-10-30T10:00:00Z', 0),
              ($1, '2026-10-30', '2026-10-30T18:20:00Z', '2026-10-30T18:50:00Z', 30)`,
      [ids.emp],
    );
    const n = await outer.query(`SELECT 1 FROM attendance_records WHERE employee_id = $1`, [
      ids.emp,
    ]);
    expect(n.rowCount).toBe(2);
  });
});
