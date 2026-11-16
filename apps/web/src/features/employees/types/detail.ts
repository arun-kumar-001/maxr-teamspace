import type { Role } from '@maxr/shared';
import type { EmployeeDepartmentRef, EmployeeManagerRef, EmployeeStatus } from './index';

export interface EmployeeAccountInfo {
  userId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Role[];
}

export interface EmployeeDetailDesignationRef {
  id: string;
  title: string;
  code: string;
  level?: number;
}

export interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: EmployeeDepartmentRef;
  designation: EmployeeDetailDesignationRef;
  manager: EmployeeManagerRef | null;
  status: EmployeeStatus;
  joiningDate: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  additionalEmails?: string[];
  additionalPhones?: string[];
  permanentAddress?: string | null;
  currentAddress?: string | null;
  bloodGroup?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  bankAccountHolder?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankIfscCode?: string | null;
  bankBranch?: string | null;
  account?: EmployeeAccountInfo;
}

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
