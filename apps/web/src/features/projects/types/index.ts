export type ProjectStatus = 'active' | 'archived';

export type ProjectPriority = 'high' | 'medium' | 'low';

export type ProjectWorkflowStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed';

export type ProjectUpdateType = 'manager_update' | 'progress_update' | 'comment' | 'activity';

export type ProjectDocumentCategory = 'specification' | 'architecture' | 'report' | 'general';

export type ProjectSortOption = 'name' | 'deadline_asc' | 'deadline_desc';

export interface ProjectsSummary {
  totalAssigned: number;
  inProgress: number;
  completed: number;
  upcoming: number;
  onHold: number;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: ProjectWorkflowStatus;
  completionPercent: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  authorEmployeeId: string;
  authorName: string;
  authorRoleLabel?: string | null;
  updateType: ProjectUpdateType;
  content: string;
  progressPercent: number | null;
  createdAt: string;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  uploadedByEmployeeId: string;
  uploadedByName: string;
  originalName: string;
  contentType: string;
  size: number;
  category: ProjectDocumentCategory;
  createdAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  progressPercent?: number;
  objectives?: string | null;
  scope?: string | null;
  technologies?: string[];
  ownerEmployeeId: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerDesignation?: string | null;
  ownerDepartment?: string | null;
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
  email?: string | null;
  designation?: string | null;
  department?: string | null;
  addedAt: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
  milestones?: ProjectMilestone[];
  updates?: ProjectUpdate[];
  documents?: ProjectDocument[];
}

export interface CreateProjectInput {
  code: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  progressPercent?: number;
  objectives?: string;
  scope?: string;
  technologies?: string[];
  ownerEmployeeId?: string;
  memberIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  progressPercent?: number;
  objectives?: string | null;
  scope?: string | null;
  technologies?: string[];
  version: number;
}

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  status?: ProjectWorkflowStatus;
  completionPercent?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  status?: ProjectWorkflowStatus;
  completionPercent?: number;
}

export interface CreateProjectUpdateInput {
  updateType: 'manager_update' | 'progress_update' | 'comment';
  content: string;
  progressPercent?: number;
}

export interface ProjectListQuery {
  page?: number;
  pageSize?: number;
  status?: ProjectStatus;
  workflowStatus?: ProjectWorkflowStatus;
  priority?: ProjectPriority;
  sort?: ProjectSortOption;
  q?: string;
}

export interface ProjectListResponse {
  data: Project[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages?: number;
  };
  summary?: ProjectsSummary;
}
