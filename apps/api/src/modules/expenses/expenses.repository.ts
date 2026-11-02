import type { PoolClient } from 'pg';
import { conflict } from '../../http/errors';
import { ScopeFilter, scopeToSql } from '../rbac';
import {
  ExpenseCategory,
  ExpenseClaimRecord,
  ExpenseStatus,
  ExpenseTx,
  NewExpenseClaim,
  NewReceipt,
  PoolGetter,
} from './expenses.types';

export interface FindExpenseClaimsParams {
  filter: ScopeFilter;
  employeeId?: string;
  status?: ExpenseStatus;
  offset: number;
  limit: number;
}

export interface NewExpenseCategory {
  code: string;
  name: string;
}

export interface IExpensesRepository {
  transaction<T>(work: (tx: ExpenseTx) => Promise<T>): Promise<T>;

  /** Categories that new claims may use. */
  listActiveCategories(): Promise<ExpenseCategory[]>;
  findCategory(id: string): Promise<ExpenseCategory | null>;
  /** A 409 when the code is taken. */
  insertCategory(input: NewExpenseCategory): Promise<ExpenseCategory>;
  setCategoryActive(id: string, isActive: boolean): Promise<ExpenseCategory | null>;

  insertClaim(tx: ExpenseTx, input: NewExpenseClaim): Promise<ExpenseClaimRecord>;
  /** Locks the claim row, then returns it. Null when it does not exist. */
  findForUpdate(tx: ExpenseTx, id: string): Promise<ExpenseClaimRecord | null>;
  /** Stores the receipt only while the claim is a draft. False when it is not (or is missing). */
  attachReceipt(tx: ExpenseTx, id: string, receipt: NewReceipt): Promise<boolean>;
  /** Sets the status and the matching timestamp in one statement. */
  setStatus(tx: ExpenseTx, id: string, status: ExpenseStatus): Promise<void>;
  /** One claim, only when its employee is inside `filter`. */
  find(id: string, filter: ScopeFilter): Promise<ExpenseClaimRecord | null>;
  findMany(
    params: FindExpenseClaimsParams,
  ): Promise<{ items: ExpenseClaimRecord[]; total: number }>;
}

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface ClaimRow {
  id: string;
  employee_id: string;
  employee_name: string;
  category_id: string;
  category_code: string;
  category_name: string;
  expense_date: string;
  amount_minor: string;
  currency: string;
  description: string | null;
  status: ExpenseStatus;
  receipt_key: string | null;
  receipt_name: string | null;
  receipt_content_type: string | null;
  receipt_size: string | null;
  approval_id: string | null;
  submitted_at: Date | null;
  decided_at: Date | null;
  reimbursed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const toCategory = (row: CategoryRow): ExpenseCategory => ({
  id: row.id,
  code: row.code,
  name: row.name,
  isActive: row.is_active,
});

const toClaim = (row: ClaimRow): ExpenseClaimRecord => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  categoryId: row.category_id,
  categoryCode: row.category_code,
  categoryName: row.category_name,
  expenseDate: row.expense_date,
  amountMinor: Number(row.amount_minor),
  currency: row.currency,
  description: row.description,
  status: row.status,
  receipt:
    row.receipt_key && row.receipt_name && row.receipt_content_type && row.receipt_size
      ? {
          name: row.receipt_name,
          contentType: row.receipt_content_type,
          size: Number(row.receipt_size),
        }
      : null,
  receiptKey: row.receipt_key,
  approvalId: row.approval_id,
  submittedAt: row.submitted_at?.toISOString() ?? null,
  decidedAt: row.decided_at?.toISOString() ?? null,
  reimbursedAt: row.reimbursed_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// DATE is read as text so the driver does not turn it into a local-midnight Date.
const CLAIM_SELECT = `
  SELECT c.id, c.employee_id, e.first_name || ' ' || e.last_name AS employee_name,
         c.category_id, k.code AS category_code, k.name AS category_name,
         c.expense_date::text AS expense_date, c.amount_minor, c.currency, c.description, c.status,
         c.receipt_key, c.receipt_name, c.receipt_content_type, c.receipt_size,
         c.submitted_at, c.decided_at, c.reimbursed_at, c.created_at, c.updated_at,
         (SELECT p.id FROM approvals p
           WHERE p.subject_type = 'expense_claim' AND p.subject_id = c.id) AS approval_id
    FROM expense_claims c
    JOIN employees e ON e.id = c.employee_id
    JOIN expense_categories k ON k.id = c.category_id`;

export class PgExpensesRepository implements IExpensesRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: ExpenseTx) => Promise<T>): Promise<T> {
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

  async listActiveCategories(): Promise<ExpenseCategory[]> {
    const res = await this.getPool().query<CategoryRow>(
      `SELECT id, code, name, is_active FROM expense_categories WHERE is_active ORDER BY name`,
    );
    return res.rows.map(toCategory);
  }

