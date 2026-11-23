import type { TaskStatus } from '../types';
import { TASK_STATUS_LABELS } from '../types';

export interface TaskStatusPillProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  container: string;
  dot: string;
}

const STATUS_CONFIG: Record<TaskStatus, StatusConfig> = {
  todo: {
    container: 'bg-surface-muted text-text-muted border-border',
    dot: 'bg-text-subtle',
  },
  in_progress: {
    container: 'bg-primary-soft text-primary-ink border-primary-strong/20',
    dot: 'bg-primary-strong',
  },
  in_review: {
    container: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
  },
  blocked: {
    container: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-danger',
  },
  completed: {
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
};

export function TaskStatusPill({ status, size = 'sm', className = '' }: TaskStatusPillProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.todo;
  const label = TASK_STATUS_LABELS[status] || status;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${sizeClasses} ${config.container} ${className}`}
      data-testid={`task-status-pill-${status}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
