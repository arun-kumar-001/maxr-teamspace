export type LeaveRequestStatus = 'applied' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  /** Calendar dates, `YYYY-MM-DD`, both included. */
  startDate: string;
  endDate: string;
  halfDay: boolean;
  /** Working days, in half-day steps. What approval deducts from the balance. */
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  /** The approval that decides it; the inbox at /approvals lists it for the approvers. */
  approvalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewLeaveRequest {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  reason: string | null;
}
