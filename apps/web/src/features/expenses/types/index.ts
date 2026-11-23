import { ExpenseStatus } from '@maxr/shared';

export type { ExpenseStatus };

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

export interface CreateExpenseClaimPayload {
  categoryId: string;
  amountPaise: number;
  expenseDate: string;
  description: string;
  receipt?: {
    filename: string;
    declaredType: string;
    base64: string;
  };
}

export interface ListExpenseClaimsParams {
  page?: number;
  pageSize?: number;
  status?: ExpenseStatus;
  categoryId?: string;
  employeeId?: string;
  from?: string;
  to?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export function formatPaiseToInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function inrToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
