import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusPill } from './TaskStatusPill';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

export function TaskCard({
  task,
  onSelect,
  onStatusChange,
  currentEmployeeId,
  isAdmin = false,
  className = '',
}: TaskCardProps) {
  const allowedMoves = TASK_TRANSITIONS[task.status] || [];

  // Rules from D-14 / D-34:
  // Only the assigner or an Admin may complete or reopen a task.
  const isAssigner = Boolean(currentEmployeeId && task.assignerEmployeeId === currentEmployeeId);
  const canCompleteOrReopen = Boolean(isAdmin || isAssigner);

  const availableMoves = allowedMoves.filter((targetStatus) => {
    if (targetStatus === 'completed' || task.status === 'completed') {
      return canCompleteOrReopen;
    }
    return true;
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  };

  return (
    <div
      onClick={() => onSelect(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(task);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.title}. Status: ${task.status}. Priority: ${task.priority}.`}
      data-testid={`task-card-${task.id}`}
      className={`group relative flex flex-col justify-between p-4 bg-surface rounded-card border border-border shadow-card hover:border-primary-strong/40 hover:shadow-raised transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px] ${
        task.isOverdue ? 'border-rose-300 bg-rose-50/10' : ''
      } ${className}`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TaskPriorityBadge priority={task.priority} />
            {task.isOverdue && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-danger border border-rose-200"
                title="Task is overdue"
                data-testid="overdue-badge"
              >
                Overdue
              </span>
            )}
          </div>

          <TaskStatusPill status={task.status} size="sm" />
        </div>

        {/* Task Title */}
        <h4 className="font-semibold text-text text-sm group-hover:text-primary-ink transition-colors line-clamp-2 mb-1.5">
          {task.title}
        </h4>

        {/* Optional Project Tag */}
        {task.projectName && (
          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-text-subtle bg-surface-muted px-2 py-0.5 rounded border border-border mb-2.5 max-w-full truncate">
            <svg
              className="w-3 h-3 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="truncate">{task.projectName}</span>
          </div>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div className="pt-2.5 border-t border-border flex flex-col gap-2 mt-2">
        <div className="flex items-center justify-between text-xs text-text-subtle gap-2">
          {/* Assignee */}
          <div
            className="flex items-center gap-1.5 min-w-0"
            title={`Assignee: ${task.assigneeName}`}
          >
            <div className="w-5 h-5 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-medium text-[10px] shrink-0">
              {getInitials(task.assigneeName)}
            </div>
            <span className="truncate text-[11px] font-medium text-text">{task.assigneeName}</span>
          </div>

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`text-[11px] shrink-0 ${task.isOverdue ? 'text-danger font-medium' : ''}`}
            >
              Due {task.dueDate}
            </span>
          )}
        </div>

        {/* Quick Transition Buttons */}
        {onStatusChange && availableMoves.length > 0 && (
          <div
            className="flex items-center gap-1.5 pt-1.5 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {availableMoves.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onStatusChange(task.id, target)}
                className="px-2 py-1 text-[11px] font-medium rounded border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink hover:border-primary-strong/30 transition-colors shrink-0 min-h-[32px] sm:min-h-[28px]"
                data-testid={`quick-move-${task.id}-to-${target}`}
                title={`Move to ${TASK_STATUS_LABELS[target]}`}
              >
                → {TASK_STATUS_LABELS[target]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
