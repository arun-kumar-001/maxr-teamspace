import type { Pool } from 'pg';
import { conflict, forbidden, notFound } from '../../http/errors';
import { SortSpec } from '../../http/pagination';
import { ScopeFilter, scopeToSql } from '../rbac/scope';
import {
  AttendanceLocation,
  AttendanceRecord,
  AttendanceStatus,
  CheckInDto,
} from './attendance.types';

export interface AttendanceFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface IAttendanceRepository {
  findActiveSession(employeeId: string): Promise<AttendanceRecord | null>;
  findTodaySessions(employeeId: string, workDate: string): Promise<AttendanceRecord[]>;
  createCheckIn(
    employeeId: string,
    workDate: string,
    dto: CheckInDto,
    checkInTime?: string,
    status?: AttendanceStatus,
  ): Promise<AttendanceRecord>;
  createCheckOut(
    sessionId: string,
    checkOutTime: string,
    durationMinutes: number,
    notes?: string,
  ): Promise<AttendanceRecord | null>;
  findMany(
    params: AttendanceFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: AttendanceRecord[]; total: number }>;
  findById(id: string, scope: ScopeFilter): Promise<AttendanceRecord | null>;
  isEmployeeActive(employeeId: string): Promise<boolean>;
}

interface AttendanceRow {
  id: string;
  employee_id: string;
  work_date: Date | string;
  check_in_time: Date | string;
  check_out_time: Date | string | null;
  duration_minutes: number | null;
  status: string;
  location: unknown;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function formatDate(val: Date | string): string {
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return typeof val === 'string' ? val.slice(0, 10) : String(val);
}

function formatIso(val: Date | string | null): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  return new Date(val).toISOString();
}

function toRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    workDate: formatDate(row.work_date),
    checkInTime: formatIso(row.check_in_time)!,
    checkOutTime: formatIso(row.check_out_time),
    durationMinutes: row.duration_minutes,
    status: row.status as AttendanceStatus,
    location: (row.location as AttendanceLocation) ?? null,
    notes: row.notes ?? null,
    createdAt: formatIso(row.created_at)!,
    updatedAt: formatIso(row.updated_at)!,
  };
}

const ATTENDANCE_SORT_COLUMNS: Record<string, string> = {
  workDate: 'a.work_date',
  checkInTime: 'a.check_in_time',
  checkOutTime: 'a.check_out_time',
  status: 'a.status',
  createdAt: 'a.created_at',
};

/**
 * PostgreSQL repository for attendance records.
 * Uses parameterised SQL, enforces the partial unique index guarantee (at most one open session per employee),
 * and delegates scoping directly to `scopeToSql(filter, 'a.employee_id', n)`.
 */
export class PgAttendanceRepository implements IAttendanceRepository {
  constructor(private readonly getPool: () => Pool) {}

