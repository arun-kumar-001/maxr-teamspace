import type { Pool, PoolClient } from 'pg';

export type ProjectTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

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

export interface StoredProjectDocument extends ProjectDocument {
  storageKey: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  workflowStatus: ProjectWorkflowStatus;
  progressPercent: number;
  objectives: string | null;
  scope: string | null;
  technologies: string[];
  ownerEmployeeId: string;
  ownerName: string;
  ownerEmail?: string | null;
  ownerDesignation?: string | null;
  ownerDepartment?: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Compare-and-set token: an update must send the version it read. */
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
  milestones: ProjectMilestone[];
  updates: ProjectUpdate[];
  documents: ProjectDocument[];
}

export interface NewProject {
  code: string;
  name: string;
  description: string | null;
  ownerEmployeeId: string;
  startDate: string | null;
  endDate: string | null;
  priority?: ProjectPriority;
  workflowStatus?: ProjectWorkflowStatus;
  progressPercent?: number;
  objectives?: string | null;
  scope?: string | null;
  technologies?: string[];
}

export interface ProjectValues {
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  priority: ProjectPriority;
  workflowStatus: ProjectWorkflowStatus;
  progressPercent: number;
  objectives: string | null;
  scope: string | null;
  technologies: string[];
}

export interface NewMilestone {
  projectId: string;
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: ProjectWorkflowStatus;
  completionPercent: number;
}

export interface MilestoneValues {
  title: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: ProjectWorkflowStatus;
  completionPercent: number;
}

export interface NewProjectUpdate {
  projectId: string;
  authorEmployeeId: string;
  updateType: ProjectUpdateType;
  content: string;
  progressPercent: number | null;
}

export interface NewProjectDocument {
  projectId: string;
  uploadedByEmployeeId: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256: string;
  category: ProjectDocumentCategory;
}

/** What other modules (tasks) need to know about a project, without touching its tables. */
export interface ProjectAccess {
  status: ProjectStatus;
  ownerEmployeeId: string;
  memberEmployeeIds: string[];
}

export interface ProjectReader {
  access(projectId: string): Promise<ProjectAccess | null>;
}
