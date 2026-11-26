import { useState, useRef, useEffect } from 'react';
import { EmployeeAvatar } from '../../employees/components/EmployeeAvatar';
import type { Task, TaskStatus } from '../types';
import {
  TASK_STATUS_LABELS,
  formatTaskAssignmentInfo,
} from '../types';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { formatRelativeTaskDue, formatTaskDueDate } from './TaskCard';

export interface MobileTaskCardProps {
  task: Task;
  onSelect: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void | Promise<unknown>;
  onToggleDailyDone?: (taskId: string) => void;
  onDragStart?: (task: Task, canCompleteOrReopen: boolean) => void;
  onDragEnd?: () => void;
  onTouchDragStart?: (
    e: React.TouchEvent | React.MouseEvent,
    task: Task,
    source: 'handle' | 'longpress',
    cardRect: DOMRect,
  ) => void;
  isDragging?: boolean;
  isTouchDragging?: boolean;
  previewMode?: boolean;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
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
    barClass: 'bg-blue-500',
    textClass: 'text-blue-700',
    label: 'In Review',
  },
  completed: {
    pct: 100,
    barClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    label: 'Completed',
  },
  blocked: { pct: 25, barClass: 'bg-[#493548]', textClass: 'text-[#493548]', label: 'Hold' },
};

// Permitted employee statuses for "Move to" menu (Completed is excluded for employees)
const EMPLOYEE_MOVE_TARGETS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'blocked'];

