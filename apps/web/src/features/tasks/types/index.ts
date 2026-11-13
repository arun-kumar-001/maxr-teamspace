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

export const TASK_TRANSITION_PATHS: Readonly<
  Record<TaskStatus, Readonly<Partial<Record<TaskStatus, readonly TaskStatus[]>>>>
> = {
  todo: {
    in_progress: ['in_progress'],
    in_review: ['in_progress', 'in_review'],
    blocked: ['in_progress', 'blocked'],
    completed: ['in_progress', 'in_review', 'completed'],
  },
  in_progress: {
    todo: ['todo'],
    in_review: ['in_review'],
    blocked: ['blocked'],
    completed: ['in_review', 'completed'],
  },
  in_review: {
    in_progress: ['in_progress'],
    completed: ['completed'],
    todo: ['in_progress', 'todo'],
    blocked: ['in_progress', 'blocked'],
  },
  blocked: {
    in_progress: ['in_progress'],
    todo: ['in_progress', 'todo'],
    in_review: ['in_progress', 'in_review'],
    completed: ['in_progress', 'in_review', 'completed'],
  },
  completed: {
    in_progress: ['in_progress'],
    todo: ['in_progress', 'todo'],
    in_review: ['in_progress', 'in_review'],
    blocked: ['in_progress', 'blocked'],
  },
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Hold',
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
  isDaily?: boolean;
  dailyLastDoneDate?: string | null;
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
  isDaily?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeEmployeeId?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  projectId?: string | null;
  isDaily?: boolean;
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

export const MAX_ATTACHMENTS_PER_TASK = 20;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_ATTACHMENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;

export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

export interface TaskComment {
  id: string;
  taskId: string;
  authorEmployeeId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedByEmployeeId: string;
  uploadedByName: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export interface AttachmentDownloadLink {
  url: string;
  expiresAt: string;
}
