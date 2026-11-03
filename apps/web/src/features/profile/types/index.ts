import type { Role } from '@maxr/shared';

export type EmployeeStatus = 'active' | 'pending' | 'deactivated';

export interface EmployeeDepartment {
  id: string;
  name: string;
  code: string;
}

export interface EmployeeDesignation {
  id: string;
  title: string;
  code: string;
  level?: number;
}

export interface EmployeeManager {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

export interface EmployeeAccountInfo {
  userId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roles: Role[];
}

export interface EmployeeProfile {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: EmployeeDepartment;
  designation: EmployeeDesignation;
  manager: EmployeeManager | null;
  status: EmployeeStatus;
  joiningDate: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  /** Present only for Admin and HR Manager. Absent for Team Lead and Staff. */
  account?: EmployeeAccountInfo;
}

/**
 * Strict payload for PUT /employees/me.
 * Phone is the only self-editable field.
 */
export interface UpdateProfilePayload {
  version: number;
  phone: string | null;
}

export interface ProfileApiResponse {
  data: EmployeeProfile;
}
