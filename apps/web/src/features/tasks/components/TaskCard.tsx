import { useState } from 'react';
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const allowedMoves = TASK_TRANSITIONS[task.status] || [];
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

  // Completion percentage computation
  const completionPercentage =
    task.completionPercentage !== undefined
      ? task.completionPercentage
      : task.status === 'completed'
        ? 100
        : task.status === 'in_review'
          ? 85
          : task.status === 'in_progress'
            ? 55
            : task.status === 'blocked'
              ? 30
              : 15;

  const category = task.category || (task.projectName ? 'Engineering' : 'General');
  const attachmentCount = task.attachmentCount ?? 2;
  const commentCount = task.commentCount ?? 3;

  const formatDisplayDate = (dateStr: string | null | undefined, prefix: string) => {
    if (!dateStr) return `${prefix}: N/A`;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return `${prefix}: ${dateStr}`;
      return `${prefix}: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    } catch {
      return `${prefix}: ${dateStr}`;
    }
  };

  const startDateDisplay = formatDisplayDate(task.startDate || task.createdAt, 'Start');
  const dueDateDisplay = formatDisplayDate(task.dueDate, 'Due');

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
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
        isDragging ? 'opacity-50 scale-95 border-dashed border-primary-strong' : ''
      } ${task.isOverdue ? 'border-rose-300 bg-rose-50/10' : ''} ${className}`}
    >
      <div>
        {/* Top Badges & Actions */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <TaskPriorityBadge priority={task.priority} />
            {/* Task Category Tag */}
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary-soft text-primary-ink border border-primary-strong/20">
              {category}
            </span>
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

          <div className="flex items-center gap-1">
            <TaskStatusPill status={task.status} size="sm" />

            {/* Three-Dot Action Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="p-1 text-text-subtle hover:text-text hover:bg-surface-muted rounded-md transition-colors"
                aria-label="Task options"
                title="Task actions"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 5v.01M12 12v.01M12 19v.01"
                  />
                </svg>
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-xl shadow-raised border border-border py-1.5 z-30 flex flex-col text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSelect(task);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-muted text-text transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-3.5 h-3.5 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    View Details
                  </button>

                  {onStatusChange && availableMoves.length > 0 && (
                    <div className="border-t border-border my-1 pt-1">
                      <div className="px-3 py-1 text-[10px] uppercase font-semibold text-text-subtle">
                        Move to
                      </div>
                      {availableMoves.map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onStatusChange(task.id, target);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-primary-soft hover:text-primary-ink text-text transition-colors flex items-center gap-2"
                        >
                          → {TASK_STATUS_LABELS[target]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Title */}
        <h4 className="font-semibold text-text text-sm group-hover:text-primary-ink transition-colors line-clamp-2 mb-1">
          {task.title}
        </h4>

        {/* Short Description */}
        {task.description && (
          <p className="text-xs text-text-muted line-clamp-2 mb-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Project Tag */}
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

        {/* Completion Progress Bar */}
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-text-subtle">
            <span>Progress</span>
            <span className="font-semibold text-text">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-surface-muted h-1.5 rounded-full overflow-hidden border border-border/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                completionPercentage === 100
                  ? 'bg-emerald-500'
                  : completionPercentage >= 50
                    ? 'bg-primary'
                    : 'bg-primary-strong'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Info: Assignee, Dates & Collaboration Stats */}
      <div className="pt-2.5 border-t border-border flex flex-col gap-2 mt-1">
        {/* Row 1: Assignee & Dates */}
        <div className="flex items-center justify-between text-xs text-text-subtle gap-2 flex-wrap">
          {/* Assigned Employee Avatar & Name */}
          <div
            className="flex items-center gap-1.5 min-w-0"
            title={`Assignee: ${task.assigneeName}`}
          >
            <div className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-semibold text-[10px] shrink-0 border border-primary-strong/20">
              {getInitials(task.assigneeName)}
            </div>
            <span className="truncate text-xs font-medium text-text">{task.assigneeName}</span>
          </div>

          {/* Dates: Start & Due */}
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-text-subtle">{startDateDisplay}</span>
            <span>•</span>
            <span className={task.isOverdue ? 'text-danger font-medium' : 'text-text-subtle'}>
              {dueDateDisplay}
            </span>
          </div>
        </div>

        {/* Row 2: Collaboration Metadata (Attachments, Comments) & Quick Moves */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px] text-text-subtle">
          <div className="flex items-center gap-3">
            {/* Attachment Count */}
            <div className="flex items-center gap-1" title={`${attachmentCount} attachments`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              <span>{attachmentCount}</span>
            </div>

            {/* Comment Count */}
            <div className="flex items-center gap-1" title={`${commentCount} comments`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <span>{commentCount}</span>
            </div>
          </div>

          {/* Quick Transition Buttons */}
          {onStatusChange && availableMoves.length > 0 && (
            <div
              className="flex items-center gap-1 overflow-x-auto"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {availableMoves.map((target) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => onStatusChange(task.id, target)}
                  className="px-2 py-0.5 text-[10px] font-medium rounded border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink hover:border-primary-strong/30 transition-colors shrink-0"
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
    </div>
  );
}
