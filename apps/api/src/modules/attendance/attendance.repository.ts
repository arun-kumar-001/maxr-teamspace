import type { Pool } from 'pg';
import { conflict, forbidden, notFound } from '../../http/errors';
import { SortSpec } from '../../http/pagination';
import { ScopeFilter, scopeToSql } from '../rbac/scope';
import {
  AttendanceBreak,
  AttendanceLocation,
  AttendanceRecord,
  AttendanceStatus,
  CheckInDto,
  TeamCalendarData,
  TeamCalendarDepartment,
  TeamCalendarEmployee,
  TeamCalendarEntry,
  TeamCalendarHoliday,
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
  updateBreaks(
    sessionId: string,
    breaks: AttendanceBreak[],
    breakMinutes: number,
  ): Promise<AttendanceRecord | null>;
  getTeamCalendar(params: {
    callerEmployeeId: string;
    callerRole: string;
    startDate: string;
    endDate: string;
    departmentId?: string;
    employeeId?: string;
  }): Promise<TeamCalendarData>;
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
  breaks: unknown;
  break_minutes: number | null;
  status: string;
  location: unknown;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function normalizeBreaks(val: unknown): AttendanceBreak[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      startTime: String(item.startTime ?? ''),
      endTime: item.endTime ? String(item.endTime) : null,
    }))
    .filter((b) => Boolean(b.startTime));
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
    breaks: normalizeBreaks(row.breaks),
    breakMinutes: row.break_minutes ?? 0,
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
              a.duration_minutes, a.breaks, a.break_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
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
              a.duration_minutes, a.breaks, a.break_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
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
           employee_id, work_date, check_in_time, check_out_time, duration_minutes, breaks, break_minutes, status, location, notes
         ) VALUES (
           $1, $2, COALESCE($3, NOW()), NULL, NULL, '[]'::jsonb, 0, $6, $4, $5
         ) RETURNING id, employee_id, work_date, check_in_time, check_out_time, duration_minutes, breaks, break_minutes, status, location, notes, created_at, updated_at`,
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
        RETURNING id, employee_id, work_date, check_in_time, check_out_time, duration_minutes, breaks, break_minutes, status, location, notes, created_at, updated_at`,
      [sessionId, checkOutTime, durationMinutes, notes ?? null],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async updateBreaks(
    sessionId: string,
    breaks: AttendanceBreak[],
    breakMinutes: number,
  ): Promise<AttendanceRecord | null> {
    const res = await this.getPool().query<AttendanceRow>(
      `UPDATE attendance_records
          SET breaks = $2::jsonb,
              break_minutes = $3,
              updated_at = NOW()
        WHERE id = $1 AND check_out_time IS NULL
        RETURNING id, employee_id, work_date, check_in_time, check_out_time, duration_minutes, breaks, break_minutes, status, location, notes, created_at, updated_at`,
      [sessionId, JSON.stringify(breaks), breakMinutes],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async getTeamCalendar(params: {
    callerEmployeeId: string;
    callerRole: string;
    startDate: string;
    endDate: string;
    departmentId?: string;
    employeeId?: string;
  }): Promise<TeamCalendarData> {
    const pool = this.getPool();
    const callerRes = await pool.query<{ department_id: string | null; manager_id: string | null }>(
      `SELECT department_id, manager_id FROM employees WHERE id = $1`,
      [params.callerEmployeeId],
    );
    const callerDeptId = callerRes.rows[0]?.department_id ?? null;
    const callerManagerId = callerRes.rows[0]?.manager_id ?? null;

    const empConditions: string[] = [`e.status = 'active'`];
    const empValues: unknown[] = [];
    let p = 1;

    if (params.callerRole === 'team_lead') {
      empConditions.push(`(e.id = $${p} OR e.manager_id = $${p})`);
      empValues.push(params.callerEmployeeId);
      p++;
    } else if (params.callerRole !== 'admin' && params.callerRole !== 'hr_manager') {
      empConditions.push(
        `(e.id = $${p} OR ($${p + 1}::uuid IS NOT NULL AND e.department_id = $${p + 1}::uuid) OR ($${p + 2}::uuid IS NOT NULL AND e.manager_id = $${p + 2}::uuid))`,
      );
      empValues.push(params.callerEmployeeId, callerDeptId, callerManagerId);
      p += 3;
    }

    if (params.departmentId) {
      empConditions.push(`e.department_id = $${p++}`);
      empValues.push(params.departmentId);
    }
    if (params.employeeId) {
      empConditions.push(`e.id = $${p++}`);
      empValues.push(params.employeeId);
    }

    const empRes = await pool.query<{
      employee_id: string;
      employee_code: string;
      employee_name: string;
      department_id: string | null;
      department_name: string | null;
      designation: string | null;
    }>(
      `SELECT e.id AS employee_id,
              e.employee_code,
              TRIM(e.first_name || ' ' || e.last_name) AS employee_name,
              e.department_id,
              d.name AS department_name,
              desig.title AS designation
         FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN designations desig ON desig.id = e.designation_id
        WHERE ${empConditions.join(' AND ')}
        ORDER BY employee_name ASC`,
      empValues,
    );

    const employees: TeamCalendarEmployee[] = empRes.rows.map((r) => ({
      employeeId: r.employee_id,
      employeeCode: r.employee_code,
      employeeName: r.employee_name,
      departmentId: r.department_id,
      departmentName: r.department_name,
      designation: r.designation,
    }));

    const deptMap = new Map<string, string>();
    for (const emp of employees) {
      if (emp.departmentId && emp.departmentName) {
        deptMap.set(emp.departmentId, emp.departmentName);
      }
    }
    const departments: TeamCalendarDepartment[] = [...deptMap.entries()].map(([id, name]) => ({
      id,
      name,
    }));

    const holidayRes = await pool.query<{ id: string; holiday_date: Date | string; name: string }>(
      `SELECT id, holiday_date, name
         FROM holidays
        WHERE holiday_date >= $1::date AND holiday_date <= $2::date
        ORDER BY holiday_date ASC`,
      [params.startDate, params.endDate],
    );
    const holidays: TeamCalendarHoliday[] = holidayRes.rows.map((h) => ({
      id: h.id,
      date: formatDate(h.holiday_date),
      name: h.name,
    }));

    const empIds = employees.map((e) => e.employeeId);
    if (empIds.length === 0) {
      return { employees, departments, holidays, entries: [] };
    }

    const empById = new Map(employees.map((e) => [e.employeeId, e]));
    const entries: TeamCalendarEntry[] = [];

    const attRes = await pool.query<{
      id: string;
      employee_id: string;
      work_date: Date | string;
      check_in_time: Date | string;
      check_out_time: Date | string | null;
      duration_minutes: number | null;
      status: string;
      location: AttendanceLocation | null;
    }>(
      `SELECT a.id, a.employee_id, a.work_date, a.check_in_time, a.check_out_time,
              a.duration_minutes, a.status, a.location
         FROM attendance_records a
        WHERE a.employee_id = ANY($1::uuid[])
          AND a.work_date >= $2::date
          AND a.work_date <= $3::date
        ORDER BY a.work_date ASC, a.check_in_time ASC`,
      [empIds, params.startDate, params.endDate],
    );

    for (const row of attRes.rows) {
      const emp = empById.get(row.employee_id);
      if (!emp) continue;
      const workMode = row.location?.workMode ?? 'office';
      let category: TeamCalendarEntry['category'] = 'present';
      let statusLabel = 'Present';
      if (row.status === 'absent') {
        category = 'absent';
        statusLabel = 'Absent';
      } else if (row.status === 'late') {
        category = 'late';
        statusLabel = 'Late Arrival';
      } else if (row.status === 'on_leave') {
        category = 'on_leave';
        statusLabel = 'On Leave';
      } else if (row.status === 'holiday') {
        category = 'holiday';
        statusLabel = 'Holiday';
      } else if (workMode === 'remote') {
        category = 'wfh';
        statusLabel = 'Work From Home';
      }

      entries.push({
        id: row.id,
        employeeId: emp.employeeId,
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        departmentId: emp.departmentId,
        departmentName: emp.departmentName,
        designation: emp.designation,
        date: formatDate(row.work_date),
        checkInTime: formatIso(row.check_in_time),
        checkOutTime: formatIso(row.check_out_time),
        durationMinutes: row.duration_minutes,
        workMode,
        category,
        statusLabel,
      });
    }

    const leaveRes = await pool.query<{
      id: string;
      employee_id: string;
      start_date: Date | string;
      end_date: Date | string;
      leave_type_name: string;
    }>(
      `SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lt.name AS leave_type_name
         FROM leave_requests lr
         JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ANY($1::uuid[])
          AND lr.status = 'approved'
          AND lr.end_date >= $2::date
          AND lr.start_date <= $3::date`,
      [empIds, params.startDate, params.endDate],
    );

    for (const lr of leaveRes.rows) {
      const emp = empById.get(lr.employee_id);
      if (!emp) continue;
      const start =
        formatDate(lr.start_date) < params.startDate ? params.startDate : formatDate(lr.start_date);
      const end =
        formatDate(lr.end_date) > params.endDate ? params.endDate : formatDate(lr.end_date);
      const cur = new Date(`${start}T00:00:00Z`);
      const last = new Date(`${end}T00:00:00Z`);
      while (cur <= last) {
        const dayStr = cur.toISOString().slice(0, 10);
        const day = cur.getUTCDay();
        if (day !== 0 && day !== 6) {
          const isWfh = /wfh|work from home/i.test(lr.leave_type_name);
          entries.push({
            id: `${lr.id}-${dayStr}`,
            employeeId: emp.employeeId,
            employeeCode: emp.employeeCode,
            employeeName: emp.employeeName,
            departmentId: emp.departmentId,
            departmentName: emp.departmentName,
            designation: emp.designation,
            date: dayStr,
            checkInTime: null,
            checkOutTime: null,
            durationMinutes: null,
            workMode: isWfh ? 'remote' : null,
            category: isWfh ? 'wfh' : 'on_leave',
            statusLabel: isWfh ? 'Work From Home' : 'On Leave',
            leaveTypeName: lr.leave_type_name,
          });
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }

    return { employees, departments, holidays, entries };
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
              a.duration_minutes, a.breaks, a.break_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
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
              a.duration_minutes, a.breaks, a.break_minutes, a.status, a.location, a.notes, a.created_at, a.updated_at
         FROM attendance_records a
        WHERE a.id = $1 AND ${scopeClause}`,
      [id, ...scopeValues],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }
}
