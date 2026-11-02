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
