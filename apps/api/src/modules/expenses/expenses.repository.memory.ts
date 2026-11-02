import { randomUUID } from 'crypto';
import { conflict } from '../../http/errors';
import { ScopeFilter, scopeAllows } from '../rbac';
import {
  ExpenseCategory,
  ExpenseClaimRecord,
  ExpenseStatus,
  ExpenseTx,
  NewExpenseClaim,
  NewReceipt,
} from './expenses.types';
import type {
  FindExpenseClaimsParams,
  IExpensesRepository,
  NewExpenseCategory,
} from './expenses.repository';

/** Test double with the same rules as the SQL: scope by employee and manager, status and timestamps. */
export class MemoryExpensesRepository implements IExpensesRepository {
  readonly categories = new Map<string, ExpenseCategory>();
  readonly claims = new Map<string, ExpenseClaimRecord>();
  /** Employee names and manager ids, which the SQL reads from `employees`. */
  readonly names: Record<string, string> = {};
  readonly managerOf: Record<string, string | null> = {};

  constructor(seedCategories: ExpenseCategory[] = []) {
    for (const category of seedCategories) this.categories.set(category.id, category);
  }

  async transaction<T>(work: (tx: ExpenseTx) => Promise<T>): Promise<T> {
    return work({ query: async () => ({ rows: [], rowCount: 0 }) } as unknown as ExpenseTx);
  }

  async listActiveCategories(): Promise<ExpenseCategory[]> {
    return [...this.categories.values()]
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findCategory(id: string): Promise<ExpenseCategory | null> {
    return this.categories.get(id) ?? null;
  }

  async insertCategory(input: NewExpenseCategory): Promise<ExpenseCategory> {
    if ([...this.categories.values()].some((c) => c.code === input.code)) {
      throw conflict('An expense category with this code already exists');
    }
    const category = { id: randomUUID(), code: input.code, name: input.name, isActive: true };
    this.categories.set(category.id, category);
    return category;
  }

  async setCategoryActive(id: string, isActive: boolean): Promise<ExpenseCategory | null> {
    const category = this.categories.get(id);
    if (!category) return null;
    const updated = { ...category, isActive };
    this.categories.set(id, updated);
    return updated;
  }

  async insertClaim(_tx: ExpenseTx, input: NewExpenseClaim): Promise<ExpenseClaimRecord> {
    const category = this.categories.get(input.categoryId);
    if (!category) throw new Error('The category must exist before a claim uses it');
    const now = new Date().toISOString();
    const claim: ExpenseClaimRecord = {
      id: randomUUID(),
      employeeId: input.employeeId,
      employeeName: this.names[input.employeeId] ?? 'Unknown',
      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,
      expenseDate: input.expenseDate,
      amountMinor: input.amountMinor,
      currency: 'INR',
      description: input.description,
      status: 'draft',
      receipt: null,
      receiptKey: null,
      approvalId: null,
      submittedAt: null,
      decidedAt: null,
      reimbursedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.claims.set(claim.id, claim);
    return claim;
  }

  async findForUpdate(_tx: ExpenseTx, id: string): Promise<ExpenseClaimRecord | null> {
    return this.claims.get(id) ?? null;
  }

  async attachReceipt(_tx: ExpenseTx, id: string, receipt: NewReceipt): Promise<boolean> {
    const claim = this.claims.get(id);
    if (!claim || claim.status !== 'draft') return false;
    this.claims.set(id, {
      ...claim,
      receiptKey: receipt.key,
      receipt: { name: receipt.name, contentType: receipt.contentType, size: receipt.size },
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  async setStatus(_tx: ExpenseTx, id: string, status: ExpenseStatus): Promise<void> {
    const claim = this.claims.get(id);
    if (!claim) return;
    const now = new Date().toISOString();
    this.claims.set(id, {
      ...claim,
      status,
      submittedAt: status === 'submitted' ? now : claim.submittedAt,
      decidedAt: status === 'approved' || status === 'rejected' ? now : claim.decidedAt,
      reimbursedAt: status === 'reimbursed' ? now : claim.reimbursedAt,
      updatedAt: now,
    });
  }

  async find(id: string, filter: ScopeFilter): Promise<ExpenseClaimRecord | null> {
    const claim = this.claims.get(id);
    if (!claim || !this.inScope(claim, filter)) return null;
    return claim;
  }

  async findMany(
    params: FindExpenseClaimsParams,
  ): Promise<{ items: ExpenseClaimRecord[]; total: number }> {
    const matching = [...this.claims.values()]
      .filter((c) => this.inScope(c, params.filter))
      .filter((c) => !params.employeeId || c.employeeId === params.employeeId)
      .filter((c) => !params.status || c.status === params.status)
      .sort(
        (a, b) =>
          b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt),
      );
    return {
      items: matching.slice(params.offset, params.offset + params.limit),
      total: matching.length,
    };
  }

  private inScope(claim: ExpenseClaimRecord, filter: ScopeFilter): boolean {
    return scopeAllows(filter, claim.employeeId, this.managerOf[claim.employeeId] ?? null);
  }
}
