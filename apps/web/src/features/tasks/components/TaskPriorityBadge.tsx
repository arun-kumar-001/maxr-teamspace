import type { TaskPriority } from '../types';
import { TASK_PRIORITY_LABELS } from '../types';

export interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  size?: 'sm' | 'md';
  className?: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { container: string; dot: string; icon?: boolean }> = {
  urgent: {
    container: 'bg-rose-50 text-rose-700 border-rose-200/80 font-semibold',
    dot: 'bg-rose-500',
    icon: true,
  },
  high: {
    container: 'bg-amber-50 text-amber-800 border-amber-200/80 font-semibold',
    dot: 'bg-amber-500',
  },
  medium: {
    container: 'bg-sky-50 text-sky-800 border-sky-200/80 font-medium',
    dot: 'bg-sky-500',
  },
  low: {
    container: 'bg-slate-50 text-slate-700 border-slate-200/80 font-medium',
    dot: 'bg-slate-400',
  },
};

export function TaskPriorityBadge({
  priority,
  size = 'sm',
  className = '',
}: TaskPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
  const label = TASK_PRIORITY_LABELS[priority] || priority;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border capitalize ${sizeClasses} ${config.container} ${className}`}
      data-testid={`task-priority-${priority}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} aria-hidden="true" />
      {config.icon && (
        <svg
          className="w-3 h-3 shrink-0 text-rose-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      {label}
    </span>
  );
}
