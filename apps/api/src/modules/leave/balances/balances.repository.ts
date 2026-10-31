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
const ACCRUE_SQL = `
  INSERT INTO leave_balances (employee_id, leave_type_id, year, allotted, carried_forward)
  SELECT e.id, t.id, $1::int,
         CASE WHEN EXTRACT(YEAR FROM e.joining_date) = $1
              THEN ROUND(p.annual_days * (13 - EXTRACT(MONTH FROM e.joining_date)) / 12.0 * 2) / 2
              ELSE p.annual_days END,
         LEAST(p.carry_forward_max, COALESCE((
           SELECT GREATEST(prev.allotted + prev.carried_forward - prev.used, 0)
             FROM leave_balances prev
            WHERE prev.employee_id = e.id AND prev.leave_type_id = t.id AND prev.year = $1::int - 1
         ), 0))
    FROM employees e
    CROSS JOIN leave_types t
    JOIN leave_policies p ON p.leave_type_id = t.id
   WHERE t.has_balance AND t.is_active
     AND e.status IN ('pending', 'active')
     AND EXTRACT(YEAR FROM e.joining_date) <= $1
     AND ($2::uuid IS NULL OR e.id = $2::uuid)
  ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING`;

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

  async findForEmployee(employeeId: string, year: number): Promise<LeaveBalance[]> {
    const res = await this.getPool().query<Row>(
      `${SELECT} WHERE b.employee_id = $1 AND b.year = $2 ORDER BY t.name`,
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
