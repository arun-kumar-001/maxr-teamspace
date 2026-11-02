import type { Pool, PoolClient } from 'pg';
import { ScopeFilter, scopeToSql } from '../rbac';
import {
  AssignableEmployee,
  AttendancePolicyRow,
  NewAssignment,
  NewShift,
  Shift,
  ShiftAssignment,
  ShiftPatch,
  ShiftSummary,
  ShiftTx,
} from './shifts.types';

export interface IShiftsRepository {
  transaction<T>(work: (tx: ShiftTx) => Promise<T>): Promise<T>;

  listShifts(filter: { isActive?: boolean }): Promise<Shift[]>;
  findShift(id: string): Promise<Shift | null>;
  /** Locks the row until the transaction ends. */
  lockShift(tx: ShiftTx, id: string): Promise<Shift | null>;
  codeTaken(tx: ShiftTx, code: string): Promise<boolean>;
  insertShift(tx: ShiftTx, shift: NewShift): Promise<Shift>;
  updateShift(tx: ShiftTx, id: string, patch: ShiftPatch): Promise<Shift>;
  /** Assignments still in force on or after `today`, plus whether the policy uses it as default. */
  shiftUsage(
    tx: ShiftTx,
    id: string,
    today: string,
  ): Promise<{ assignments: number; isDefault: boolean }>;

  /** Locks the employee row, so assignments for one person are made one at a time. */
  lockEmployee(tx: ShiftTx, id: string): Promise<AssignableEmployee | null>;
  isVisible(id: string, filter: ScopeFilter, selfId: string): Promise<boolean>;
  listAssignments(employeeId: string): Promise<ShiftAssignment[]>;
  findOverlapping(
    tx: ShiftTx,
    employeeId: string,
    from: string,
    to: string | null,
  ): Promise<ShiftAssignment[]>;
  insertAssignment(tx: ShiftTx, input: NewAssignment): Promise<ShiftAssignment>;
  endAssignment(tx: ShiftTx, id: string, effectiveTo: string): Promise<void>;
  shiftFor(employeeId: string, date: string): Promise<ShiftSummary | null>;

  getPolicy(): Promise<AttendancePolicyRow>;
  lockPolicy(tx: ShiftTx): Promise<AttendancePolicyRow>;
  updatePolicy(
    tx: ShiftTx,
    patch: { fullDayMinutes?: number; halfDayMinutes?: number; defaultShiftId?: string },
  ): Promise<AttendancePolicyRow>;
}

interface ShiftRow {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  crosses_midnight: boolean;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const iso = (value: Date | string): string => new Date(value).toISOString();
/** PostgreSQL returns `TIME` as `HH:MM:SS`; the API speaks `HH:MM`. */
const hhmm = (value: string): string => value.slice(0, 5);

const toShift = (r: ShiftRow): Shift => ({
  id: r.id,
  code: r.code,
  name: r.name,
  startTime: hhmm(r.start_time),
  endTime: hhmm(r.end_time),
  graceMinutes: r.grace_minutes,
  crossesMidnight: r.crosses_midnight,
  isActive: r.is_active,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

const SHIFT_COLUMNS = `id, code, name, start_time::text AS start_time, end_time::text AS end_time,
  grace_minutes, crosses_midnight, is_active, created_at, updated_at`;

interface AssignmentRow {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
  created_at: Date | string;
  shift_id: string;
  shift_code: string;
  shift_name: string;
  shift_start: string;
  shift_end: string;
  shift_grace: number;
  shift_crosses: boolean;
}

const toAssignment = (r: AssignmentRow): ShiftAssignment => ({
  id: r.id,
  employeeId: r.employee_id,
  shift: {
    id: r.shift_id,
    code: r.shift_code,
    name: r.shift_name,
    startTime: hhmm(r.shift_start),
    endTime: hhmm(r.shift_end),
    graceMinutes: r.shift_grace,
    crossesMidnight: r.shift_crosses,
  },
  effectiveFrom: r.effective_from,
  effectiveTo: r.effective_to,
  createdAt: iso(r.created_at),
});

const ASSIGNMENT_SELECT = `
  SELECT es.id, es.employee_id, es.effective_from::text AS effective_from,
         es.effective_to::text AS effective_to, es.created_at,
         s.id AS shift_id, s.code AS shift_code, s.name AS shift_name,
         s.start_time::text AS shift_start, s.end_time::text AS shift_end,
         s.grace_minutes AS shift_grace, s.crosses_midnight AS shift_crosses
    FROM employee_shifts es JOIN shifts s ON s.id = es.shift_id`;

interface PolicyRow {
  full_day_minutes: number;
  half_day_minutes: number;
  default_shift_id: string;
  updated_at: Date | string;
}

const toPolicy = (r: PolicyRow): AttendancePolicyRow => ({
  fullDayMinutes: r.full_day_minutes,
  halfDayMinutes: r.half_day_minutes,
  defaultShiftId: r.default_shift_id,
  updatedAt: iso(r.updated_at),
});

const SHIFT_PATCH_COLUMNS = {
  name: 'name',
  startTime: 'start_time',
  endTime: 'end_time',
  graceMinutes: 'grace_minutes',
  isActive: 'is_active',
} as const;

export class PgShiftsRepository implements IShiftsRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: ShiftTx) => Promise<T>): Promise<T> {
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

