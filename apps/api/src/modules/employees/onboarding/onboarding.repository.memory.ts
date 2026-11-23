import { DEFAULT_ONBOARDING_ITEMS } from './onboarding.rules';
import { IOnboardingRepository, OnboardingTx, ScopeFilter } from './onboarding.repository';
import {
  ListOnboardingQuery,
  OnboardingChecklistDetail,
  OnboardingChecklistSummary,
  OnboardingItem,
  OnboardingStatus,
  OnboardingStep,
  SetPasswordTokenRecord,
} from './onboarding.types';

export interface InMemoryUser {
  id: string;
  employeeId: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

export interface InMemoryEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  designationId: string;
  managerId: string | null;
  status: string;
  joiningDate: string;
}

export class InMemoryOnboardingRepository implements IOnboardingRepository {
  public checklists = new Map<string, OnboardingChecklistDetail>();
  public tokens = new Map<string, SetPasswordTokenRecord>();
  public employees = new Map<string, InMemoryEmployee>();
  public users = new Map<string, InMemoryUser>();

  async transaction<T>(work: (tx: OnboardingTx) => Promise<T>): Promise<T> {
    return work({} as OnboardingTx);
  }

  seedEmployee(emp: InMemoryEmployee, user?: InMemoryUser) {
    this.employees.set(emp.id, emp);
    if (user) {
      this.users.set(user.id, user);
    }
  }

  async listChecklists(
    scope: ScopeFilter,
    query: ListOnboardingQuery,
  ): Promise<{ data: OnboardingChecklistSummary[]; total: number }> {
    let list = Array.from(this.checklists.values());

    // Scope filtering
    if (scope.role === 'staff') {
      list = list.filter((c) => c.employeeId === scope.callerEmployeeId);
    } else if (scope.role === 'team_lead') {
      list = list.filter(
        (c) => c.managerId === scope.callerEmployeeId || c.employeeId === scope.callerEmployeeId,
      );
    }

    if (query.status) {
      list = list.filter((c) => c.status === query.status);
    }
    if (query.step) {
      list = list.filter((c) => c.currentStep === query.step);
    }
    if (query.departmentId) {
      list = list.filter((c) => c.departmentId === query.departmentId);
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.employeeCode.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      );
    }

    const total = list.length;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const paginated = list.slice(offset, offset + pageSize);

