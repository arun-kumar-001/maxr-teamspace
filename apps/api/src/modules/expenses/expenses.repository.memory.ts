import { randomUUID } from 'crypto';
import { ExpenseStatus } from '@maxr/shared';
import { ScopeFilter, scopeAllows } from '../rbac';
import type {
  ExpenseCategory,
  ExpenseClaim,
  ExpenseTx,
  IExpensesRepository,
  ListExpenseClaimsQuery,
} from './expenses.types';

export interface InMemoryEmployee {
  id: string;
  name: string;
  code: string;
  managerId: string | null;
}

export class InMemoryExpensesRepository implements IExpensesRepository {
  private categories = new Map<string, ExpenseCategory>();
  private claims = new Map<string, ExpenseClaim>();
  private employees = new Map<string, InMemoryEmployee>();

  constructor(initial?: {
    categories?: ExpenseCategory[];
    claims?: ExpenseClaim[];
    employees?: InMemoryEmployee[];
  }) {
    if (initial?.categories) {
      for (const cat of initial.categories) {
        this.categories.set(cat.id, { ...cat });
      }
    } else {
      // Seed default categories
      const defaults = [
        {
          id: '50000000-0000-4000-a000-000000000001',
          name: 'Travel',
          description: 'Travel expenses',
          isActive: true,
        },
        {
          id: '50000000-0000-4000-a000-000000000002',
          name: 'Meals',
          description: 'Food and dining',
          isActive: true,
        },
        {
          id: '50000000-0000-4000-a000-000000000003',
          name: 'Accommodation',
          description: 'Hotel and lodging',
          isActive: true,
        },
        {
          id: '50000000-0000-4000-a000-000000000004',
          name: 'Office supplies',
          description: 'Stationery',
          isActive: true,
        },
        {
          id: '50000000-0000-4000-a000-000000000005',
          name: 'Client entertainment',
          description: 'Client dinners',
          isActive: true,
        },
        {
          id: '50000000-0000-4000-a000-000000000006',
          name: 'Other',
          description: 'Miscellaneous',
          isActive: true,
        },
      ];
      for (const d of defaults) {
        this.categories.set(d.id, {
          ...d,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (initial?.claims) {
      for (const c of initial.claims) {
        this.claims.set(c.id, { ...c });
      }
    }

    if (initial?.employees) {
      for (const emp of initial.employees) {
        this.employees.set(emp.id, { ...emp });
      }
    }
  }

  setEmployee(emp: InMemoryEmployee): void {
    this.employees.set(emp.id, emp);
  }

  async transaction<T>(fn: (tx: ExpenseTx) => Promise<T>): Promise<T> {
    const fakeTx: ExpenseTx = {
      query: (async () => ({
        rows: [],
        rowCount: 0,
        command: '',
        oid: 0,
        fields: [],
      })) as unknown as ExpenseTx['query'],
    };
    return fn(fakeTx);
  }

  async findCategoryById(_tx: ExpenseTx, id: string): Promise<ExpenseCategory | null> {
    const cat = this.categories.get(id);
    return cat ? { ...cat } : null;
  }

  async listCategories(_tx: ExpenseTx, activeOnly = true): Promise<ExpenseCategory[]> {
    return Array.from(this.categories.values())
      .filter((c) => !activeOnly || c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(
    _tx: ExpenseTx,
    input: { name: string; description?: string | null },
  ): Promise<ExpenseCategory> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const created: ExpenseCategory = {
      id,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.categories.set(id, created);
    return { ...created };
  }

  async updateCategory(
    _tx: ExpenseTx,
    id: string,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ): Promise<ExpenseCategory | null> {
    const existing = this.categories.get(id);
    if (!existing) return null;

    const updated: ExpenseCategory = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date().toISOString(),
    };
    this.categories.set(id, updated);
    return { ...updated };
  }

  async findClaimById(
    _tx: ExpenseTx,
    id: string,
    filter?: ScopeFilter,
  ): Promise<ExpenseClaim | null> {
    const claim = this.claims.get(id);
    if (!claim) return null;

    if (filter) {
      const emp = this.employees.get(claim.employeeId);
      if (!scopeAllows(filter, claim.employeeId, emp?.managerId)) {
        return null;
      }
    }

    return { ...claim };
  }

  async findManyClaims(
    _tx: ExpenseTx,
    query: ListExpenseClaimsQuery,
    filter: ScopeFilter,
  ): Promise<{ items: ExpenseClaim[]; total: number }> {
    const all = Array.from(this.claims.values()).filter((c) => {
      const emp = this.employees.get(c.employeeId);
      if (!scopeAllows(filter, c.employeeId, emp?.managerId)) return false;
      if (query.employeeId && c.employeeId !== query.employeeId) return false;
      if (query.status && c.status !== query.status) return false;
      if (query.categoryId && c.categoryId !== query.categoryId) return false;
      if (query.from && c.expenseDate < query.from) return false;
      if (query.to && c.expenseDate > query.to) return false;
      return true;
    });

    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = all.length;
    const offset = (query.page - 1) * query.pageSize;
    const items = all.slice(offset, offset + query.pageSize).map((c) => ({ ...c }));

    return { items, total };
  }

  async createClaim(
    _tx: ExpenseTx,
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
    const id = claim.id ?? randomUUID();
    const emp = this.employees.get(claim.employeeId);
    const cat = this.categories.get(claim.categoryId);
    const now = new Date().toISOString();

    const created: ExpenseClaim = {
      id,
      employeeId: claim.employeeId,
      employeeName: emp?.name ?? 'Employee Name',
      employeeCode: emp?.code ?? 'EMP001',
      categoryId: claim.categoryId,
      categoryName: cat?.name ?? 'Category',
      amountPaise: claim.amountPaise,
      currency: claim.currency ?? 'INR',
      expenseDate: claim.expenseDate,
      description: claim.description,
      receiptStorageKey: claim.receiptStorageKey ?? null,
      receiptFilename: claim.receiptFilename ?? null,
      receiptMimeType: claim.receiptMimeType ?? null,
      receiptFileSize: claim.receiptFileSize ?? null,
      status: claim.status ?? 'submitted',
      rejectionReason: null,
      reimbursedAt: null,
      reimbursedByEmployeeId: null,
      reimbursedByName: null,
      createdAt: now,
      updatedAt: now,
    };

    this.claims.set(id, created);
    return { ...created };
  }

  async updateClaimStatus(
    _tx: ExpenseTx,
    id: string,
    status: ExpenseStatus,
    extra?: {
      rejectionReason?: string | null;
      reimbursedAt?: string | null;
      reimbursedByEmployeeId?: string | null;
    },
  ): Promise<ExpenseClaim | null> {
    const existing = this.claims.get(id);
    if (!existing) return null;

    let reimbursedByName = existing.reimbursedByName;
    if (extra?.reimbursedByEmployeeId) {
      const re = this.employees.get(extra.reimbursedByEmployeeId);
      reimbursedByName = re?.name ?? null;
    }

    const updated: ExpenseClaim = {
      ...existing,
      status,
      rejectionReason: extra?.rejectionReason ?? existing.rejectionReason,
      reimbursedAt: extra?.reimbursedAt ?? existing.reimbursedAt,
      reimbursedByEmployeeId: extra?.reimbursedByEmployeeId ?? existing.reimbursedByEmployeeId,
      reimbursedByName,
      updatedAt: new Date().toISOString(),
    };

    this.claims.set(id, updated);
    return { ...updated };
  }
}
