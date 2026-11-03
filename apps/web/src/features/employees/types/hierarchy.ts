import type { EmployeeStatus } from './index';

/** Node in the organization reporting hierarchy tree. */
export interface OrgNode {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  status: EmployeeStatus;
  /** Direct reports count (active employees only). */
  directReportCount: number;
}

/** Result from PUT /api/v1/employees/:id/manager */
export interface ManagerChange {
  id: string;
  managerId: string | null;
  manager: { id: string; employeeCode: string; name: string } | null;
  version: number;
}

/** Payload for PUT /api/v1/employees/:id/manager */
export interface ChangeManagerPayload {
  version: number;
  managerId: string | null;
}

/** Standard paginated response for org nodes */
export interface OrgListResponse {
  data: OrgNode[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/** Candidate for manager selection */
export interface EligibleManager {
  id: string;
  employeeCode: string;
  name: string;
  designation?: string;
  department?: string;
}
