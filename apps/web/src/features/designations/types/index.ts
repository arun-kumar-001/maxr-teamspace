export interface Designation {
  id: string;
  departmentId: string;
  title: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignationPayload {
  departmentId: string;
  title: string;
}

export interface UpdateDesignationPayload {
  departmentId?: string;
  title?: string;
}

export interface DesignationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: 'title' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface DesignationListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DesignationListResponse {
  data: Designation[];
  meta: DesignationListMeta;
}

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}