  async findCategory(id: string): Promise<ExpenseCategory | null> {
    const res = await this.getPool().query<CategoryRow>(
      `SELECT id, code, name, is_active FROM expense_categories WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? toCategory(res.rows[0]) : null;
  }

  async insertCategory(input: NewExpenseCategory): Promise<ExpenseCategory> {
    try {
      const res = await this.getPool().query<CategoryRow>(
        `INSERT INTO expense_categories (code, name) VALUES ($1, $2)
         RETURNING id, code, name, is_active`,
        [input.code, input.name],
      );
      return toCategory(res.rows[0] as CategoryRow);
    } catch (err) {
      // 23505: unique_violation on the code.
      if ((err as { code?: string }).code === '23505') {
        throw conflict('An expense category with this code already exists');
      }
      throw err;
    }
  }

  async setCategoryActive(id: string, isActive: boolean): Promise<ExpenseCategory | null> {
    const res = await this.getPool().query<CategoryRow>(
      `UPDATE expense_categories SET is_active = $2::boolean, updated_at = NOW()
        WHERE id = $1 RETURNING id, code, name, is_active`,
      [id, isActive],
    );
    return res.rows[0] ? toCategory(res.rows[0]) : null;
  }

  async insertClaim(tx: ExpenseTx, input: NewExpenseClaim): Promise<ExpenseClaimRecord> {
    const inserted = await tx.query<{ id: string }>(
      `INSERT INTO expense_claims (employee_id, category_id, expense_date, amount_minor, description)
       VALUES ($1, $2, $3::date, $4, $5) RETURNING id`,
      [input.employeeId, input.categoryId, input.expenseDate, input.amountMinor, input.description],
    );
    const res = await tx.query<ClaimRow>(`${CLAIM_SELECT} WHERE c.id = $1`, [
      (inserted.rows[0] as { id: string }).id,
    ]);
    return toClaim(res.rows[0] as ClaimRow);
  }

  async findForUpdate(tx: ExpenseTx, id: string): Promise<ExpenseClaimRecord | null> {
    // FOR UPDATE cannot lock the joined rows, so the claim row is locked first and read after.
    const locked = await tx.query(`SELECT 1 FROM expense_claims WHERE id = $1 FOR UPDATE`, [id]);
    if (locked.rowCount === 0) return null;
    const res = await tx.query<ClaimRow>(`${CLAIM_SELECT} WHERE c.id = $1`, [id]);
    return res.rows[0] ? toClaim(res.rows[0]) : null;
  }

  async attachReceipt(tx: ExpenseTx, id: string, receipt: NewReceipt): Promise<boolean> {
    const res = await tx.query(
      `UPDATE expense_claims
          SET receipt_key = $2, receipt_name = $3, receipt_content_type = $4,
              receipt_size = $5, receipt_sha256 = $6, updated_at = NOW()
        WHERE id = $1 AND status = 'draft'`,
      [id, receipt.key, receipt.name, receipt.contentType, receipt.size, receipt.sha256],
    );
    return (res.rowCount ?? 0) === 1;
  }

  async setStatus(tx: ExpenseTx, id: string, status: ExpenseStatus): Promise<void> {
    await tx.query(
      `UPDATE expense_claims
          SET status = $2::varchar,
              submitted_at = CASE WHEN $2::varchar = 'submitted' THEN NOW() ELSE submitted_at END,
              decided_at = CASE WHEN $2::varchar IN ('approved', 'rejected') THEN NOW() ELSE decided_at END,
              reimbursed_at = CASE WHEN $2::varchar = 'reimbursed' THEN NOW() ELSE reimbursed_at END,
              updated_at = NOW()
        WHERE id = $1`,
      [id, status],
    );
  }

  async find(id: string, filter: ScopeFilter): Promise<ExpenseClaimRecord | null> {
    const scope = scopeToSql(filter, 'c.employee_id', 2);
    const res = await this.getPool().query<ClaimRow>(
      `${CLAIM_SELECT} WHERE c.id = $1 AND ${scope.clause}`,
      [id, ...scope.values],
    );
    return res.rows[0] ? toClaim(res.rows[0]) : null;
  }

  async findMany(
    params: FindExpenseClaimsParams,
  ): Promise<{ items: ExpenseClaimRecord[]; total: number }> {
    const scope = scopeToSql(params.filter, 'c.employee_id', 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;
    if (params.employeeId) {
      values.push(params.employeeId);
      where += ` AND c.employee_id = $${values.length}`;
    }
    if (params.status) {
      values.push(params.status);
      where += ` AND c.status = $${values.length}`;
    }
    const total = await this.getPool().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM expense_claims c WHERE ${where}`,
      values,
    );
    values.push(params.limit, params.offset);
    const res = await this.getPool().query<ClaimRow>(
      `${CLAIM_SELECT} WHERE ${where}
        ORDER BY c.expense_date DESC, c.created_at DESC, c.id
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );
    return { items: res.rows.map(toClaim), total: Number(total.rows[0]?.count ?? 0) };
  }
}
