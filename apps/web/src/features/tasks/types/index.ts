export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'completed', 'blocked'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ['in_progress'],
  in_progress: ['todo', 'in_review', 'blocked'],
  in_review: ['in_progress', 'completed'],
  blocked: ['in_progress'],
  completed: ['in_progress'],
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  completed: 'Completed',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

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
  dueDate: string | null;
  isOverdue: boolean;
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assigneeEmployeeId: string;
  priority?: TaskPriority;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeEmployeeId?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  projectId?: string | null;
  version: number;
}

export interface ListTasksQuery {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  assigneeEmployeeId?: string;
}

export interface ListTasksResponse {
  data: Task[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
}
