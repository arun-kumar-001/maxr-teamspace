export type ApprovalStage = 'manager' | 'hr';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalOutcome = 'approved' | 'rejected';

export interface ApprovalDecision {
  stage: number;
  decidedByEmployeeId: string;
  outcome: ApprovalOutcome;
  comment: string | null;
  decidedAt: string;
}

export interface Approval extends Record<string, unknown> {
  id: string;
  subjectType: string;
  subjectId: string;
  requesterEmployeeId: string;
  requesterName: string;
  requesterManagerId?: string | null;
  stages: ApprovalStage[];
  currentStage: number;
  status: ApprovalStatus;
  decisions: ApprovalDecision[];
  createdAt: string;
  decidedAt: string | null;
}

export interface ApprovalFilters {
  status?: ApprovalStatus;
  subjectType?: string;
  awaitingMyDecision?: boolean;
}

export interface ApprovalQuery extends ApprovalFilters {
  page?: number;
  pageSize?: number;
}

export interface ApprovalPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface PaginatedApprovalsResponse {
  data: Approval[];
  meta: ApprovalPaginationMeta;
}
