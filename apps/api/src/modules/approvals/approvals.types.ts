import { z } from 'zod';
import {
  approvalSchema,
  approvalStatusSchema,
  approvalSubjectTypeSchema,
  createApprovalSchema,
  decisionSchema,
  listApprovalsQuerySchema,
} from './approvals.schemas';

export type Approval = z.infer<typeof approvalSchema>;
export type ApprovalStatus = z.infer<typeof approvalStatusSchema>;
export type ApprovalSubjectType = z.infer<typeof approvalSubjectTypeSchema>;
export type DecisionDto = z.infer<typeof decisionSchema>;
export type CreateApprovalDto = z.infer<typeof createApprovalSchema>;
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuerySchema>;

/**
 * Handler interface for subjects that can be approved/rejected.
 * Pluggable registry: Leave, Attendance Correction, Expense.
 */
export interface IApprovalSubjectHandler {
  onApprove(subjectId: string, approverId: string, comment?: string): Promise<void>;
  onReject(subjectId: string, approverId: string, comment?: string): Promise<void>;
}
