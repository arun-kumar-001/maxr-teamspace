import { IDeactivationRepository } from './deactivation.repository';
import {
  DeactivationRecord,
  DeactivationTarget,
  DeactivationTx,
  DirectReport,
} from './deactivation.types';

export interface MemoryPerson extends DeactivationTarget {
  managerId: string | null;
  employeeCode: string;
  name: string;
  version: number;
  deactivatedAt: string | null;
}

/** In-memory twin for unit and HTTP tests (not shipped in the build). */
export class MemoryDeactivationRepository implements IDeactivationRepository {
  /** Called after an account is switched off, so a test can mirror it in its own auth fake. */
  public onAccountDeactivated: (userId: string) => void = () => undefined;
  /** Makes `deactivate` fail after changing the row, to prove nothing is kept. */
  public failAfterDeactivate: Error | null = null;

  constructor(public people: MemoryPerson[] = []) {}

  async transaction<T>(work: (tx: DeactivationTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.people);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as DeactivationTx);
    } catch (err) {
      this.people = snapshot;
      throw err;
    }
  }

  async lockAdminRole(): Promise<void> {}

  private find(employeeId: string): MemoryPerson | undefined {
    return this.people.find((p) => p.employeeId === employeeId);
  }

  async lockTarget(_tx: DeactivationTx, employeeId: string): Promise<DeactivationTarget | null> {
    const p = this.find(employeeId);
    return p
      ? {
          employeeId: p.employeeId,
          status: p.status,
          userId: p.userId,
          userActive: p.userActive,
          holdsAdminRole: p.holdsAdminRole,
        }
      : null;
  }

  async countOtherActiveAdmins(_tx: DeactivationTx, excludeUserId: string): Promise<number> {
    return this.people.filter(
      (p) =>
        p.userId !== excludeUserId && p.userActive && p.holdsAdminRole && p.status === 'active',
    ).length;
  }

  async deactivate(_tx: DeactivationTx, target: DeactivationTarget): Promise<DeactivationRecord> {
    const p = this.find(target.employeeId) as MemoryPerson;
    p.status = 'deactivated';
    p.userActive = false;
    p.version += 1;
    p.deactivatedAt = new Date().toISOString();
    if (p.userId) this.onAccountDeactivated(p.userId);
    if (this.failAfterDeactivate) throw this.failAfterDeactivate;
    return { deactivatedAt: p.deactivatedAt, version: p.version };
  }

  async readRecord(_tx: DeactivationTx, employeeId: string): Promise<DeactivationRecord> {
    const p = this.find(employeeId) as MemoryPerson;
    return { deactivatedAt: p.deactivatedAt ?? new Date().toISOString(), version: p.version };
  }

  async listDirectReports(_tx: DeactivationTx, employeeId: string): Promise<DirectReport[]> {
    return this.people
      .filter((p) => p.managerId === employeeId && p.status !== 'deactivated')
      .map((p) => ({ id: p.employeeId, employeeCode: p.employeeCode, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
}
