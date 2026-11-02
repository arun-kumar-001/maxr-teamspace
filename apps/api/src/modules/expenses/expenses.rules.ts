import { conflict, unprocessable } from '../../http/errors';
import { ExpenseStatus, MAX_CLAIM_AGE_DAYS, RECEIPT_REQUIRED_ABOVE_MINOR } from './expenses.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every move a claim may make. A status with no entry (or an empty list) is final. The approval
 * decision moves `submitted`; everything else is the claimant's or HR's action.
 */
export const EXPENSE_TRANSITIONS: Readonly<Record<ExpenseStatus, readonly ExpenseStatus[]>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['reimbursed'],
  rejected: [],
  cancelled: [],
  reimbursed: [],
};

export function assertTransition(from: ExpenseStatus, to: ExpenseStatus): void {
  if (!EXPENSE_TRANSITIONS[from].includes(to)) {
    throw conflict(`An expense claim that is ${from} cannot become ${to}`);
  }
}

/**
 * The expense date must not be in the future and must be within the claim window of the
 * company's today. Dates are `YYYY-MM-DD`, which compare correctly as text.
 */
export function assertClaimDate(expenseDate: string, today: string): void {
  if (expenseDate > today) {
    throw unprocessable('The expense date cannot be in the future');
  }
  if (expenseDate < minusDays(today, MAX_CLAIM_AGE_DAYS)) {
    throw unprocessable(`Claims must be made within ${MAX_CLAIM_AGE_DAYS} days of the expense`);
  }
}

/** Above the threshold a receipt is required before the claim can be submitted (D-17). */
export function assertReceiptRule(amountMinor: number, hasReceipt: boolean): void {
  if (amountMinor > RECEIPT_REQUIRED_ABOVE_MINOR && !hasReceipt) {
    throw unprocessable('A receipt is required for claims above 200.00 INR');
  }
}

function minusDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}
