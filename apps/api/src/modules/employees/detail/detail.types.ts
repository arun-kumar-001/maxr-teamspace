import type { Role } from '@maxr/shared';
import type { PoolClient } from 'pg';

export type DetailTx = Pick<PoolClient, 'query'>;

export type EmployeeStatus = 'active' | 'pending' | 'deactivated';

/** Login information: shown to HR and Admin only, never to the employee's team lead or the employee. */
export interface EmployeeAccountInfo {
  userId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Role[];
}

export interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: { id: string; name: string; code: string };
  designation: { id: string; title: string; code: string };
  manager: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
  status: EmployeeStatus;
  joiningDate: string;
  createdAt: string;
  updatedAt: string;
  /** Send it back with an edit; an edit made on an older version is refused with 409. */
  version: number;
  /** Present only for callers allowed to edit employees. */
  account?: EmployeeAccountInfo;
}

/** The fields an edit may change. Status, manager and role have their own flows. */
export interface EmployeePatch {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  departmentId?: string;
  designationId?: string;
  joiningDate?: string;
}

export type PatchField = keyof EmployeePatch;

/** The row as it is before an edit, read under a lock. */
export interface EditableEmployee {
  id: string;
  status: EmployeeStatus;
  version: number;
  managerId: string | null;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string;
  designationId: string;
  joiningDate: string;
}
