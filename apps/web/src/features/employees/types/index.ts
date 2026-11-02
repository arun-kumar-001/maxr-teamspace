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

export interface EmployeeDirectoryMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EmployeeDirectoryResponse {
  data: EmployeeDirectoryItem[];
  meta: EmployeeDirectoryMeta;
}

export interface EmployeeDirectoryQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'employeeCode' | 'joiningDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  departmentId?: string;
  designationId?: string;
  status?: EmployeeStatus;
  managerId?: string;
}

export interface DepartmentItem {
  id: string;
  name: string;
  code: string;
}

export interface DesignationItem {
  id: string;
  title: string;
  code: string;
  level: number;
}
