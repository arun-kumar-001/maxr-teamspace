import { ScopeFilter, scopeAllows } from '../../rbac';
import { ReferenceIds, ReferenceRows } from '../references';
import { IEmployeeDetailRepository } from './detail.repository';
import { DetailTx, EditableEmployee, EmployeeDetail, EmployeePatch } from './detail.types';

export interface MemoryEmployee {
  detail: EmployeeDetail;
  managerId: string | null;
}

/** In-memory twin for unit and HTTP tests (not shipped in the build). */
export class MemoryEmployeeDetailRepository implements IEmployeeDetailRepository {
  /** Test knob standing in for the departments, designations and employees tables. */
  public references: ReferenceRows = {
    department: { isActive: true },
    designation: { isActive: true, departmentId: '' },
    manager: null,
  };
  /** Makes `applyPatch` fail after changing the row, to prove nothing is kept. */
  public failAfterPatch: Error | null = null;

  constructor(public employees: MemoryEmployee[] = []) {}

  async transaction<T>(work: (tx: DetailTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.employees);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as DetailTx);
    } catch (err) {
      this.employees = snapshot;
      throw err;
    }
  }

  private find(id: string): MemoryEmployee | undefined {
    return this.employees.find((e) => e.detail.id === id);
  }

  private view(entry: MemoryEmployee, withAccount: boolean): EmployeeDetail {
    const copy = structuredClone(entry.detail);
    if (!withAccount) delete copy.account;
    return copy;
  }

  async findById(id: string, filter: ScopeFilter, withAccount: boolean) {
    const entry = this.find(id);
    return entry && scopeAllows(filter, entry.detail.id, entry.managerId)
      ? this.view(entry, withAccount)
      : null;
  }

  async load(_tx: DetailTx, id: string, withAccount: boolean): Promise<EmployeeDetail> {
    const entry = this.find(id);
    if (!entry) throw new Error(`Employee ${id} not found`);
    return this.view(entry, withAccount);
  }

  async lockEditable(_tx: DetailTx, id: string): Promise<EditableEmployee | null> {
    const entry = this.find(id);
    if (!entry) return null;
    const d = entry.detail;
    return {
      id: d.id,
      status: d.status,
      version: d.version,
      managerId: entry.managerId,
      employeeCode: d.employeeCode,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      departmentId: d.department.id,
      designationId: d.designation.id,
      joiningDate: d.joiningDate,
    };
  }

  async lockReferences(_tx: DetailTx, ids: ReferenceIds): Promise<ReferenceRows> {
    return {
      department: this.references.department,
      designation: this.references.designation && {
        ...this.references.designation,
        departmentId: this.references.designation.departmentId || ids.departmentId,
      },
      manager: null,
    };
  }

  async isTaken(
    _tx: DetailTx,
    taken: { employeeCode?: string; email?: string },
    excludeId: string,
  ) {
    const others = this.employees.filter((e) => e.detail.id !== excludeId);
    return {
      employeeCode:
        taken.employeeCode !== undefined &&
        others.some(
          (e) => e.detail.employeeCode.toLowerCase() === taken.employeeCode?.toLowerCase(),
        ),
      email:
        taken.email !== undefined &&
        others.some((e) => e.detail.email.toLowerCase() === taken.email?.toLowerCase()),
    };
  }

  async applyPatch(_tx: DetailTx, id: string, patch: EmployeePatch): Promise<void> {
    const entry = this.find(id);
    if (!entry) throw new Error(`Employee ${id} not found`);
    const d = entry.detail;
    if (patch.employeeCode !== undefined) d.employeeCode = patch.employeeCode;
    if (patch.firstName !== undefined) d.firstName = patch.firstName;
    if (patch.lastName !== undefined) d.lastName = patch.lastName;
    if (patch.email !== undefined) d.email = patch.email;
    if (patch.phone !== undefined) d.phone = patch.phone;
    if (patch.joiningDate !== undefined) d.joiningDate = patch.joiningDate;
    if (patch.departmentId !== undefined)
      d.department = { ...d.department, id: patch.departmentId };
    if (patch.designationId !== undefined) {
      d.designation = { ...d.designation, id: patch.designationId };
    }
    // What the database trigger does on every update.
    d.version += 1;
    d.updatedAt = new Date().toISOString();
    if (this.failAfterPatch) throw this.failAfterPatch;
  }
}
