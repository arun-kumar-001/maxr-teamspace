import { z } from 'zod';
import { SortSpec } from '../../../http/pagination';
import { ScopeFilter } from '../../rbac/scope';
import { employeeDirectoryQuerySchema } from './directory.schemas';

export type EmployeeStatus = 'active' | 'pending' | 'deactivated';

export interface EmployeeDepartmentRef {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeDesignationRef {
  id: string;
  title: string;
}

export interface EmployeeManagerRef {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export interface EmployeeDirectoryItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: EmployeeDepartmentRef;
  designation: EmployeeDesignationRef;
  manager: EmployeeManagerRef | null;
  status: EmployeeStatus;
  joiningDate: string;
  createdAt: string;
  updatedAt: string;
  /** Stable, authenticated URL of the profile photo; null when there is none. */
  photoUrl: string | null;
}

export type EmployeeDirectoryQuery = z.infer<typeof employeeDirectoryQuerySchema>;
export type EmployeeDirectoryQueryInput = z.input<typeof employeeDirectoryQuerySchema>;

export interface EmployeeDirectoryFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  filter: ScopeFilter;
  search?: string;
  departmentId?: string;
  designationId?: string;
  status?: EmployeeStatus;
  managerId?: string;
}
