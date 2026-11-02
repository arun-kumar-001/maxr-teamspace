import type { Pool, PoolClient } from 'pg';

export type ExpenseTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

/** The approvals subject type of an expense claim. */
export const EXPENSE_SUBJECT = 'expense_claim';

/** One company currency (D-17); amounts are integer minor units of it. */
export const COMPANY_CURRENCY = 'INR';
/** 100,000.00 INR in paise. */
export const MAX_CLAIM_MINOR = 10_000_000;
/** Claims above 200.00 INR need a receipt (D-17). */
export const RECEIPT_REQUIRED_ABOVE_MINOR = 20_000;
/** A claim must be made within this many days of the expense (D-17). */
export const MAX_CLAIM_AGE_DAYS = 60;

export const EXPENSE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
  'reimbursed',
] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ExpenseReceipt {
  name: string;
  contentType: string;
  size: number;
}

/** What the API returns. The stored receipt key never leaves the server. */
export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employeeName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  expenseDate: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  status: ExpenseStatus;
  receipt: ExpenseReceipt | null;
  approvalId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  reimbursedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A claim as the service sees it, including the storage key of its receipt. */
export interface ExpenseClaimRecord extends ExpenseClaim {
  receiptKey: string | null;
}

export interface NewExpenseClaim {
  employeeId: string;
  categoryId: string;
  expenseDate: string;
  amountMinor: number;
  description: string | null;
}

export interface NewReceipt {
  key: string;
  name: string;
  contentType: string;
  size: number;
  sha256: string;
}