export function MobileTaskCard({
  task,
  onSelect,
  onStatusChange,
  onToggleDailyDone,
  onDragStart,
  onDragEnd,
  onTouchDragStart,
  isDragging = false,
  isTouchDragging = false,
  previewMode = false,
  currentEmployeeId,
  isAdmin = false,
  className = '',
}: MobileTaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Touch long-press handling
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  // Close menu when tapping outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Clean up long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const assignmentInfo = formatTaskAssignmentInfo(task, currentEmployeeId);
  const isCompleted = task.status === 'completed';
  const progress = STATUS_PROGRESS[task.status] || STATUS_PROGRESS.todo;
  const dueRelative = formatRelativeTaskDue(task.dueDate, isCompleted);
  const dueFormatted = formatTaskDueDate(task.dueDate);
  const completedDateFormatted = formatTaskDueDate(task.completedAt || task.updatedAt);
  const todayStr = new Date().toISOString().slice(0, 10);
  const isDoneToday = Boolean(task.isDaily && task.dailyLastDoneDate === todayStr);

  const canCompleteOrReopen = Boolean(isAdmin);

  const handleStatusSelect = (target: TaskStatus) => {
    setIsMenuOpen(false);
    if (task.status === target || !onStatusChange) return;
    void onStatusChange(task.id, target);
  };

  // Touch long press handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (previewMode || isCompleted || !onStatusChange) return;
    clearLongPress();
    const touch = e.touches[0];
    if (e.touches.length !== 1 || !touch) {
      return;
    }
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
      onTouchDragStart?.(e, task, 'longpress', rect);
    }, 350);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const touch = e.touches[0];
    if (e.touches.length !== 1 || !touch) {
      clearLongPress();
      return;
    }
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // If movement exceeds 8px before timer expires, user is scrolling vertically: cancel drag!
    if (dx > 8 || dy > 8) {
      clearLongPress();
    }
  };

  const handleTouchEnd = () => {
    clearLongPress();
  };

  return (
    <div
      ref={cardRef}
      onClick={() => {
        if (!previewMode) onSelect(task);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!previewMode) onSelect(task);
        }
      }}
      draggable={Boolean(!previewMode && onStatusChange && !isCompleted)}
      onDragStart={(e) => {
        if (previewMode || !onStatusChange || isCompleted) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart?.(task, canCompleteOrReopen);
      }}
      onDragEnd={() => onDragEnd?.()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      tabIndex={previewMode ? -1 : 0}
      role={previewMode ? undefined : 'button'}
      aria-label={`Task: ${task.title}. ${assignmentInfo.typeLabel}. Status: ${task.status}. Priority: ${task.priority}.`}
      data-testid={`task-card-${task.id}`}
      className={`group relative flex flex-col justify-between p-3.5 sm:p-4 bg-white rounded-2xl border border-border shadow-[0_1px_3px_rgba(8,11,12,0.04)] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-strong w-full min-w-0 ${
        task.isOverdue && !isCompleted ? 'border-rose-300 ring-1 ring-rose-200' : ''
      } ${
        isTouchDragging
          ? 'opacity-25 border-dashed border-2 border-primary bg-primary-soft/30 pointer-events-none select-none shadow-none'
          : isDragging
            ? 'opacity-40 scale-[0.98] ring-2 ring-primary border-primary shadow-lg cursor-grabbing'
            : isCompleted || previewMode
              ? 'cursor-pointer'
              : 'cursor-grab active:cursor-grabbing hover:border-teal-400 hover:shadow-md'
      } ${className}`}
    >
      <div className="space-y-2.5 w-full min-w-0">
        {/* Top Row: Task Type Badge (Left) and Priority / Daily / Handle / Menu (Right) */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          {/* General Task vs Self Task Identity Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 select-none ${
              assignmentInfo.isSelf
                ? 'bg-primary-soft text-primary-ink border border-primary-strong/20'
                : 'bg-[#F4F1F4] text-[#493548] border border-[#493548]/20'
            }`}
            data-testid={`task-type-badge-${task.id}`}
            title={assignmentInfo.typeLabel}
          >
            {assignmentInfo.isSelf ? (
              // Single person icon for Self Task
              <svg
                className="w-3.5 h-3.5 text-primary-ink shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              // Two-person / team icon for General Task
              <svg
                className="w-3.5 h-3.5 text-[#493548] shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            )}
            <span className="font-semibold text-[11px] sm:text-xs">
              {assignmentInfo.typeLabel}
            </span>
          </div>

          {/* Right badges, Drag Handle & 3-dot Menu */}
          <div className="flex items-center gap-1 shrink-0">
            {task.isDaily && (
              <button
                type="button"
                onClick={(e) => {
                  if (onToggleDailyDone && !previewMode) {
                    e.stopPropagation();
                    onToggleDailyDone(task.id);
                  }
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                  isDoneToday
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-primary-soft text-primary-ink border-primary-strong/20 hover:bg-primary-soft/80'
                }`}
                title={isDoneToday ? 'Completed today' : 'Daily task'}
                data-testid={`daily-badge-${task.id}`}
              >
                <span>{isDoneToday ? 'Daily ✓' : 'Daily'}</span>
              </button>
            )}

            <TaskPriorityBadge priority={task.priority} />

            {/* Visible Six-Dot Drag Handle (::: ) for Mobile Touch Drag */}
            {!previewMode && !isCompleted && onStatusChange && (
              <button
                type="button"
                className="p-1 rounded-lg text-text-subtle hover:text-text hover:bg-surface-muted transition-colors cursor-grab active:cursor-grabbing select-none touch-none focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label={`Drag handle for task ${task.title}`}
                data-testid={`drag-handle-${task.id}`}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  clearLongPress();
                  if (!cardRef.current) return;
                  const rect = cardRef.current.getBoundingClientRect();
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try {
                      navigator.vibrate(40);
                    } catch {}
                  }
                  onTouchDragStart?.(e, task, 'handle', rect);
                }}
                onMouseDown={(e) => {
                  // Allow mouse drag via handle as well (desktop / emulator)
                  e.stopPropagation();
                  if (!cardRef.current) return;
                  const rect = cardRef.current.getBoundingClientRect();
                  onTouchDragStart?.(e, task, 'handle', rect);
                }}
              >
                <svg
                  className="w-4 h-4 text-text-subtle hover:text-text"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="6" r="1.5" />
                  <circle cx="16" cy="6" r="1.5" />
                  <circle cx="8" cy="12" r="1.5" />
                  <circle cx="16" cy="12" r="1.5" />
                  <circle cx="8" cy="18" r="1.5" />
                  <circle cx="16" cy="18" r="1.5" />
                </svg>
              </button>
            )}

            {/* Three-Dot Menu (•••) */}
            {!previewMode && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen((prev) => !prev);
                  }}
                  className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label={`Options for task ${task.title}`}
                  data-testid={`task-menu-btn-${task.id}`}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                    <circle cx="5" cy="12" r="1.5" />
                  </svg>
                </button>

                {/* Menu Dropdown Popup */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-7 z-30 w-48 bg-white rounded-xl shadow-xl border border-border p-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
                      Move to status
                    </div>

                    {EMPLOYEE_MOVE_TARGETS.map((targetStatus) => {
                      const isCurrent = task.status === targetStatus;
                      return (
                        <button
                          key={targetStatus}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => handleStatusSelect(targetStatus)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-primary-soft/60 text-primary-ink font-semibold cursor-default'
                              : 'hover:bg-surface-muted text-text cursor-pointer'
                          }`}
                          data-testid={`menu-move-${task.id}-to-${targetStatus}`}
                        >
                          <span>{TASK_STATUS_LABELS[targetStatus]}</span>
                          {isCurrent && <span className="text-[10px] text-primary-ink">✓</span>}
                        </button>
                      );
                    })}

                    {/* Only Admin can see and trigger Completed in menu */}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={isCompleted}
                        onClick={() => handleStatusSelect('completed')}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between text-emerald-700 hover:bg-emerald-50 transition-colors ${
                          isCompleted ? 'opacity-50 cursor-default' : 'cursor-pointer'
                        }`}
                        data-testid={`menu-move-${task.id}-to-completed`}
                      >
                        <span>Approve & Complete</span>
                        {isCompleted && <span className="text-[10px]">✓</span>}
                      </button>
                    )}

                    <div className="border-t border-border my-0.5" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onSelect(task);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:bg-surface-muted hover:text-text transition-colors cursor-pointer"
                    >
                      View Task Details
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Task Title */}
        <h4 className="font-semibold text-text text-sm sm:text-base leading-snug group-hover:text-primary-ink transition-colors line-clamp-2">
          {task.title}
        </h4>

        {/* Project Name and Due Date Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-muted text-text-muted border border-border/70 truncate max-w-[180px]">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" aria-hidden="true" />
            <span className="truncate">{task.projectName || 'Standalone'}</span>
          </span>

          {/* Due date info */}
          <div className="flex items-center gap-1 text-[11px] text-text-subtle truncate">
            <svg
              className="w-3.5 h-3.5 text-text-subtle/80 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {isCompleted ? (
              <span className="text-emerald-700 font-medium">Done</span>
            ) : task.isOverdue ? (
              <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                {dueFormatted} ({dueRelative})
              </span>
            ) : task.dueDate ? (
              <span>
                {dueFormatted} <span className="text-text-subtle">({dueRelative})</span>
              </span>
            ) : (
              <span className="italic">No due date</span>
            )}
          </div>
        </div>

        {/* Assignment Information: Dynamic Profile Photo, Name, and Role */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-surface-muted/60 border border-border/60 min-w-0">
          <EmployeeAvatar
            name={assignmentInfo.avatarName}
            employeeId={assignmentInfo.avatarEmployeeId}
            decorative
            className="w-7 h-7 text-[11px] font-bold shadow-2xs ring-1 ring-white/80 shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-medium text-text-subtle leading-tight">
              {assignmentInfo.attributionPrefix}
            </span>
            <span className="text-xs font-semibold text-text truncate leading-tight">
              {assignmentInfo.displayName}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Section: Progress Bar & Status */}
      <div className="mt-3 pt-2.5 border-t border-border/70 flex flex-col gap-1.5 w-full">
        {isCompleted ? (
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
              <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>100% Completed</span>
            </span>
            <span className="text-[11px] text-text-subtle font-mono">
              {completedDateFormatted}
            </span>
          </div>
        ) : (
          <div className="space-y-1 w-full">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress.barClass}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-text-subtle font-medium">Progress</span>
              <span className={`font-semibold ${progress.textClass}`}>
                {progress.pct}% {progress.label}
              </span>
            </div>
          </div>
        )}

        {/* Visually hidden quick move buttons for accessibility & automated tests */}
        {!previewMode && onStatusChange && (
          <div className="sr-only" aria-hidden="true">
            {EMPLOYEE_MOVE_TARGETS.filter((s) => s !== task.status).map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => onStatusChange(task.id, target)}
                data-testid={`quick-move-${task.id}-to-${target}`}
              >
                Move to {TASK_STATUS_LABELS[target]}
              </button>
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => onStatusChange(task.id, 'completed')}
                data-testid={`quick-move-${task.id}-to-completed`}
              >
                Approve & Move to Completed
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
