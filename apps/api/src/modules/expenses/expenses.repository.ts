import { ExpenseStatus } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { toOffsetLimit } from '../../http/pagination';
import { ScopeFilter, scopeToSql } from '../rbac';
import type {
  ExpenseCategory,
  ExpenseClaim,
  ExpenseTx,
  IExpensesRepository,
  ListExpenseClaimsQuery,
} from './expenses.types';

export type PoolGetter = Pool | (() => Pool);

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ClaimRow {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  category_id: string;
  category_name: string;
  amount_paise: number;
  currency: 'INR';
  expense_date: string;
  description: string;
  receipt_storage_key: string | null;
  receipt_filename: string | null;
  receipt_mime_type: string | null;
  receipt_file_size: number | null;
  status: ExpenseStatus;
  rejection_reason: string | null;
  reimbursed_at: Date | null;
  reimbursed_by_employee_id: string | null;
  reimbursed_by_name: string | null;
  created_at: Date;
  updated_at: Date;
}

const mapCategory = (row: CategoryRow): ExpenseCategory => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isActive: row.is_active,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const mapClaim = (row: ClaimRow): ExpenseClaim => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  employeeCode: row.employee_code,
  categoryId: row.category_id,
  categoryName: row.category_name,
  amountPaise: row.amount_paise,
  currency: row.currency,
  expenseDate: row.expense_date,
  description: row.description,
  receiptStorageKey: row.receipt_storage_key,
  receiptFilename: row.receipt_filename,
  receiptMimeType: row.receipt_mime_type,
  receiptFileSize: row.receipt_file_size,
  status: row.status,
  rejectionReason: row.rejection_reason,
  reimbursedAt: row.reimbursed_at ? row.reimbursed_at.toISOString() : null,
  reimbursedByEmployeeId: row.reimbursed_by_employee_id,
  reimbursedByName: row.reimbursed_by_name,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

const CLAIM_SELECT = `
  SELECT
    c.id,
    c.employee_id,
    TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS employee_name,
    e.employee_code,
    c.category_id,
    cat.name AS category_name,
    c.amount_paise,
    c.currency,
    TO_CHAR(c.expense_date, 'YYYY-MM-DD') AS expense_date,
    c.description,
    c.receipt_storage_key,
    c.receipt_filename,
    c.receipt_mime_type,
    c.receipt_file_size,
    c.status,
    c.rejection_reason,
    c.reimbursed_at,
    c.reimbursed_by_employee_id,
    TRIM(CONCAT(re.first_name, ' ', re.last_name)) AS reimbursed_by_name,
    c.created_at,
    c.updated_at
  FROM expense_claims c
  JOIN employees e ON e.id = c.employee_id
  JOIN expense_categories cat ON cat.id = c.category_id
  LEFT JOIN employees re ON re.id = c.reimbursed_by_employee_id
`;

export class PgExpensesRepository implements IExpensesRepository {
  constructor(private readonly poolOrGetter: PoolGetter) {}

  private getPool(): Pool {
    return typeof this.poolOrGetter === 'function' ? this.poolOrGetter() : this.poolOrGetter;
  }

