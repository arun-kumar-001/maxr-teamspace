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
  code: string;
  level: number;
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
}

export type EmployeeDirectoryQuery = z.input<typeof employeeDirectoryQuerySchema>;
export type ParsedEmployeeDirectoryQuery = z.output<typeof employeeDirectoryQuerySchema>;

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
