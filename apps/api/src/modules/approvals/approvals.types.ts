import type { Role } from '@maxr/shared';
import type { PoolClient } from 'pg';

/** A step of the route. `manager` is the requester's manager; `hr` is an HR Manager (or Admin). */
export type ApprovalStage = 'manager' | 'hr';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalOutcome = 'approved' | 'rejected';

/** Every transition the engine allows. A status that is not a key here has no way out (terminal). */
export const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalStatus, readonly ApprovalStatus[]>> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: [],
  rejected: [],
  cancelled: [],
};

/**
 * The open transaction a decision runs in. Handlers use it for the module's own writes so they
 * commit or roll back with the decision. Only `query` is exposed.
 */
export type ApprovalTx = Pick<PoolClient, 'query'>;

export interface ApprovalDecision {
  stage: number;
  decidedByEmployeeId: string;
  outcome: ApprovalOutcome;
  comment: string | null;
  decidedAt: string;
}

export interface Approval {
  id: string;
  subjectType: string;
  subjectId: string;
  requesterEmployeeId: string;
  requesterName: string;
  /** The requester's manager now; null when they have none. */
  requesterManagerId: string | null;
  stages: ApprovalStage[];
  currentStage: number;
  status: ApprovalStatus;
  decisions: ApprovalDecision[];
  createdAt: string;
  decidedAt: string | null;
}

export interface SubmitApprovalInput {
  subjectType: string;
  subjectId: string;
  requesterEmployeeId: string;
  stages: ApprovalStage[];
}

export interface ApprovalFilters {
  status?: ApprovalStatus;
  subjectType?: string;
  /** Only approvals whose current stage the caller may decide. */
  awaitingMyDecision?: boolean;
}

export interface Decider {
  employeeId: string;
  roles: readonly Role[];
}

/**
 * What a module supplies for its subject type. It is called inside the decision transaction at
 * the end of the route (approved) or at any stage (rejected). Throwing rolls the whole decision
 * back: the approval stays pending and nothing the handler wrote is kept.
 */
export interface ApprovalHandler {
  subjectType: string;
  apply(
    tx: ApprovalTx,
    approval: Approval,
    outcome: ApprovalOutcome,
    decider: { employeeId: string },
  ): Promise<void>;
}

export interface RequesterContext {
  managerId: string | null;
  roles: Role[];
}
