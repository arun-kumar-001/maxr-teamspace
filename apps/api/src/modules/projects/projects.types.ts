import type { Pool, PoolClient } from 'pg';

export type ProjectTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

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
  /** Compare-and-set token: an update must send the version it read. */
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

export interface NewProject {
  code: string;
  name: string;
  description: string | null;
  ownerEmployeeId: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectValues {
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
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