    return {
      data: paginated.map((c) => ({
        id: c.id,
        employeeId: c.employeeId,
        employeeCode: c.employeeCode,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        designationId: c.designationId,
        designationTitle: c.designationTitle,
        managerId: c.managerId,
        joiningDate: c.joiningDate,
        employeeStatus: c.employeeStatus,
        userActive: c.userActive,
        status: c.status,
        currentStep: c.currentStep,
        completedAt: c.completedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        totalItems: c.items.length,
        verifiedItems: c.items.filter((i) => i.isVerified).length,
      })),
      total,
    };
  }

  async getChecklistDetail(
    _tx: OnboardingTx | null,
    employeeId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    const found = Array.from(this.checklists.values()).find((c) => c.employeeId === employeeId);
    if (!found) return null;
    const emp = this.employees.get(employeeId);
    const user = Array.from(this.users.values()).find((u) => u.employeeId === employeeId);
    return {
      ...found,
      employeeStatus: emp?.status ?? found.employeeStatus,
      userActive: user?.isActive ?? found.userActive,
    };
  }

  async getChecklistDetailByUserId(
    _tx: OnboardingTx | null,
    userId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    const user = this.users.get(userId);
    if (!user) return null;
    return this.getChecklistDetail(_tx, user.employeeId);
  }

  async ensureChecklist(_tx: OnboardingTx, employeeId: string): Promise<OnboardingChecklistDetail> {
    const existing = await this.getChecklistDetail(_tx, employeeId);
    if (existing) return existing;

    const emp = this.employees.get(employeeId) ?? {
      id: employeeId,
      employeeCode: 'EMP-TEMP',
      firstName: 'Test',
      lastName: 'Employee',
      email: 'test@example.com',
      departmentId: '00000000-0000-0000-0000-000000000001',
      designationId: '00000000-0000-0000-0000-000000000002',
      managerId: null,
      status: 'pending',
      joiningDate: '2026-11-01',
    };

    const user = Array.from(this.users.values()).find((u) => u.employeeId === employeeId);
    const checklistId = `chk-${employeeId}`;
    const now = new Date();

    const items: OnboardingItem[] = DEFAULT_ONBOARDING_ITEMS.map((def, idx) => ({
      id: `item-${checklistId}-${idx}`,
      checklistId,
      step: def.step,
      itemKey: def.itemKey,
      title: def.title,
      description: def.description,
      isVerified: Boolean(def.autoVerified),
      verifiedAt: def.autoVerified ? now : null,
      verifiedBy: def.autoVerified ? 'system' : null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    }));

    const detail: OnboardingChecklistDetail = {
      id: checklistId,
      employeeId,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      departmentId: emp.departmentId,
      departmentName: 'Engineering',
      designationId: emp.designationId,
      designationTitle: 'Software Engineer',
      managerId: emp.managerId,
      joiningDate: emp.joiningDate,
      employeeStatus: emp.status,
      userActive: user?.isActive ?? false,
      status: 'in_progress',
      currentStep: 'hr',
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      totalItems: items.length,
      verifiedItems: items.filter((i) => i.isVerified).length,
      items,
    };

    this.checklists.set(checklistId, detail);
    return detail;
  }

  async findUserByEmployeeId(
    _tx: OnboardingTx,
    employeeId: string,
  ): Promise<{ id: string; email: string } | null> {
    const user = Array.from(this.users.values()).find((u) => u.employeeId === employeeId);
    if (!user) return null;
    return { id: user.id, email: user.email };
  }

  async lockChecklist(
    _tx: OnboardingTx,
    employeeId: string,
  ): Promise<OnboardingChecklistDetail | null> {
    await this.ensureChecklist(_tx, employeeId);
    return this.getChecklistDetail(_tx, employeeId);
  }

  async verifyItem(
    _tx: OnboardingTx,
    checklistId: string,
    itemKey: string,
    verifiedBy: string,
    notes?: string,
  ): Promise<OnboardingItem> {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) throw new Error('Checklist not found');
    const item = checklist.items.find((i) => i.itemKey === itemKey);
    if (!item) throw new Error('Item not found');

    item.isVerified = true;
    item.verifiedAt = new Date();
    item.verifiedBy = verifiedBy;
    if (notes) item.notes = notes;
    item.updatedAt = new Date();
    checklist.verifiedItems = checklist.items.filter((i) => i.isVerified).length;
    return item;
  }

  async unverifyItem(
    _tx: OnboardingTx,
    checklistId: string,
    itemKey: string,
  ): Promise<OnboardingItem> {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) throw new Error('Checklist not found');
    const item = checklist.items.find((i) => i.itemKey === itemKey);
    if (!item) throw new Error('Item not found');

    item.isVerified = false;
    item.verifiedAt = null;
    item.verifiedBy = null;
    item.updatedAt = new Date();
    checklist.verifiedItems = checklist.items.filter((i) => i.isVerified).length;
    return item;
  }

  async updateChecklistState(
    _tx: OnboardingTx,
    checklistId: string,
    step: OnboardingStep,
    status: OnboardingStatus,
    completedAt?: Date | null,
  ): Promise<void> {
    const checklist = this.checklists.get(checklistId);
    if (!checklist) return;
    checklist.currentStep = step;
    checklist.status = status;
    checklist.completedAt = completedAt ?? null;
    checklist.updatedAt = new Date();
  }

  async activateAccount(_tx: OnboardingTx, employeeId: string): Promise<void> {
    const emp = this.employees.get(employeeId);
    if (emp) emp.status = 'active';
    const user = Array.from(this.users.values()).find((u) => u.employeeId === employeeId);
    if (user) user.isActive = true;
  }

  async reopenAccount(_tx: OnboardingTx, employeeId: string): Promise<{ userId: string }> {
    const emp = this.employees.get(employeeId);
    if (emp) emp.status = 'pending';
    const user = Array.from(this.users.values()).find((u) => u.employeeId === employeeId);
    if (user) user.isActive = false;
    return { userId: user?.id ?? 'unknown' };
  }

  async createSetPasswordToken(
    _tx: OnboardingTx,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    this.tokens.set(tokenHash, {
      id: `tok-${tokenHash.slice(0, 8)}`,
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });
  }

  async findValidSetPasswordToken(
    _tx: OnboardingTx,
    tokenHash: string,
  ): Promise<{ id: string; userId: string; employeeId: string; email: string } | null> {
    const tok = this.tokens.get(tokenHash);
    if (!tok) return null;
    if (tok.usedAt) return null;
    if (tok.expiresAt.getTime() < Date.now()) return null;

    const user = this.users.get(tok.userId);
    if (!user) return null;

    return {
      id: tok.id,
      userId: user.id,
      employeeId: user.employeeId,
      email: user.email,
    };
  }

  async consumeSetPasswordToken(
    _tx: OnboardingTx,
    tokenId: string,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    for (const tok of this.tokens.values()) {
      if (tok.id === tokenId) {
        tok.usedAt = new Date();
      }
    }
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}
