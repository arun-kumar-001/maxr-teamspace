import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';
import { TaskPriorityBadge } from './TaskPriorityBadge';

export interface TaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onToggleDailyDone?: (taskId: string) => void;
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
  if (diffDays > 1 && diffDays <= 45) return `in ${diffDays}d`;
  if (diffDays < -1 && diffDays >= -45) return `${Math.abs(diffDays)}d ago`;
  return dueDate;
}

export function formatTaskDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  const target = new Date(dueDate);
  if (Number.isNaN(target.getTime())) return dueDate;
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatTaskCreated(createdAt: string | null): string {
  if (!createdAt) return 'Recent';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getAvatarBg(name: string): string {
  const colors = [
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-purple-100 text-purple-800 border-purple-200',
  ];
  if (!name) return colors[0]!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

const STATUS_PROGRESS: Record<
  TaskStatus,
  { pct: number; barClass: string; textClass: string; label: string }
> = {
  todo: { pct: 15, barClass: 'bg-slate-300', textClass: 'text-slate-600', label: 'To Do' },
  in_progress: {
    pct: 50,
    barClass: 'bg-teal-500',
    textClass: 'text-teal-700',
    label: 'In Progress',
  },
  in_review: {
    pct: 80,
    barClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    label: 'In Review',
  },
  completed: {
    pct: 100,
    barClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    label: 'Completed',
  },
  blocked: { pct: 25, barClass: 'bg-rose-500', textClass: 'text-rose-700', label: 'Hold' },
};

export function TaskCard({
  task,
  onSelect,
  onStatusChange,
  onToggleDailyDone,
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

  const dueRelative = formatRelativeTaskDue(task.dueDate, task.status === 'completed');
  const dueFormatted = formatTaskDueDate(task.dueDate);
  const createdFormatted = formatTaskCreated(task.createdAt);
  const todayStr = new Date().toISOString().slice(0, 10);
  const isDoneToday = Boolean(task.isDaily && task.dailyLastDoneDate === todayStr);
  const progress = STATUS_PROGRESS[task.status] || STATUS_PROGRESS.todo;
  const projectName = task.projectName || 'General Task';

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
      className={`group relative flex flex-col justify-between p-3.5 bg-white rounded-xl border border-border/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-teal-400 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px] ${
        task.isOverdue ? 'border-rose-300 ring-1 ring-rose-200' : ''
      } ${
        isDragging
          ? 'opacity-40 scale-[0.97] ring-2 ring-primary border-primary shadow-lg cursor-grabbing'
          : 'cursor-grab active:cursor-grabbing'
      } ${className}`}
    >
      <div className="space-y-2">
        {/* Top Header: Project Badge (Left) and Priority / Daily Badge (Right) */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-teal-50 text-teal-800 border border-teal-200/80 truncate max-w-[140px]">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
            <span className="truncate">{projectName}</span>
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {task.isDaily && (
              <button
                type="button"
                onClick={(e) => {
                  if (onToggleDailyDone) {
                    e.stopPropagation();
                    onToggleDailyDone(task.id);
                  }
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold border transition-colors cursor-pointer ${
                  isDoneToday
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-primary-soft text-primary-ink border-primary-strong/20 hover:bg-primary-soft/80'
                }`}
                title={
                  isDoneToday
                    ? 'Completed today (Click to toggle)'
                    : 'Daily task (Click to complete)'
                }
                data-testid={`daily-badge-${task.id}`}
              >
                <svg
                  className="w-2.5 h-2.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>{isDoneToday ? 'Daily ✓' : 'Daily'}</span>
              </button>
            )}

            <TaskPriorityBadge priority={task.priority} />
          </div>
        </div>

        {/* Task Title */}
        <h4 className="font-semibold text-text text-[13px] sm:text-sm leading-snug group-hover:text-primary-ink transition-colors line-clamp-2">
          {task.title}
        </h4>

        {/* Task Description Preview */}
        {task.description && (
          <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed font-normal">
            {task.description}
          </p>
        )}

        {/* Dates Block with Clean SVG Icons (No Emojis) */}
        <div className="bg-surface-muted/50 rounded-lg p-2 border border-border/50 text-[10.5px] space-y-1">
          {/* Due date row */}
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
            {task.isOverdue ? (
              <span
                className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 truncate"
                title={`Overdue (${task.dueDate ?? ''})`}
                data-testid="overdue-badge"
              >
                {dueFormatted} ({dueRelative})
              </span>
            ) : task.dueDate ? (
              <span className="font-medium text-text truncate">
                {dueFormatted} <span className="text-text-subtle font-normal">({dueRelative})</span>
              </span>
            ) : (
              <span className="text-text-subtle italic">No due date</span>
            )}
          </div>

          {/* Created date row */}
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
                <polyline points="12 6 12 12 16 14" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span>Created:</span>
            </span>
            <span className="text-text-muted font-medium truncate">{createdFormatted}</span>
          </div>
        </div>
      </div>

      {/* Footer Section: Clean Assignee & Progress */}
      <div className="flex flex-col gap-2 mt-2.5 pt-2 border-t border-border/60">
        {/* Clean Assignee Row (No redundant '(Assignee)' or repeating 'Assigned by...') */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div
            className="flex items-center gap-2 min-w-0"
            title={`Assigned to ${task.assigneeName}${
              task.assignerName ? ` · Assigned by ${task.assignerName}` : ''
            }`}
          >
            <div
              className={`w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 border shadow-2xs ring-1 ring-white ${getAvatarBg(
                task.assigneeName,
              )}`}
            >
              {getInitials(task.assigneeName)}
            </div>
            <span className="font-medium text-text text-[11.5px] truncate">
              {task.assigneeName}
            </span>
          </div>
        </div>

        {/* Workflow Lifecycle Progress Bar */}
        <div className="space-y-1 pt-0.5">
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progress.barClass}`}
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-text-subtle font-medium">Status</span>
            <span className={`font-semibold ${progress.textClass}`}>
              {progress.pct}% {progress.label}
            </span>
          </div>
        </div>

        {/* Visually Hidden Quick Move Buttons for Screen Reader Accessibility & Automated Tests */}
        {onStatusChange && availableMoves.length > 0 && (
          <div className="sr-only" aria-hidden="true">
            {availableMoves.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onStatusChange(task.id, target)}
                data-testid={`quick-move-${task.id}-to-${target}`}
              >
                Move to {TASK_STATUS_LABELS[target]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
