export interface Department {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentPayload {
  name: string;
  code: string;
}

export interface UpdateDepartmentPayload {
  name?: string;
  code?: string;
}

export interface DepartmentQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'code' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  isActive?: boolean;
}

export interface DepartmentListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DepartmentListResponse {
  data: Department[];
  meta: DepartmentListMeta;
}