  async listShifts(filter: { isActive?: boolean }): Promise<Shift[]> {
    const values: unknown[] = [];
    let where = '';
    if (filter.isActive !== undefined) {
      values.push(filter.isActive);
      where = 'WHERE is_active = $1';
    }
    const res = await this.getPool().query<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts ${where} ORDER BY start_time, LOWER(code), id`,
      values,
    );
    return res.rows.map(toShift);
  }

  async findShift(id: string): Promise<Shift | null> {
    const res = await this.getPool().query<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? toShift(res.rows[0]) : null;
  }

  async lockShift(tx: ShiftTx, id: string): Promise<Shift | null> {
    const res = await tx.query<ShiftRow>(
      `SELECT ${SHIFT_COLUMNS} FROM shifts WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return res.rows[0] ? toShift(res.rows[0]) : null;
  }

  async codeTaken(tx: ShiftTx, code: string): Promise<boolean> {
    const res = await tx.query(`SELECT 1 FROM shifts WHERE LOWER(code) = LOWER($1)`, [code]);
    return (res.rowCount ?? 0) > 0;
  }

  async insertShift(tx: ShiftTx, shift: NewShift): Promise<Shift> {
    const res = await tx.query<ShiftRow>(
      `INSERT INTO shifts (code, name, start_time, end_time, grace_minutes)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${SHIFT_COLUMNS}`,
      [shift.code, shift.name, shift.startTime, shift.endTime, shift.graceMinutes],
    );
    return toShift(res.rows[0] as ShiftRow);
  }

  async updateShift(tx: ShiftTx, id: string, patch: ShiftPatch): Promise<Shift> {
    const keys = (Object.keys(patch) as Array<keyof typeof SHIFT_PATCH_COLUMNS>).filter(
      (k) => k in SHIFT_PATCH_COLUMNS,
    );
    const values: unknown[] = [id];
    const sets = keys.map((key) => {
      values.push(patch[key]);
      return `${SHIFT_PATCH_COLUMNS[key]} = $${values.length}`;
    });
    const res = await tx.query<ShiftRow>(
      `UPDATE shifts SET ${[...sets, 'updated_at = NOW()'].join(', ')} WHERE id = $1 RETURNING ${SHIFT_COLUMNS}`,
      values,
    );
    return toShift(res.rows[0] as ShiftRow);
  }

  async shiftUsage(tx: ShiftTx, id: string, today: string) {
    const res = await tx.query<{ assignments: number; is_default: boolean }>(
      `SELECT (SELECT COUNT(*)::int FROM employee_shifts
                WHERE shift_id = $1 AND (effective_to IS NULL OR effective_to >= $2::date)) AS assignments,
              EXISTS (SELECT 1 FROM attendance_policies WHERE default_shift_id = $1) AS is_default`,
      [id, today],
    );
    return {
      assignments: res.rows[0]?.assignments ?? 0,
      isDefault: res.rows[0]?.is_default ?? false,
    };
  }

