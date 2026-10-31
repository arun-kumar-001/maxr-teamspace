import type { PoolClient } from 'pg';
import { conflict } from '../../../http/errors';
import { ScopeFilter, scopeToSql } from '../../rbac';
import type { LeaveTx, PoolGetter } from '../policies/policies.types';
import { LeaveRequest, LeaveRequestStatus, NewLeaveRequest } from './requests.types';

export interface FindLeaveRequestsParams {
  filter: ScopeFilter;
  employeeId?: string;
  status?: LeaveRequestStatus;
  leaveTypeId?: string;
  from?: string;
  to?: string;
  offset: number;
  limit: number;
}

export interface ILeaveRequestsRepository {
  transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T>;
  /**
   * Locks the employee's balance row for the type and year, so two applications at once are
   * checked one after the other. Returns what can still be applied for: the balance left minus
   * the days of requests that are applied or pending. Null when there is no balance row.
   */
  lockBalance(
    tx: LeaveTx,
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<{ available: number } | null>;
  /** Status `applied`. A 409 when it overlaps a live request of the same employee. */
  insert(tx: LeaveTx, input: NewLeaveRequest): Promise<LeaveRequest>;
  findForUpdate(tx: LeaveTx, id: string): Promise<LeaveRequest | null>;
  setStatus(tx: LeaveTx, id: string, status: LeaveRequestStatus): Promise<void>;
  /** Adds `days` to `used` if the balance covers it. False when it does not (or there is no row). */
  deduct(
    tx: LeaveTx,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ): Promise<{ usedBefore: number; usedAfter: number } | null>;
  /** One request, only when its employee is inside `filter`. */
  find(id: string, filter: ScopeFilter): Promise<LeaveRequest | null>;
  findMany(params: FindLeaveRequestsParams): Promise<{ items: LeaveRequest[]; total: number }>;
}

interface Row {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  code: string;
  type_name: string;
  start_date: string;
  end_date: string;
  half_day: boolean;
  days: string;
  reason: string | null;
  status: LeaveRequestStatus;
  approval_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const toRequest = (row: Row): LeaveRequest => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  leaveTypeId: row.leave_type_id,
  leaveTypeCode: row.code,
  leaveTypeName: row.type_name,
  startDate: row.start_date,
  endDate: row.end_date,
  halfDay: row.half_day,
  days: Number(row.days),
  reason: row.reason,
  status: row.status,
  approvalId: row.approval_id,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// DATE columns are read as text so the driver does not turn them into local-midnight Dates.
const SELECT = `
  SELECT r.id, r.employee_id, e.first_name || ' ' || e.last_name AS employee_name, r.leave_type_id,
         t.code, t.name AS type_name, r.start_date::text AS start_date, r.end_date::text AS end_date,
         r.half_day, r.days, r.reason, r.status, r.created_at, r.updated_at,
         (SELECT p.id FROM approvals p
           WHERE p.subject_type = 'leave_request' AND p.subject_id = r.id) AS approval_id
    FROM leave_requests r
    JOIN employees e ON e.id = r.employee_id
    JOIN leave_types t ON t.id = r.leave_type_id`;

export class PgLeaveRequestsRepository implements ILeaveRequestsRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
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

  async lockBalance(tx: LeaveTx, employeeId: string, leaveTypeId: string, year: number) {
    const balance = await tx.query<{ remaining: string }>(
      `SELECT allotted + carried_forward - used AS remaining FROM leave_balances
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 FOR UPDATE`,
      [employeeId, leaveTypeId, year],
    );
    if (!balance.rows[0]) return null;
    const reserved = await tx.query<{ days: string }>(
      `SELECT COALESCE(SUM(days), 0) AS days FROM leave_requests
        WHERE employee_id = $1 AND leave_type_id = $2
          AND EXTRACT(YEAR FROM start_date) = $3 AND status IN ('applied', 'pending')`,
      [employeeId, leaveTypeId, year],
    );
    return { available: Number(balance.rows[0].remaining) - Number(reserved.rows[0]?.days ?? 0) };
  }

