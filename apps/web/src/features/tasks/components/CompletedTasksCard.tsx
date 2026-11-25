import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { EmployeeAvatar } from '../../employees/components/EmployeeAvatar';
import { formatRelativeTaskDue, formatTaskDueDate, formatTaskCreated } from './TaskCard';

export interface CompletedTasksCardProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void | Promise<unknown>;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

/**
 * Single parent card layout for Completed Tasks on mobile and responsive views.
 * Renders all completed task rows vertically with subtle dividers, complete metadata,
 * progress bar, dates, priority, assignee, and completion status without horizontal movement.
 */
export function CompletedTasksCard({
  tasks,
  onSelectTask,
  onStatusChange,
  currentEmployeeId,
  isAdmin = false,
  className = '',
}: CompletedTasksCardProps) {
  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <div
      className={`w-full min-w-0 bg-surface rounded-card border border-border border-t-4 border-t-emerald-600 shadow-card p-3.5 sm:p-5 flex flex-col gap-3 transition-all ${className}`}
      data-testid="completed-tasks-single-card"
    >
      {/* Header of Single Parent Card */}
      <div className="flex items-center justify-between pb-3 border-b border-border/80 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true" />
          <h3 className="font-semibold text-sm sm:text-base text-text truncate">Completed Tasks</h3>
          <span
            className="px-2 py-0.5 text-xs font-semibold rounded-full bg-surface-muted text-text-subtle border border-border tabular-nums shrink-0"
            data-testid="column-count-completed"
          >
            {tasks.length}
          </span>
        </div>
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} done
        </span>
      </div>

      {/* Vertically Stacked Task Rows */}
      {tasks.length === 0 ? (
        <div className="flex items-center justify-center py-10 border border-dashed rounded-lg text-xs select-none border-border text-text-subtle">
          No completed tasks
        </div>
      ) : (
        <div className="divide-y divide-border/60 -mx-3.5 sm:-mx-5 flex flex-col">
          {tasks.map((task) => {
            const isAssignee = Boolean(
              currentEmployeeId && task.assigneeEmployeeId === currentEmployeeId,
            );
            const isAssigner = Boolean(
              currentEmployeeId && task.assignerEmployeeId === currentEmployeeId,
            );
            const canCompleteOrReopen = Boolean(isAdmin || isAssigner || isAssignee);
            const allowedMoves = TASK_TRANSITIONS[task.status] || [];
            const availableMoves = allowedMoves.filter((targetStatus) => {
              if (targetStatus === 'completed' || task.status === 'completed') {
                return canCompleteOrReopen;
              }
              return true;
            });

            const dueRelative = formatRelativeTaskDue(task.dueDate, true);
            const dueFormatted = formatTaskDueDate(task.dueDate);
            const createdFormatted = formatTaskCreated(task.createdAt);
            const projectName = task.projectName || 'General Task';

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTask(task);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Completed Task: ${task.title}. Priority: ${task.priority}.`}
                data-testid={`task-card-${task.id}`}
                className="p-3.5 sm:p-4 hover:bg-surface-muted/40 transition-colors cursor-pointer group flex flex-col gap-2.5 focus:outline-none focus:ring-1 focus:ring-primary-strong"
              >
                {/* Row Top: Project Badge + Priority + Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 truncate max-w-[160px]">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{projectName}</span>
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <TaskPriorityBadge priority={task.priority} />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ Completed
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-semibold text-text text-[13px] sm:text-sm leading-snug group-hover:text-primary-ink transition-colors">
                  {task.title}
                </h4>

                {/* Description */}
                {task.description && (
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed font-normal">
                    {task.description}
                  </p>
                )}

                {/* Dates Block */}
                <div className="bg-surface-muted/50 rounded-lg p-2 border border-border/50 text-[10.5px] space-y-1">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-text-subtle flex items-center gap-1.5 shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-text-subtle/80 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" />
                        <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.8" />
                        <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.8" />
                        <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.8" />
                      </svg>
                      <span>Due:</span>
                    </span>
                    <span className="font-medium text-text truncate">
                      {dueFormatted}{' '}
                      <span className="text-text-subtle font-normal">({dueRelative})</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-text-subtle flex items-center gap-1.5 shrink-0">
                      <svg
                        className="w-3.5 h-3.5 text-text-subtle/80 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                        <polyline
                          points="12 6 12 12 16 14"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Created:</span>
                    </span>
                    <span className="text-text-muted font-medium truncate">{createdFormatted}</span>
                  </div>
                </div>

                {/* Assignee & Progress */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div
                      className="flex items-center gap-2 min-w-0"
                      title={`Assigned to ${task.assigneeName}${
                        task.assignerName ? ` · Assigned by ${task.assignerName}` : ''
                      }`}
                    >
                      <EmployeeAvatar
                        name={task.assigneeName}
                        employeeId={task.assigneeEmployeeId}
                        initials={getInitials(task.assigneeName)}
                        decorative
                        className="w-6 h-6 border text-[10px] font-bold shadow-2xs ring-1 ring-white bg-teal-100 text-teal-800 border-teal-200"
                      />
                      <span className="font-medium text-text text-[11.5px] truncate">
                        {task.assigneeName}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar (100% Completed) */}
                  <div className="space-y-1 pt-0.5">
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-300 w-full" />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-text-subtle font-medium">Progress</span>
                      <span className="font-semibold text-emerald-700">100% Completed</span>
                    </div>
                  </div>
                </div>

                {/* Quick Move Accessible Links */}
                {onStatusChange && availableMoves.length > 0 && (
                  <div className="sr-only" aria-hidden="true">
                    {availableMoves.map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onStatusChange(task.id, target);
                        }}
                        data-testid={`quick-move-${task.id}-to-${target}`}
                      >
                        Move to {TASK_STATUS_LABELS[target]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
