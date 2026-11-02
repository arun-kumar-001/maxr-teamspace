export interface LeavePolicy extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  hasBalance: boolean;
  isActive: boolean;
  annualDays: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  maxBackdateDays: number;
  version: number;
  updatedAt: string;
}

export interface CreateLeavePolicyInput {
  code: string;
  name: string;
  hasBalance?: boolean;
  annualDays?: number;
  carryForwardMax?: number;
  allowHalfDay?: boolean;
  maxBackdateDays?: number;
}

export interface UpdateLeavePolicyInput {
  name?: string;
  isActive?: boolean;
  annualDays?: number;
  carryForwardMax?: number;
  allowHalfDay?: boolean;
  maxBackdateDays?: number;
  version: number;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface CreateHolidayInput {
  date: string;
  name: string;
}

export interface LeaveBalance {
  leaveTypeId: string;
  code: string;
  name: string;
  year: number;
  allotted: number;
  carriedForward: number;
  used: number;
  remaining: number;
}

export interface EmployeeLeaveBalance extends LeaveBalance {
  employeeId: string;
  employeeName: string;
}

export interface AccrualResult {
  year: number;
  created: number;
}

export interface ListBalancesQuery {
  page?: number;
  pageSize?: number;
  employeeId?: string;
  year?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export type LeaveRequestStatus = 'applied' | 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest extends Record<string, unknown> {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  reason: string | null;
  status: LeaveRequestStatus;
  approvalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplyForLeavePayload {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
  reason?: string;
}

export interface ListMyLeaveRequestsQuery {
  page?: number;
  pageSize?: number;
  status?: LeaveRequestStatus;
  leaveTypeId?: string;
  from?: string;
  to?: string;
}

export interface LeaveCalendarEntry {
  requestId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  status: 'pending' | 'approved';
}
