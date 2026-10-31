import type { Pool, PoolClient } from 'pg';
import { conflict } from '../../../http/errors';
import { ScopeFilter, scopeToSql } from '../../rbac';
import {
  AttendanceCorrection,
  CorrectableRecord,
  CorrectionStatus,
  CorrectionTx,
  NewCorrection,
  RecordTimes,
} from './corrections.types';

export interface FindCorrectionsParams {
  filter: ScopeFilter;
  status?: CorrectionStatus;
  offset: number;
  limit: number;
}

export interface ICorrectionsRepository {
  transaction<T>(work: (tx: CorrectionTx) => Promise<T>): Promise<T>;
  /** Locks the attendance record until the transaction ends. */
  lockRecord(tx: CorrectionTx, recordId: string): Promise<CorrectableRecord | null>;
  /** True when another session of the employee overlaps the interval (an open session counts as running on). */
  hasOverlap(
    tx: CorrectionTx,
    employeeId: string,
    excludeRecordId: string,
    from: string,
    to: string,
  ): Promise<boolean>;
  /** Throws a 409 when the record already has a pending correction. */
  insert(tx: CorrectionTx, input: NewCorrection): Promise<AttendanceCorrection>;
  findForUpdate(tx: CorrectionTx, id: string): Promise<AttendanceCorrection | null>;
  /** One correction, only when its employee is inside `filter`. */
  find(id: string, filter: ScopeFilter): Promise<AttendanceCorrection | null>;
  setStatus(tx: CorrectionTx, id: string, status: CorrectionStatus): Promise<void>;
  writeRecordTimes(tx: CorrectionTx, recordId: string, times: RecordTimes): Promise<void>;
  findMany(
    params: FindCorrectionsParams,
  ): Promise<{ items: AttendanceCorrection[]; total: number }>;
}

interface Row {
  id: string;
  attendance_record_id: string;
  employee_id: string;
  work_date: Date | string;
  original_check_in: Date;
  original_check_out: Date | null;
  requested_check_in: Date;
  requested_check_out: Date;
  reason: string;
  status: CorrectionStatus;
  approval_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const iso = (value: Date): string => value.toISOString();
const dateOnly = (value: Date | string): string =>
  typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);

