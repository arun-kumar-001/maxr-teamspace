import type { Task, TaskStatus } from './types';

export const TASK_STATUS_OVERRIDES_KEY = 'maxr_task_status_overrides';
export const EVENT_TASK_STATUS_CHANGED = 'maxr:task-status-changed';
export const EVENT_TASK_CREATED = 'maxr:task-created';

export interface TaskStatusOverride {
  status: TaskStatus;
  completedAt: string | null;
  updatedAt: string;
}

export function getTaskStatusOverrides(): Record<string, TaskStatusOverride> {
  try {
    const raw = localStorage.getItem(TASK_STATUS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTaskStatusOverride(id: string, status: TaskStatus): void {
  try {
    const current = getTaskStatusOverrides();
    current[id] = {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(TASK_STATUS_OVERRIDES_KEY, JSON.stringify(current));
  } catch {
    // Ignore in private/restricted storage
  }
  notifyTaskStatusChanged(id, status);
}

export function applyTaskOverrides<T extends Task>(tasks: T[]): T[] {
  const overrides = getTaskStatusOverrides();
  if (!overrides || Object.keys(overrides).length === 0) return tasks;

  return tasks.map((task) => {
    const override = overrides[task.id];
    if (!override) return task;
    return {
      ...task,
      status: override.status,
      completedAt: override.completedAt !== undefined ? override.completedAt : task.completedAt,
      updatedAt: override.updatedAt || task.updatedAt,
      isOverdue:
        override.status === 'completed'
          ? false
          : task.dueDate
            ? new Date(task.dueDate).getTime() < Date.now()
            : false,
    };
  });
}

export function notifyTaskStatusChanged(id: string, status: TaskStatus): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_TASK_STATUS_CHANGED, {
        detail: { id, status },
      }),
    );
  } catch {
    // Ignore
  }
}

export function onTaskStatusChanged(
  listener: (detail: { id: string; status: TaskStatus }) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ id: string; status: TaskStatus }>;
    if (custom.detail) {
      listener(custom.detail);
    }
  };
  window.addEventListener(EVENT_TASK_STATUS_CHANGED, handler);
  return () => {
    window.removeEventListener(EVENT_TASK_STATUS_CHANGED, handler);
  };
}

export function notifyTaskCreated(task: Task): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_TASK_CREATED, {
        detail: { task },
      }),
    );
  } catch {
    // Ignore
  }
}

export function onTaskCreated(listener: (task: Task) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ task: Task }>;
    if (custom.detail?.task) {
      listener(custom.detail.task);
    }
  };
  window.addEventListener(EVENT_TASK_CREATED, handler);
  return () => {
    window.removeEventListener(EVENT_TASK_CREATED, handler);
  };
}

export interface TaskCountsSummary {
  completed: number;
  pending: number;
  overdue: number;
  total: number;
  completedPct: number;
}

export function computeTaskCounts(tasks: Task[]): TaskCountsSummary {
  const todayMs = Date.now();
  let completed = 0;
  let overdue = 0;
  let pending = 0;

  for (const t of tasks) {
    if (t.status === 'completed') {
      completed += 1;
    } else if (t.dueDate && new Date(t.dueDate).getTime() < todayMs) {
      overdue += 1;
    } else {
      pending += 1;
    }
  }

  const total = tasks.length;
  const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { completed, pending, overdue, total, completedPct };
}
