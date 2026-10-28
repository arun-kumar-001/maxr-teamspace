import { EmployeeStatus } from '../constants/status';

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  departmentName?: string;
  designationId: string;
  designationTitle?: string;
  managerId?: string;
  managerName?: string;
  status: EmployeeStatus;
  hireDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface DesignationSummary {
  id: string;
  code: string;
  title: string;
  level: number;
  departmentId?: string;
  isActive: boolean;
}
