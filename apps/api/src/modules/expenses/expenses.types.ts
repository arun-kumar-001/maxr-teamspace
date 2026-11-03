import { ExpenseStatus, Role } from '@maxr/shared';
import { PoolClient } from 'pg';
import { ScopeFilter } from '../rbac';

export type ExpenseTx = Pick<PoolClient, 'query'>;

export interface ExpenseCaller {
  actorId: string;
  employeeId: string;
  roles: readonly Role[];
  requestId?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  categoryId: string;
  categoryName?: string;
  amountPaise: number;
  currency: 'INR';
  expenseDate: string; // YYYY-MM-DD
  description: string;
  receiptStorageKey: string | null;
  receiptFilename: string | null;
  receiptMimeType: string | null;
  receiptFileSize: number | null;
  status: ExpenseStatus;
  rejectionReason: string | null;
  reimbursedAt: string | null;
  reimbursedByEmployeeId: string | null;
  reimbursedByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseClaimInput {
  categoryId: string;
  amountPaise: number;
  expenseDate: string; // YYYY-MM-DD
  description: string;
  receipt?: {
    filename: string;
    declaredType: string;
    body: Buffer;
  };
}

export interface ListExpenseClaimsQuery {
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  categoryId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}

export interface DownloadLinkResult {
  url: string;
  expiresAt: string;
}

export interface IExpensesRepository {
  transaction<T>(fn: (tx: ExpenseTx) => Promise<T>): Promise<T>;
  findCategoryById(tx: ExpenseTx, id: string): Promise<ExpenseCategory | null>;
  listCategories(tx: ExpenseTx, activeOnly?: boolean): Promise<ExpenseCategory[]>;
  createCategory(
    tx: ExpenseTx,
    input: { name: string; description?: string | null },
  ): Promise<ExpenseCategory>;
  updateCategory(
    tx: ExpenseTx,
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ExpenseCategory | null>;

  findClaimById(tx: ExpenseTx, id: string, filter?: ScopeFilter): Promise<ExpenseClaim | null>;
  findManyClaims(
    tx: ExpenseTx,
    query: ListExpenseClaimsQuery,
    filter: ScopeFilter,
  ): Promise<{ items: ExpenseClaim[]; total: number }>;
  createClaim(
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
  ): Promise<ExpenseClaim>;
  updateClaimStatus(
    tx: ExpenseTx,
    id: string,
    status: ExpenseStatus,
    extra?: {
      rejectionReason?: string | null;
      reimbursedAt?: string | null;
      reimbursedByEmployeeId?: string | null;
    },
  ): Promise<ExpenseClaim | null>;
}
