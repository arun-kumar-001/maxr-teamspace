import { randomUUID } from 'node:crypto';
import { IEmployeeCreationRepository } from './creation.repository';
import {
  CreateEmployeeDto,
  CreatedEmployee,
  CreationTx,
  ExistingIdentity,
  ReferenceRows,
} from './creation.types';

/** In-memory twin for unit and HTTP tests (not shipped in the build). */
export class MemoryEmployeeCreationRepository implements IEmployeeCreationRepository {
  public employees: CreatedEmployee[] = [];
  public passwordHashes: string[] = [];
  /** Test knobs standing in for the departments, designations and employees tables. */
  public references: ReferenceRows = {
    department: { isActive: true },
    designation: { isActive: true, departmentId: '' },
    manager: { status: 'active' },
  };
  /** Makes `insertAccount` fail after storing the employee, to prove nothing is kept. */
  public failAfterEmployee: Error | null = null;

  async transaction<T>(work: (tx: CreationTx) => Promise<T>): Promise<T> {
    const employees = structuredClone(this.employees);
    const hashes = [...this.passwordHashes];
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as CreationTx);
    } catch (err) {
      this.employees = employees;
      this.passwordHashes = hashes;
      throw err;
    }
  }

  async lockReferences(
    _tx: CreationTx,
    ids: { departmentId: string; designationId: string; managerId?: string },
  ): Promise<ReferenceRows> {
    return {
      department: this.references.department,
      designation: this.references.designation && {
        ...this.references.designation,
        departmentId: this.references.designation.departmentId || ids.departmentId,
      },
      manager: ids.managerId ? this.references.manager : null,
    };
  }

  async findExisting(_tx: CreationTx, code: string, email: string): Promise<ExistingIdentity> {
    return {
      employeeCode: this.employees.some((e) => e.employeeCode.toLowerCase() === code.toLowerCase()),
      email: this.employees.some((e) => e.email.toLowerCase() === email.toLowerCase()),
    };
  }

  async insertAccount(
    _tx: CreationTx,
    dto: CreateEmployeeDto,
    passwordHash: string,
  ): Promise<CreatedEmployee> {
    const created: CreatedEmployee = {
      id: randomUUID(),
      userId: randomUUID(),
      employeeCode: dto.employeeCode,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone ?? null,
      departmentId: dto.departmentId,
      designationId: dto.designationId,
      managerId: dto.managerId ?? null,
      status: 'pending',
      role: dto.role,
      joiningDate: dto.joiningDate,
      createdAt: new Date().toISOString(),
    };
    this.employees.push(created);
    this.passwordHashes.push(passwordHash);
    if (this.failAfterEmployee) throw this.failAfterEmployee;
    return created;
  }
}
