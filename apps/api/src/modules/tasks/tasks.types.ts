import type { Pool, PoolClient } from 'pg';
import type { TaskPriority, TaskStatus } from './task-rules';

export type TaskTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  assigneeEmployeeId: string;
  assigneeName: string;
  assignerEmployeeId: string;
  assignerName: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** `YYYY-MM-DD`, a calendar date with no timezone. */
  dueDate: string | null;
  /** Past its due date on the company calendar and not completed. */
  isOverdue: boolean;
  completedAt: string | null;
  /** Compare-and-set token for edits. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Who is asking, for visibility: an Admin sees every task, anyone else the ones they are party to. */
export interface TaskViewer {
  employeeId: string;
  all: boolean;
}

export interface NewTask {
  title: string;
  description: string | null;
  projectId: string | null;
  assigneeEmployeeId: string;
  assignerEmployeeId: string;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface TaskValues {
  title: string;
  description: string | null;
  projectId: string | null;
  assigneeEmployeeId: string;
  priority: TaskPriority;
  dueDate: string | null;
  status: TaskStatus;
}

export interface AssigneeRow {
  employeeId: string;
  status: string;
  managerId: string | null;
}