  async insert(tx: LeaveTx, input: NewLeaveRequest): Promise<LeaveRequest> {
    try {
      const res = await tx.query<{ id: string }>(
        `INSERT INTO leave_requests
           (employee_id, leave_type_id, start_date, end_date, half_day, days, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          input.employeeId,
          input.leaveTypeId,
          input.startDate,
          input.endDate,
          input.halfDay,
          input.days,
          input.reason,
        ],
      );
      const created = await tx.query<Row>(`${SELECT} WHERE r.id = $1`, [
        (res.rows[0] as { id: string }).id,
      ]);
      return toRequest(created.rows[0] as Row);
    } catch (err) {
      // 23P01: the exclusion constraint, a live request already covers one of these dates.
      if ((err as { code?: string }).code === '23P01') {
        throw conflict('These dates overlap another leave request of yours');
      }
      throw err;
    }
  }

  async findForUpdate(tx: LeaveTx, id: string): Promise<LeaveRequest | null> {
    // FOR UPDATE cannot lock the joined rows, so the request row is locked first and read after.
    const locked = await tx.query(`SELECT 1 FROM leave_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (locked.rowCount === 0) return null;
    const res = await tx.query<Row>(`${SELECT} WHERE r.id = $1`, [id]);
    return res.rows[0] ? toRequest(res.rows[0]) : null;
  }

  async setStatus(tx: LeaveTx, id: string, status: LeaveRequestStatus): Promise<void> {
    await tx.query(`UPDATE leave_requests SET status = $2, updated_at = NOW() WHERE id = $1`, [
      id,
      status,
    ]);
  }

  async deduct(
    tx: LeaveTx,
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
  ): Promise<{ usedBefore: number; usedAfter: number } | null> {
    // One statement: it checks and adds under the row lock it takes, so it cannot over-spend.
    const res = await tx.query<{ used_before: string; used_after: string }>(
      `UPDATE leave_balances b
          SET used = b.used + $4, updated_at = NOW()
         FROM (SELECT id, used FROM leave_balances
                WHERE employee_id = $1 AND leave_type_id = $2 AND year = $3 FOR UPDATE) old
        WHERE b.id = old.id AND b.used + $4 <= b.allotted + b.carried_forward
        RETURNING old.used AS used_before, b.used AS used_after`,
      [employeeId, leaveTypeId, year, days],
    );
    const row = res.rows[0];
    return row ? { usedBefore: Number(row.used_before), usedAfter: Number(row.used_after) } : null;
  }

  async find(id: string, filter: ScopeFilter): Promise<LeaveRequest | null> {
    const scope = scopeToSql(filter, 'r.employee_id', 2);
    const res = await this.getPool().query<Row>(`${SELECT} WHERE r.id = $1 AND ${scope.clause}`, [
      id,
      ...scope.values,
    ]);
    return res.rows[0] ? toRequest(res.rows[0]) : null;
  }

  async findMany(
    params: FindLeaveRequestsParams,
  ): Promise<{ items: LeaveRequest[]; total: number }> {
    const scope = scopeToSql(params.filter, 'r.employee_id', 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;
    const add = (clause: string, value: unknown) => {
      values.push(value);
      where += ` AND ${clause.replace('?', `$${values.length}`)}`;
    };
    if (params.employeeId) add('r.employee_id = ?', params.employeeId);
    if (params.status) add('r.status = ?', params.status);
    if (params.leaveTypeId) add('r.leave_type_id = ?', params.leaveTypeId);
    if (params.from) add('r.end_date >= ?::date', params.from);
    if (params.to) add('r.start_date <= ?::date', params.to);
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM leave_requests r WHERE ${where}`,
      values,
    );
    values.push(params.limit, params.offset);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE ${where}
        ORDER BY r.start_date DESC, r.created_at DESC, r.id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: res.rows.map(toRequest), total: Number(total.rows[0]?.count ?? 0) };
  }
}
