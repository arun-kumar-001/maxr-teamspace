export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ApprovalSubjectType = 'LEAVE' | 'ATTENDANCE_CORRECTION' | 'EXPENSE';

export interface Approval {
  id: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  requesterId: string;
  approverId: string | null;
  status: ApprovalStatus;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionRequest {
  comment?: string;
}

export interface ApprovalsFilter {
  status?: ApprovalStatus;
  subjectType?: ApprovalSubjectType;
  page?: number;
  pageSize?: number;
}
