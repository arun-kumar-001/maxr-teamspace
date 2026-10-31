export interface LeaveBalance {
  leaveTypeId: string;
  code: string;
  name: string;
  year: number;
  allotted: number;
  carriedForward: number;
  used: number;
  /** allotted + carriedForward - used; never negative (a CHECK in the database). */
  remaining: number;
}

export interface EmployeeLeaveBalance extends LeaveBalance {
  employeeId: string;
  employeeName: string;
}
