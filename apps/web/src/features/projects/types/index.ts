export type ProjectStatus = 'active' | 'archived';

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  ownerEmployeeId: string;
  ownerName: string;
  startDate: string | null;
  endDate: string | null;
  version: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  employeeId: string;
  name: string;
  addedAt: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  ownerEmployeeId?: string;
  memberIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  version: number;
}

export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus;
  q?: string;
}

export interface ProjectListResponse {
  data: Project[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}
