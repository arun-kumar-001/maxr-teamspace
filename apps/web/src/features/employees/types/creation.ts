import type { Role } from '@maxr/shared';

/**
 * Payload submitted to POST /api/v1/employees.
 * Strictly adheres to backend createEmployeeSchema.
 * No status, isActive, password, or userId allowed.
 */
export interface CreateEmployeePayload {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId: string;
  designationId: string;
  managerId?: string;
  joiningDate: string;
  role: Role;
  additionalEmails?: string[];
  additionalPhones?: string[];
  permanentAddress?: string;
  currentAddress?: string;
  bloodGroup?: string;
  panNumber?: string;
  aadhaarNumber?: string;
}

/**
 * Server response for a successfully created employee.
 * Account is created with status 'pending' (D-20).
 */
export interface CreatedEmployee {
  id: string;
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  departmentId: string;
  designationId: string;
  managerId: string | null;
  status: 'pending';
  role: Role;
  joiningDate: string;
  createdAt: string;
}

export interface CreateEmployeeResponse {
  data: CreatedEmployee;
}

export interface CreateEmployeeFormState {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  designationId: string;
  managerId: string;
  joiningDate: string;
  role: Role;
  additionalEmails: string[];
  additionalPhones: string[];
  permanentAddress: string;
  currentAddress: string;
  sameAsPermanentAddress: boolean;
  bloodGroup: string;
  panNumber: string;
  aadhaarNumber: string;
}

export interface CreateEmployeeValidationErrors {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  additionalEmails?: string;
  phone?: string;
  additionalPhones?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  joiningDate?: string;
  role?: string;
}

export interface DepartmentSelectOption {
  id: string;
  name: string;
  code: string;
}

export interface DesignationSelectOption {
  id: string;
  title: string;
  code: string;
  departmentId: string;
}

export interface ManagerSelectOption {
  id: string;
  name: string;
  employeeCode: string;
}
