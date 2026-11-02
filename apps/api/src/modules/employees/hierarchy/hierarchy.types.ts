import type { PoolClient } from 'pg';

export type HierarchyTx = Pick<PoolClient, 'query'>;

export type EmployeeStatus = 'active' | 'pending' | 'deactivated';

/** One person in the org chart. `directReportCount` tells the UI whether the node can be expanded. */
export interface OrgNode {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  status: EmployeeStatus;
  /** Reports who are not deactivated. */
  directReportCount: number;
}

/** The employee row as it is before a manager change, read under a lock. */
export interface ManagedEmployee {
  id: string;
  status: EmployeeStatus;
  version: number;
  managerId: string | null;
}

export interface ManagerChange {
  id: string;
  managerId: string | null;
  manager: { id: string; employeeCode: string; name: string } | null;
  version: number;
}

export interface OrgListParams {
  /** Whose direct reports to list; null for the people at the top (no manager). */
  managerId: string | null;
  status?: EmployeeStatus;
  offset: number;
  limit: number;
}