const toCorrection = (row: Row): AttendanceCorrection => ({
  id: row.id,
  attendanceRecordId: row.attendance_record_id,
  employeeId: row.employee_id,
  workDate: dateOnly(row.work_date),
  originalCheckIn: iso(row.original_check_in),
  originalCheckOut: row.original_check_out ? iso(row.original_check_out) : null,
  requestedCheckIn: iso(row.requested_check_in),
  requestedCheckOut: iso(row.requested_check_out),
  reason: row.reason,
  status: row.status,
  approvalId: row.approval_id,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

// work_date is a DATE column: the pg driver would turn it into a local-midnight Date, so it is read as text.
const SELECT = `
  SELECT c.id, c.attendance_record_id, c.employee_id, a.work_date::text AS work_date,
         c.original_check_in, c.original_check_out, c.requested_check_in, c.requested_check_out,
         c.reason, c.status, c.created_at, c.updated_at,
         (SELECT p.id FROM approvals p
           WHERE p.subject_type = 'attendance_correction' AND p.subject_id = c.id) AS approval_id
    FROM attendance_corrections c
    JOIN attendance_records a ON a.id = c.attendance_record_id`;

export class PgCorrectionsRepository implements ICorrectionsRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: CorrectionTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async lockRecord(tx: CorrectionTx, recordId: string): Promise<CorrectableRecord | null> {
    const res = await tx.query<{
      id: string;
      employee_id: string;
      work_date: string;
      check_in_time: Date;
      check_out_time: Date | null;
      duration_minutes: number | null;
      status: string;
    }>(
      `SELECT id, employee_id, work_date::text AS work_date, check_in_time, check_out_time,
              duration_minutes, status
         FROM attendance_records WHERE id = $1 FOR UPDATE`,
      [recordId],
    );
    const row = res.rows[0];
    return row
      ? {
          id: row.id,
          employeeId: row.employee_id,
          workDate: row.work_date,
          checkIn: iso(row.check_in_time),
          checkOut: row.check_out_time ? iso(row.check_out_time) : null,
          durationMinutes: row.duration_minutes,
          status: row.status,
        }
      : null;
  }

  async hasOverlap(
    tx: CorrectionTx,
    employeeId: string,
    excludeRecordId: string,
    from: string,
    to: string,
  ): Promise<boolean> {
    const res = await tx.query(
      `SELECT 1 FROM attendance_records
        WHERE employee_id = $1 AND id <> $2
          AND tstzrange(check_in_time, COALESCE(check_out_time, 'infinity'::timestamptz))
              && tstzrange($3::timestamptz, $4::timestamptz)
        LIMIT 1`,
      [employeeId, excludeRecordId, from, to],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async insert(tx: CorrectionTx, input: NewCorrection): Promise<AttendanceCorrection> {
    // The savepoint keeps the outer transaction usable if the unique index refuses the row.
    await tx.query('SAVEPOINT insert_correction');
    try {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO attendance_corrections
           (attendance_record_id, employee_id, original_check_in, original_check_out,
            requested_check_in, requested_check_out, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          input.attendanceRecordId,
          input.employeeId,
          input.originalCheckIn,
          input.originalCheckOut,
          input.requestedCheckIn,
          input.requestedCheckOut,
          input.reason,
        ],
      );
      await tx.query('RELEASE SAVEPOINT insert_correction');
      const created = await this.findForUpdate(tx, (res.rows[0] as { id: string }).id);
      if (!created) throw new Error('A correction vanished inside its transaction');
      return created;
    } catch (err) {
      await tx.query('ROLLBACK TO SAVEPOINT insert_correction');
      if ((err as { code?: string }).code === '23505') {
        throw conflict('This attendance record already has a pending correction');
      }
      throw err;
    }
  }

  async findForUpdate(tx: CorrectionTx, id: string): Promise<AttendanceCorrection | null> {
    // FOR UPDATE cannot lock the outer-joined subselect, so the row is locked first and read after.
    const locked = await tx.query(`SELECT 1 FROM attendance_corrections WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    if (locked.rowCount === 0) return null;
    const res = await tx.query<Row>(`${SELECT} WHERE c.id = $1`, [id]);
    return res.rows[0] ? toCorrection(res.rows[0]) : null;
  }

  async find(id: string, filter: ScopeFilter): Promise<AttendanceCorrection | null> {
    const scope = scopeToSql(filter, 'c.employee_id', 2);
    const res = await this.getPool().query<Row>(`${SELECT} WHERE c.id = $1 AND ${scope.clause}`, [
      id,
      ...scope.values,
    ]);
    return res.rows[0] ? toCorrection(res.rows[0]) : null;
  }

  async setStatus(tx: CorrectionTx, id: string, status: CorrectionStatus): Promise<void> {
    await tx.query(
      `UPDATE attendance_corrections SET status = $2, updated_at = NOW() WHERE id = $1`,
      [id, status],
    );
  }

  async writeRecordTimes(tx: CorrectionTx, recordId: string, times: RecordTimes): Promise<void> {
    await tx.query(
      `UPDATE attendance_records
          SET check_in_time = $2, check_out_time = $3, duration_minutes = $4, status = $5,
              updated_at = NOW()
        WHERE id = $1`,
      [recordId, times.checkIn, times.checkOut, times.durationMinutes, times.status],
    );
  }

  async findMany(
    params: FindCorrectionsParams,
  ): Promise<{ items: AttendanceCorrection[]; total: number }> {
    const scope = scopeToSql(params.filter, 'c.employee_id', 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;
    if (params.status) {
      values.push(params.status);
      where += ` AND c.status = $${values.length}`;
    }
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM attendance_corrections c WHERE ${where}`,
      values,
    );
    values.push(params.limit, params.offset);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE ${where}
        ORDER BY c.created_at DESC, c.id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: res.rows.map(toCorrection), total: Number(total.rows[0]?.count ?? 0) };
  }
}