  async transaction<T>(fn: (tx: ExpenseTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findCategoryById(tx: ExpenseTx, id: string): Promise<ExpenseCategory | null> {
    const res = await tx.query<CategoryRow>(
      `SELECT id, name, description, is_active, created_at, updated_at
         FROM expense_categories
        WHERE id = $1`,
      [id],
    );
    return res.rows[0] ? mapCategory(res.rows[0]) : null;
  }

  async listCategories(tx: ExpenseTx, activeOnly = true): Promise<ExpenseCategory[]> {
    const query = activeOnly
      ? `SELECT id, name, description, is_active, created_at, updated_at
           FROM expense_categories
          WHERE is_active = true
          ORDER BY name ASC`
      : `SELECT id, name, description, is_active, created_at, updated_at
           FROM expense_categories
          ORDER BY name ASC`;
    const res = await tx.query<CategoryRow>(query);
    return res.rows.map(mapCategory);
  }

  async createCategory(
    tx: ExpenseTx,
    input: { name: string; description?: string | null },
  ): Promise<ExpenseCategory> {
    const res = await tx.query<CategoryRow>(
      `INSERT INTO expense_categories (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, is_active, created_at, updated_at`,
      [input.name, input.description ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create expense category');
    return mapCategory(row);
  }

  async updateCategory(
    tx: ExpenseTx,
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ExpenseCategory | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [id];

    if (input.name !== undefined) {
      values.push(input.name);
      sets.push(`name = $${values.length}`);
    }
    if (input.description !== undefined) {
      values.push(input.description);
      sets.push(`description = $${values.length}`);
    }
    if (input.isActive !== undefined) {
      values.push(input.isActive);
      sets.push(`is_active = $${values.length}`);
    }

    const res = await tx.query<CategoryRow>(
      `UPDATE expense_categories
          SET ${sets.join(', ')}
        WHERE id = $1
       RETURNING id, name, description, is_active, created_at, updated_at`,
      values,
    );
    return res.rows[0] ? mapCategory(res.rows[0]) : null;
  }

  async findClaimById(
    tx: ExpenseTx,
    id: string,
    filter?: ScopeFilter,
  ): Promise<ExpenseClaim | null> {
    if (filter) {
      const scope = scopeToSql(filter, 'c.employee_id', 2);
      const res = await tx.query<ClaimRow>(
        `${CLAIM_SELECT}
          WHERE c.id = $1 AND ${scope.clause}`,
        [id, ...scope.values],
      );
      return res.rows[0] ? mapClaim(res.rows[0]) : null;
    }

    const res = await tx.query<ClaimRow>(
      `${CLAIM_SELECT}
        WHERE c.id = $1`,
      [id],
    );
    return res.rows[0] ? mapClaim(res.rows[0]) : null;
  }

  async findManyClaims(
    tx: ExpenseTx,
    query: ListExpenseClaimsQuery,
    filter: ScopeFilter,
  ): Promise<{ items: ExpenseClaim[]; total: number }> {
    const scope = scopeToSql(filter, 'c.employee_id', 1);
    const values: unknown[] = [...scope.values];
    let where = scope.clause;

    const add = (clause: string, value: unknown) => {
      values.push(value);
      where += ` AND ${clause.replace('?', `$${values.length}`)}`;
    };

    if (query.employeeId) add('c.employee_id = ?', query.employeeId);
    if (query.status) add('c.status = ?', query.status);
    if (query.categoryId) add('c.category_id = ?', query.categoryId);
    if (query.from) add('c.expense_date >= ?::date', query.from);
    if (query.to) add('c.expense_date <= ?::date', query.to);

    const countRes = await tx.query<{ count: string }>(
      `SELECT COUNT(*) AS count
         FROM expense_claims c
        WHERE ${where}`,
      values,
    );
    const total = Number(countRes.rows[0]?.count ?? 0);

    const { limit, offset } = toOffsetLimit({ page: query.page, pageSize: query.pageSize });
    values.push(limit, offset);

    const res = await tx.query<ClaimRow>(
      `${CLAIM_SELECT}
        WHERE ${where}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      items: res.rows.map(mapClaim),
      total,
    };
  }

  async createClaim(
    tx: ExpenseTx,
    claim: {
      id?: string;
      employeeId: string;
      categoryId: string;
      amountPaise: number;
      currency?: 'INR';
      expenseDate: string;
      description: string;
      receiptStorageKey?: string | null;
      receiptFilename?: string | null;
      receiptMimeType?: string | null;
      receiptFileSize?: number | null;
      status?: ExpenseStatus;
    },
  ): Promise<ExpenseClaim> {
    const id = claim.id;
    const values = [
      claim.employeeId,
      claim.categoryId,
      claim.amountPaise,
      claim.currency ?? 'INR',
      claim.expenseDate,
      claim.description,
      claim.receiptStorageKey ?? null,
      claim.receiptFilename ?? null,
      claim.receiptMimeType ?? null,
      claim.receiptFileSize ?? null,
      claim.status ?? 'submitted',
    ];

    let query: string;
    if (id) {
      values.unshift(id);
      query = `
        INSERT INTO expense_claims (
          id, employee_id, category_id, amount_paise, currency, expense_date, description,
          receipt_storage_key, receipt_filename, receipt_mime_type, receipt_file_size, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
    } else {
      query = `
        INSERT INTO expense_claims (
          employee_id, category_id, amount_paise, currency, expense_date, description,
          receipt_storage_key, receipt_filename, receipt_mime_type, receipt_file_size, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;
    }

    const inserted = await tx.query<{ id: string }>(query, values);
    const createdId = inserted.rows[0]?.id;
    if (!createdId) throw new Error('Created expense claim could not be retrieved');

    // Fetch with joined names
    const full = await this.findClaimById(tx, createdId);
    if (!full) throw new Error('Created expense claim could not be retrieved');
    return full;
  }

  async updateClaimStatus(
    tx: ExpenseTx,
    id: string,
    status: ExpenseStatus,
    extra?: {
      rejectionReason?: string | null;
      reimbursedAt?: string | null;
      reimbursedByEmployeeId?: string | null;
    },
  ): Promise<ExpenseClaim | null> {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const values: unknown[] = [id, status];

    if (extra?.rejectionReason !== undefined) {
      values.push(extra.rejectionReason);
      sets.push(`rejection_reason = $${values.length}`);
    }
    if (extra?.reimbursedAt !== undefined) {
      values.push(extra.reimbursedAt);
      sets.push(`reimbursed_at = $${values.length}`);
    }
    if (extra?.reimbursedByEmployeeId !== undefined) {
      values.push(extra.reimbursedByEmployeeId);
      sets.push(`reimbursed_by_employee_id = $${values.length}`);
    }

    await tx.query(
      `UPDATE expense_claims
          SET ${sets.join(', ')}
        WHERE id = $1`,
      values,
    );

    return this.findClaimById(tx, id);
  }
}