  async isEmployeeActive(employeeId: string): Promise<boolean> {
    const res = await this.getPool().query<{ status: string }>(
      `SELECT status FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!res.rows[0]) return false;
    return res.rows[0].status === 'active';
  }

  async findActiveSession(employeeId: string): Promise<AttendanceRecord | null> {
    const res = await this.getPool().query<AttendanceRow>(
      `SELECT a.id, a.employee_id, a.work_date, a.check_in_time, a.check_out_time,
              a.duration_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
         FROM attendance_records a
        WHERE a.employee_id = $1 AND a.check_out_time IS NULL
        ORDER BY a.check_in_time DESC
        LIMIT 1`,
      [employeeId],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async findTodaySessions(employeeId: string, workDate: string): Promise<AttendanceRecord[]> {
    const res = await this.getPool().query<AttendanceRow>(
      `SELECT a.id, a.employee_id, a.work_date, a.check_in_time, a.check_out_time,
              a.duration_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
         FROM attendance_records a
        WHERE a.employee_id = $1 AND a.work_date = $2
        ORDER BY a.check_in_time ASC`,
      [employeeId, workDate],
    );
    return res.rows.map(toRecord);
  }

  async createCheckIn(
    employeeId: string,
    workDate: string,
    dto: CheckInDto,
    checkInTime?: string,
    status: AttendanceStatus = 'present',
  ): Promise<AttendanceRecord> {
    const active = await this.isEmployeeActive(employeeId);
    if (!active) {
      throw forbidden('Deactivated employee cannot perform attendance check-in');
    }

    try {
      const res = await this.getPool().query<AttendanceRow>(
        `INSERT INTO attendance_records (
           employee_id, work_date, check_in_time, check_out_time, duration_minutes, status, location, notes
         ) VALUES (
           $1, $2, COALESCE($3, NOW()), NULL, NULL, $6, $4, $5
         ) RETURNING id, employee_id, work_date, check_in_time, check_out_time, duration_minutes, status, location, notes, created_at, updated_at`,
        [
          employeeId,
          workDate,
          checkInTime ?? null,
          dto.location ? JSON.stringify(dto.location) : null,
          dto.notes ?? null,
          status,
        ],
      );
      return toRecord(res.rows[0]!);
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      if (pgErr.code === '23505') {
        throw conflict('An open attendance session already exists. Please check out first.');
      }
      if (pgErr.code === '23503') {
        throw notFound('Employee not found');
      }
      throw err;
    }
  }

  async createCheckOut(
    sessionId: string,
    checkOutTime: string,
    durationMinutes: number,
    notes?: string,
  ): Promise<AttendanceRecord | null> {
    const res = await this.getPool().query<AttendanceRow>(
      `UPDATE attendance_records
          SET check_out_time = $2,
              duration_minutes = $3,
              notes = COALESCE($4, notes),
              updated_at = NOW()
        WHERE id = $1 AND check_out_time IS NULL
        RETURNING id, employee_id, work_date, check_in_time, check_out_time, duration_minutes, status, location, notes, created_at, updated_at`,
      [sessionId, checkOutTime, durationMinutes, notes ?? null],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async findMany(
    params: AttendanceFindManyParams,
    scope: ScopeFilter,
  ): Promise<{ items: AttendanceRecord[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.employeeId) {
      conditions.push(`a.employee_id = $${paramIndex++}`);
      values.push(params.employeeId);
    }
    if (params.startDate) {
      conditions.push(`a.work_date >= $${paramIndex++}`);
      values.push(params.startDate);
    }
    if (params.endDate) {
      conditions.push(`a.work_date <= $${paramIndex++}`);
      values.push(params.endDate);
    }
    if (params.status) {
      conditions.push(`a.status = $${paramIndex++}`);
      values.push(params.status);
    }

    const { clause: scopeClause, values: scopeValues } = scopeToSql(
      scope,
      'a.employee_id',
      paramIndex,
    );
    conditions.push(scopeClause);
    for (const v of scopeValues) {
      values.push(v);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM attendance_records a ${whereClause}`,
      values,
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const sortCol = ATTENDANCE_SORT_COLUMNS[params.sort.column] ?? 'a.work_date';
    const sortDir = params.sort.order === 'asc' ? 'ASC' : 'DESC';

    const limitParam = paramIndex++;
    const offsetParam = paramIndex++;
    const queryValues = [...values, params.limit, params.offset];

    const itemsRes = await this.getPool().query<AttendanceRow>(
      `SELECT a.id, a.employee_id, a.work_date, a.check_in_time, a.check_out_time,
              a.duration_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
         FROM attendance_records a
        ${whereClause}
        ORDER BY ${sortCol} ${sortDir}, a.check_in_time ${sortDir}
        LIMIT $${limitParam} OFFSET $${offsetParam}`,
      queryValues,
    );

    return {
      items: itemsRes.rows.map(toRecord),
      total,
    };
  }

  async findById(id: string, scope: ScopeFilter): Promise<AttendanceRecord | null> {
    const { clause: scopeClause, values: scopeValues } = scopeToSql(scope, 'a.employee_id', 2);
    const res = await this.getPool().query<AttendanceRow>(
      `SELECT a.id, a.employee_id, a.work_date, a.check_in_time, a.check_out_time,
              a.duration_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
         FROM attendance_records a
        WHERE a.id = $1 AND ${scopeClause}`,
      [id, ...scopeValues],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }
}
