import { ScopeFilter, scopeAllows } from '../../rbac';
import { IHierarchyRepository } from './hierarchy.repository';
import {
  EmployeeStatus,
  HierarchyTx,
  ManagedEmployee,
  ManagerChange,
  OrgListParams,
  OrgNode,
} from './hierarchy.types';

export interface MemoryNode {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  status: EmployeeStatus;
  version: number;
  managerId: string | null;
}

/** In-memory twin for unit and HTTP tests (not shipped in the build). */
export class MemoryHierarchyRepository implements IHierarchyRepository {
  /** Makes `setManager` fail after changing the row, to prove nothing is kept. */
  public failAfterSet: Error | null = null;
  public locked = 0;

  constructor(public nodes: MemoryNode[] = []) {}

  async transaction<T>(work: (tx: HierarchyTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.nodes);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as HierarchyTx);
    } catch (err) {
      this.nodes = snapshot;
      throw err;
    }
  }

  async lockHierarchy(): Promise<void> {
    this.locked += 1;
  }

  private find(id: string): MemoryNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  async lockEmployee(_tx: HierarchyTx, id: string): Promise<ManagedEmployee | null> {
    const n = this.find(id);
    return n ? { id: n.id, status: n.status, version: n.version, managerId: n.managerId } : null;
  }

  async findManager(_tx: HierarchyTx, id: string) {
    const n = this.find(id);
    return n ? { status: n.status } : null;
  }

  async isSelfOrDescendant(_tx: HierarchyTx, ancestorId: string, candidateId: string) {
    const seen = new Set<string>();
    let current: string | null = candidateId;
    while (current && !seen.has(current)) {
      if (current === ancestorId) return true;
      seen.add(current);
      current = this.find(current)?.managerId ?? null;
    }
    return false;
  }

  async setManager(_tx: HierarchyTx, id: string, managerId: string | null): Promise<void> {
    const n = this.find(id) as MemoryNode;
    n.managerId = managerId;
    n.version += 1;
    if (this.failAfterSet) throw this.failAfterSet;
  }

  async loadChange(_tx: HierarchyTx, id: string): Promise<ManagerChange> {
    const n = this.find(id) as MemoryNode;
    const m = n.managerId ? this.find(n.managerId) : undefined;
    return {
      id: n.id,
      managerId: n.managerId,
      manager: m ? { id: m.id, employeeCode: m.employeeCode, name: m.name } : null,
      version: n.version,
    };
  }

  async isVisible(id: string, filter: ScopeFilter, selfId: string): Promise<boolean> {
    if (id === selfId) return true;
    const n = this.find(id);
    return !!n && scopeAllows(filter, n.id, n.managerId);
  }

  async listNodes(params: OrgListParams, filter: ScopeFilter) {
    const matching = this.nodes
      .filter(
        (n) =>
          scopeAllows(filter, n.id, n.managerId) &&
          n.managerId === params.managerId &&
          (params.status ? n.status === params.status : n.status !== 'deactivated'),
      )
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const page: OrgNode[] = matching
      .slice(params.offset, params.offset + params.limit)
      .map((n) => ({
        id: n.id,
        employeeCode: n.employeeCode,
        name: n.name,
        designation: n.designation,
        status: n.status,
        directReportCount: this.nodes.filter(
          (r) => r.managerId === n.id && r.status !== 'deactivated',
        ).length,
      }));
    return { items: page, total: matching.length };
  }
}
