import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';
import { TaskPriorityBadge } from './TaskPriorityBadge';

export interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onDragStart?: (task: Task, canCompleteOrReopen: boolean) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

export function formatRelativeTaskDue(dueDate: string | null, isCompleted: boolean): string {
  if (!dueDate) return 'No due date';
  if (isCompleted) return 'done';
  const target = new Date(dueDate);
  if (Number.isNaN(target.getTime())) return dueDate;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 1 && diffDays <= 45) return `in ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -45) return `${Math.abs(diffDays)}d ago`;
  return dueDate;
}

export function TaskCard({
  task,
  onSelect,
  onStatusChange,
  onDragStart,
  onDragEnd,
  isDragging = false,
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

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const dueText = formatRelativeTaskDue(task.dueDate, task.status === 'completed');

  return (
    <div
      onClick={() => onSelect(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(task);
        }
      }}
      draggable={Boolean(onStatusChange)}
      onDragStart={(e) => {
        if (!onStatusChange) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart?.(task, canCompleteOrReopen);
      }}
      onDragEnd={() => onDragEnd?.()}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.title}. Status: ${task.status}. Priority: ${task.priority}.`}
      data-testid={`task-card-${task.id}`}
      className={`group relative flex flex-col justify-between p-3.5 bg-surface rounded-card border border-border shadow-card hover:border-primary-strong/40 hover:shadow-raised hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px] ${
        task.isOverdue ? 'border-rose-300 bg-rose-50/10' : ''
      } ${isDragging ? 'opacity-50 scale-[0.98] ring-2 ring-primary' : ''} ${className}`}
    >
      <div>
        {/* Subtle Project Label & Quick Menu Hint */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                task.isOverdue
                  ? 'bg-danger'
                  : task.status === 'completed'
                    ? 'bg-emerald-600'
                    : 'bg-primary-strong'
              }`}
              aria-hidden="true"
            />
            <span className="text-[11px] text-text-subtle truncate">
              {task.projectName ?? 'Standalone task'}
            </span>
          </div>
          <span
            className="text-text-subtle group-hover:text-text text-xs leading-none shrink-0"
            aria-hidden="true"
          >
            •••
          </span>
        </div>

        {/* Task Title */}
        <h4 className="font-semibold text-text text-sm leading-snug group-hover:text-primary-ink transition-colors line-clamp-2 mb-2.5">
          {task.title}
        </h4>
      </div>

      {/* Footer Info & Actions */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <TaskPriorityBadge priority={task.priority} />
            {task.isOverdue ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-danger border border-rose-200"
                title={`Overdue (${task.dueDate ?? ''})`}
                data-testid="overdue-badge"
              >
                {dueText}
              </span>
            ) : (
              task.dueDate && (
                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted whitespace-nowrap">
                  <svg
                    className="w-3 h-3 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                    <path strokeLinecap="round" strokeWidth="1.8" d="M12 7v5l3 2" />
                  </svg>
                  <span>{dueText}</span>
                </span>
              )
            )}
          </div>

          <div
            className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-semibold text-[10px] shrink-0 border border-border"
            title={`Assignee: ${task.assigneeName}`}
          >
            {getInitials(task.assigneeName)}
          </div>
        </div>

        {/* Quick Transition Buttons */}
        {onStatusChange && availableMoves.length > 0 && (
          <div
            className="flex items-center gap-1.5 pt-2 border-t border-border/80 overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {availableMoves.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onStatusChange(task.id, target)}
                className="px-2 py-1 text-[11px] font-medium rounded border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink hover:border-primary-strong/30 transition-colors shrink-0 min-h-[28px]"
                data-testid={`quick-move-${task.id}-to-${target}`}
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
