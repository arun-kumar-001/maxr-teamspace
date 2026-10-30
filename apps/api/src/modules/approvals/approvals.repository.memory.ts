import { randomUUID } from 'node:crypto';
import { ScopeFilter, scopeAllows } from '../rbac';
import { denialReason } from './approval-rules';
import {
  FindApprovalsParams,
  IApprovalsRepository,
  SaveDecisionInput,
} from './approvals.repository';
import { Approval, ApprovalTx, RequesterContext, SubmitApprovalInput } from './approvals.types';

/** In-memory approvals for unit and HTTP tests (not shipped in the build). */
export class MemoryApprovalsRepository implements IApprovalsRepository {
  constructor(
    public approvals: Approval[] = [],
    /** Employee id -> manager and roles, standing in for the employees and user_roles tables. */
    public requesters: Record<string, RequesterContext & { name: string }> = {},
  ) {}

  /** Snapshot/restore stands in for a database rollback. */
  async transaction<T>(work: (tx: ApprovalTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.approvals);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as ApprovalTx);
    } catch (err) {
      this.approvals = snapshot;
      throw err;
    }
  }

  async getRequesterContext(_tx: ApprovalTx, employeeId: string) {
    return this.requesters[employeeId] ?? null;
  }

  async insert(_tx: ApprovalTx, input: SubmitApprovalInput): Promise<Approval> {
    if (
      this.approvals.some(
        (a) => a.subjectType === input.subjectType && a.subjectId === input.subjectId,
      )
    ) {
      throw new Error('duplicate key value violates unique constraint approvals_subject_unique');
    }
    const requester = this.requesters[input.requesterEmployeeId];
    const approval: Approval = {
      id: randomUUID(),
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      requesterEmployeeId: input.requesterEmployeeId,
      requesterName: requester?.name ?? '',
      requesterManagerId: requester?.managerId ?? null,
      stages: input.stages,
      currentStage: 0,
      status: 'pending',
      decisions: [],
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    this.approvals.push(approval);
    return structuredClone(approval);
  }

  async findById(id: string, filter: ScopeFilter): Promise<Approval | null> {
    const found = this.approvals.find((a) => a.id === id);
    return found && scopeAllows(filter, found.requesterEmployeeId, found.requesterManagerId)
      ? structuredClone(found)
      : null;
  }

  async findMany(p: FindApprovalsParams) {
    const matching = this.approvals
      .filter(
        (a) =>
          scopeAllows(p.filter, a.requesterEmployeeId, a.requesterManagerId) &&
          (!p.status || a.status === p.status) &&
          (!p.subjectType || a.subjectType === p.subjectType) &&
          (!p.awaiting ||
            denialReason(a, {
              employeeId: p.awaiting.employeeId,
              roles: p.awaiting.hr ? ['hr_manager'] : [],
            }) === null),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return {
      items: structuredClone(matching.slice(p.offset, p.offset + p.limit)),
      total: matching.length,
    };
  }

  async lockById(_tx: ApprovalTx, id: string): Promise<Approval | null> {
    return this.copyOrNull(this.approvals.find((a) => a.id === id));
  }

  async lockBySubject(_tx: ApprovalTx, subjectType: string, subjectId: string) {
    return (
      this.approvals.find((a) => a.subjectType === subjectType && a.subjectId === subjectId) ?? null
    );
  }

  async saveDecision(_tx: ApprovalTx, id: string, input: SaveDecisionInput): Promise<Approval> {
    const approval = this.must(id);
    const now = new Date().toISOString();
    approval.decisions.push({
      stage: input.stage,
      decidedByEmployeeId: input.deciderEmployeeId,
      outcome: input.outcome,
      comment: input.comment,
      decidedAt: now,
    });
    approval.status = input.status;
    approval.currentStage = input.nextStage;
    approval.decidedAt = input.status === 'pending' ? null : now;
    return structuredClone(approval);
  }

  async markCancelled(_tx: ApprovalTx, id: string): Promise<Approval> {
    const approval = this.must(id);
    approval.status = 'cancelled';
    approval.decidedAt = new Date().toISOString();
    return structuredClone(approval);
  }

  /** Reads return copies, as a database would: a caller's old value does not change under it. */
  private copyOrNull(approval: Approval | undefined): Approval | null {
    return approval ? structuredClone(approval) : null;
  }

  private must(id: string): Approval {
    const approval = this.approvals.find((a) => a.id === id);
    if (!approval) throw new Error(`Approval ${id} not found`);
    return approval;
  }
}
