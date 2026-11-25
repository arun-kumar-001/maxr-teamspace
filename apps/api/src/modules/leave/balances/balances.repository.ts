import { ScopeFilter, scopeToSql } from '../../rbac';
import type { LeaveTx, PoolGetter } from '../policies/policies.types';
import { EmployeeLeaveBalance, LeaveBalance } from './balances.types';

export interface FindBalancesParams {
  filter: ScopeFilter;
  employeeId?: string;
  year: number;
  offset: number;
  limit: number;
}

export interface ILeaveBalancesRepository {
  transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T>;
  /**
   * Creates the missing balances of `year`: one per employee and leave type that has a balance,
   * pro-rata by month for someone who joined that year, with the carry-forward of the year
   * before. Existing rows are left alone, so running it twice creates nothing new.
   * `employeeId` limits it to one person. Returns how many rows it created.
   */
  accrue(tx: LeaveTx, year: number, employeeId?: string): Promise<number>;
  /**
   * Brings the balances of one leave type for `year` in line with its policy: creates the missing
   * ones and resets allotted and carried forward on the rest. Returns how many rows it wrote.
   * `rebuildUsed` also sets `used` from the approved requests (for a type that just got a balance).
   * It fails with a check violation when the new allowance is below the days already used.
   */
  syncType(
    tx: LeaveTx,
    year: number,
    leaveTypeId: string,
    options: { rebuildUsed: boolean },
  ): Promise<number>;
  findForEmployee(employeeId: string, year: number): Promise<LeaveBalance[]>;
  findMany(params: FindBalancesParams): Promise<{ items: EmployeeLeaveBalance[]; total: number }>;
}

interface Row {
  employee_id: string;
  employee_name: string;
  leave_type_id: string;
  code: string;
  name: string;
  year: number;
  allotted: string;
  carried_forward: string;
  used: string;
}

const toBalance = (row: Row): LeaveBalance => {
  const allotted = Number(row.allotted);
  const carriedForward = Number(row.carried_forward);
  const used = Number(row.used);
  return {
    leaveTypeId: row.leave_type_id,
    code: row.code,
    name: row.name,
    year: row.year,
    allotted,
    carriedForward,
    used,
    remaining: allotted + carriedForward - used,
  };
};

const SELECT = `
  SELECT b.employee_id, e.first_name || ' ' || e.last_name AS employee_name, b.leave_type_id,
         t.code, t.name, b.year, b.allotted, b.carried_forward, b.used
    FROM leave_balances b
    JOIN leave_types t ON t.id = b.leave_type_id
    JOIN employees e ON e.id = b.employee_id`;

// Months left in the joining year, counting the joining month, as a share of 12, in half-day steps.
const ALLOTTED_SQL = `CASE WHEN EXTRACT(YEAR FROM e.joining_date) = $1
              THEN ROUND(p.annual_days * (13 - EXTRACT(MONTH FROM e.joining_date)) / 12.0 * 2) / 2
              ELSE p.annual_days END`;

const CARRIED_SQL = `LEAST(p.carry_forward_max, COALESCE((
           SELECT GREATEST(prev.allotted + prev.carried_forward - prev.used, 0)
             FROM leave_balances prev
            WHERE prev.employee_id = e.id AND prev.leave_type_id = t.id AND prev.year = $1::int - 1
         ), 0))`;

const ELIGIBLE_SQL = `
    FROM employees e
    CROSS JOIN leave_types t
    JOIN leave_policies p ON p.leave_type_id = t.id
   WHERE t.has_balance AND t.is_active
     AND e.status IN ('pending', 'active')
     AND EXTRACT(YEAR FROM e.joining_date) <= $1`;

const ACCRUE_SQL = `
  INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, carried_forward)
  SELECT e.id, t.id, $1::int, ${ALLOTTED_SQL}, ${CARRIED_SQL}
  ${ELIGIBLE_SQL}
     AND ($2::uuid IS NULL OR e.id = $2::uuid)
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`;

// One leave type: creates what is missing and sets the rest to the policy as it is now. `used` is
// kept, unless $3 asks to rebuild it from the approved requests of the year (a type that had no
// balance until now has none counted). A balance that would end up below what is used fails the
// table's check, and the caller turns that into an answer.
const SYNC_TYPE_SQL = `
  INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, carried_forward, used)
  SELECT e.id, t.id, $1::int, ${ALLOTTED_SQL}, ${CARRIED_SQL},
         CASE WHEN $3::boolean THEN COALESCE((
           SELECT SUM(r.days) FROM leave_requests r
            WHERE r.employee_id = e.id AND r.leave_type_id = t.id AND r.status = 'approved'
              AND EXTRACT(YEAR FROM r.start_date) = $1
         ), 0) ELSE 0 END
  ${ELIGIBLE_SQL}
     AND t.id = $2::uuid
  ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE
     SET allotted = EXCLUDED.allotted,
         carried_forward = EXCLUDED.carried_forward,
         used = CASE WHEN $3::boolean THEN EXCLUDED.used ELSE leave_balances.used END,
         updated_at = NOW()`;

export class PgLeaveBalancesRepository implements ILeaveBalancesRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
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

  async accrue(tx: LeaveTx, year: number, employeeId?: string): Promise<number> {
    const res = await tx.query(ACCRUE_SQL, [year, employeeId ?? null]);
    return res.rowCount ?? 0;
  }

  async syncType(
    tx: LeaveTx,
    year: number,
    leaveTypeId: string,
    options: { rebuildUsed: boolean },
  ): Promise<number> {
    const res = await tx.query(SYNC_TYPE_SQL, [year, leaveTypeId, options.rebuildUsed]);
    return res.rowCount ?? 0;
  }

  async findForEmployee(employeeId: string, year: number): Promise<LeaveBalance[]> {
    const res = await this.getPool().query<Row>(
      // A switched-off leave type can no longer be applied for, so it is hidden unless some of it was used.
      `${SELECT} WHERE b.employee_id = $1 AND b.year = $2 AND (t.is_active OR b.used > 0) ORDER BY t.name`,
      [employeeId, year],
    );
    return res.rows.map(toBalance);
  }

  async findMany(
    params: FindBalancesParams,
  ): Promise<{ items: EmployeeLeaveBalance[]; total: number }> {
    const scope = scopeToSql(params.filter, 'b.employee_id', 1);
    const values: unknown[] = [...scope.values];
    values.push(params.year);
    let where = `${scope.clause} AND b.year = $${values.length}`;
    if (params.employeeId) {
      values.push(params.employeeId);
      where += ` AND b.employee_id = $${values.length}`;
    }
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM leave_balances b WHERE ${where}`,
      values,
    );
    values.push(params.limit, params.offset);
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE ${where}
        ORDER BY employee_name, t.name, b.employee_id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return {
      items: res.rows.map((row) => ({
        ...toBalance(row),
        employeeId: row.employee_id,
        employeeName: row.employee_name,
      })),
      total: Number(total.rows[0]?.count ?? 0),
    };
  }
}
