import type { PoolClient } from 'pg';
import { conflict } from '../../../http/errors';
import {
  LeavePolicy,
  LeavePolicyValues,
  LeaveTx,
  NewLeavePolicy,
  PoolGetter,
} from './policies.types';

export interface ILeavePoliciesRepository {
  transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T>;
  list(): Promise<LeavePolicy[]>;
  /** Locks the type and its policy until the transaction ends. */
  findForUpdate(tx: LeaveTx, id: string): Promise<LeavePolicy | null>;
  /** A 409 when the code or the name is taken. */
  insert(tx: LeaveTx, input: NewLeavePolicy): Promise<LeavePolicy>;
  /** Writes the new values and bumps the version. A 409 when the name is taken. */
  update(tx: LeaveTx, id: string, values: LeavePolicyValues): Promise<LeavePolicy>;
}

interface Row {
  id: string;
  code: string;
  name: string;
  has_balance: boolean;
  is_active: boolean;
  annual_days: string;
  carry_forward_max: string;
  allow_half_day: boolean;
  max_backdate_days: number;
  version: number;
  updated_at: Date;
}

const SELECT = `
  SELECT t.id, t.code, t.name, t.has_balance, t.is_active, p.annual_days, p.carry_forward_max,
         p.allow_half_day, p.max_backdate_days, p.version, GREATEST(t.updated_at, p.updated_at) AS updated_at
    FROM leave_types t
    JOIN leave_policies p ON p.leave_type_id = t.id`;

const toPolicy = (row: Row): LeavePolicy => ({
  id: row.id,
  code: row.code,
  name: row.name,
  hasBalance: row.has_balance,
  isActive: row.is_active,
  annualDays: Number(row.annual_days),
  carryForwardMax: Number(row.carry_forward_max),
  allowHalfDay: row.allow_half_day,
  maxBackdateDays: row.max_backdate_days,
  version: row.version,
  updatedAt: row.updated_at.toISOString(),
});

const isUniqueViolation = (err: unknown): boolean => (err as { code?: string }).code === '23505';

export class PgLeavePoliciesRepository implements ILeavePoliciesRepository {
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

  async list(): Promise<LeavePolicy[]> {
    const res = await this.getPool().query<Row>(`${SELECT} ORDER BY t.is_active DESC, t.name`);
    return res.rows.map(toPolicy);
  }

  async findForUpdate(tx: LeaveTx, id: string): Promise<LeavePolicy | null> {
    const locked = await tx.query(
      `SELECT 1 FROM leave_types t JOIN leave_policies p ON p.leave_type_id = t.id
        WHERE t.id = $1 FOR UPDATE OF t, p`,
      [id],
    );
    if (locked.rowCount === 0) return null;
    const res = await tx.query<Row>(`${SELECT} WHERE t.id = $1`, [id]);
    return res.rows[0] ? toPolicy(res.rows[0]) : null;
  }

  async insert(tx: LeaveTx, input: NewLeavePolicy): Promise<LeavePolicy> {
    try {
      const type = await tx.query<{ id: string }>(
        `INSERT INTO leave_types (code, name, has_balance) VALUES ($1, $2, $3) RETURNING id`,
        [input.code, input.name, input.hasBalance],
      );
      const id = (type.rows[0] as { id: string }).id;
      await tx.query(
        `INSERT INTO leave_policies
           (leave_type_id, annual_days, carry_forward_max, allow_half_day, max_backdate_days)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, input.annualDays, input.carryForwardMax, input.allowHalfDay, input.maxBackdateDays],
      );
      const res = await tx.query<Row>(`${SELECT} WHERE t.id = $1`, [id]);
      return toPolicy(res.rows[0] as Row);
    } catch (err) {
      if (isUniqueViolation(err))
        throw conflict('A leave type with this code or name already exists');
      throw err;
    }
  }

  async update(tx: LeaveTx, id: string, values: LeavePolicyValues): Promise<LeavePolicy> {
    try {
      await tx.query(
        `UPDATE leave_types SET name = $2, is_active = $3, updated_at = NOW() WHERE id = $1`,
        [id, values.name, values.isActive],
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict('A leave type with this name already exists');
      throw err;
    }
    await tx.query(
      `UPDATE leave_policies
          SET annual_days = $2, carry_forward_max = $3, allow_half_day = $4, max_backdate_days = $5,
              version = version + 1, updated_at = NOW()
        WHERE leave_type_id = $1`,
      [id, values.annualDays, values.carryForwardMax, values.allowHalfDay, values.maxBackdateDays],
    );
    const res = await tx.query<Row>(`${SELECT} WHERE t.id = $1`, [id]);
    return toPolicy(res.rows[0] as Row);
  }
}