  async lockEmployee(tx: ShiftTx, id: string): Promise<AssignableEmployee | null> {
    const res = await tx.query<AssignableEmployee>(
      `SELECT id, status FROM employees WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async isVisible(id: string, filter: ScopeFilter, selfId: string): Promise<boolean> {
    if (id === selfId) return true;
    const scope = scopeToSql(filter, 'e.id', 2);
    const res = await this.getPool().query(
      `SELECT 1 FROM employees e WHERE e.id = $1 AND ${scope.clause}`,
      [id, ...scope.values],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listAssignments(employeeId: string): Promise<ShiftAssignment[]> {
    const res = await this.getPool().query<AssignmentRow>(
      `${ASSIGNMENT_SELECT} WHERE es.employee_id = $1 ORDER BY es.effective_from DESC, es.id`,
      [employeeId],
    );
    return res.rows.map(toAssignment);
  }

  async findOverlapping(tx: ShiftTx, employeeId: string, from: string, to: string | null) {
    const res = await tx.query<AssignmentRow>(
      `${ASSIGNMENT_SELECT}
        WHERE es.employee_id = $1
          AND daterange(es.effective_from, es.effective_to, '[]') && daterange($2::date, $3::date, '[]')
        ORDER BY es.effective_from`,
      [employeeId, from, to],
    );
    return res.rows.map(toAssignment);
  }

  async insertAssignment(tx: ShiftTx, input: NewAssignment): Promise<ShiftAssignment> {
    const res = await tx.query<{ id: string }>(
      `INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [input.employeeId, input.shiftId, input.effectiveFrom, input.effectiveTo],
    );
    const row = await tx.query<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE es.id = $1`, [
      res.rows[0]?.id,
    ]);
    return toAssignment(row.rows[0] as AssignmentRow);
  }

  async endAssignment(tx: ShiftTx, id: string, effectiveTo: string): Promise<void> {
    await tx.query(`UPDATE employee_shifts SET effective_to = $2 WHERE id = $1`, [id, effectiveTo]);
  }

  async shiftFor(employeeId: string, date: string): Promise<ShiftSummary | null> {
    const res = await this.getPool().query<AssignmentRow>(
      `${ASSIGNMENT_SELECT}
        WHERE es.employee_id = $1 AND es.effective_from <= $2::date
          AND (es.effective_to IS NULL OR es.effective_to >= $2::date)`,
      [employeeId, date],
    );
    return res.rows[0] ? toAssignment(res.rows[0]).shift : null;
  }

  async getPolicy(): Promise<AttendancePolicyRow> {
    const res = await this.getPool().query<PolicyRow>(
      `SELECT full_day_minutes, half_day_minutes, default_shift_id, updated_at FROM attendance_policies`,
    );
    return toPolicy(res.rows[0] as PolicyRow);
  }

  async lockPolicy(tx: ShiftTx): Promise<AttendancePolicyRow> {
    const res = await tx.query<PolicyRow>(
      `SELECT full_day_minutes, half_day_minutes, default_shift_id, updated_at
         FROM attendance_policies FOR UPDATE`,
    );
    return toPolicy(res.rows[0] as PolicyRow);
  }

  async updatePolicy(
    tx: ShiftTx,
    patch: { fullDayMinutes?: number; halfDayMinutes?: number; defaultShiftId?: string },
  ): Promise<AttendancePolicyRow> {
    const res = await tx.query<PolicyRow>(
      `UPDATE attendance_policies
          SET full_day_minutes = COALESCE($1, full_day_minutes),
              half_day_minutes = COALESCE($2, half_day_minutes),
              default_shift_id = COALESCE($3, default_shift_id),
              updated_at = NOW()
        RETURNING full_day_minutes, half_day_minutes, default_shift_id, updated_at`,
      [patch.fullDayMinutes ?? null, patch.halfDayMinutes ?? null, patch.defaultShiftId ?? null],
    );
    return toPolicy(res.rows[0] as PolicyRow);
  }
}
