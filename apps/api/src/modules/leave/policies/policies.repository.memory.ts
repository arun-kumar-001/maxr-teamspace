import { randomUUID } from 'node:crypto';
import { conflict } from '../../../http/errors';
import { ILeavePoliciesRepository } from './policies.repository';
import { LeavePolicy, LeavePolicyValues, LeaveTx, NewLeavePolicy } from './policies.types';

/** In-memory leave policies for unit and HTTP tests (not shipped in the build). */
export class MemoryLeavePoliciesRepository implements ILeavePoliciesRepository {
  constructor(public policies: LeavePolicy[] = []) {}

  /** Snapshot/restore stands in for a database rollback. */
  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.policies);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as LeaveTx);
    } catch (err) {
      this.policies = snapshot;
      throw err;
    }
  }

  async list(): Promise<LeavePolicy[]> {
    return this.policies.map((p) => ({ ...p }));
  }

  async findForUpdate(_tx: LeaveTx, id: string): Promise<LeavePolicy | null> {
    const found = this.policies.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  async insert(_tx: LeaveTx, input: NewLeavePolicy): Promise<LeavePolicy> {
    if (
      this.policies.some(
        (p) => p.code === input.code || p.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw conflict('A leave type with this code or name already exists');
    }
    const policy: LeavePolicy = {
      id: randomUUID(),
      ...input,
      isActive: true,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.policies.push(policy);
    return { ...policy };
  }

  async update(_tx: LeaveTx, id: string, values: LeavePolicyValues): Promise<LeavePolicy> {
    const found = this.policies.find((p) => p.id === id) as LeavePolicy;
    if (
      this.policies.some((p) => p.id !== id && p.name.toLowerCase() === values.name.toLowerCase())
    ) {
      throw conflict('A leave type with this name already exists');
    }
    Object.assign(found, values, {
      version: found.version + 1,
      updatedAt: new Date().toISOString(),
    });
    return { ...found };
  }
}
