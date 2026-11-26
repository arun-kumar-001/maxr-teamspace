import { useState, useEffect, useRef } from 'react';
import { TaskCard } from './TaskCard';
import { MobileTaskCard } from './MobileTaskCard';
import { CompletedTasksCard } from './CompletedTasksCard';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS } from '../types';

export interface TaskKanbanBoardProps {
  columns: Record<TaskStatus, Task[]>;
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void | Promise<unknown>;
  onToggleDailyDone?: (taskId: string) => void;
  onQuickCreateClick?: () => void;
  canCreate?: boolean;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
  layoutMode?: 'auto' | 'mobile' | 'desktop';
}

interface TouchDragState {
  task: Task;
  cardWidth: number;
  cardHeight: number;
  offsetX: number;
  offsetY: number;
  currentX: number;
  currentY: number;
}

const COLUMN_KEYS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'completed'];

const COLUMN_HEADER_TONES: Record<TaskStatus, { dot: string; border: string }> = {
  todo: { dot: 'bg-text-subtle', border: 'border-t-text-subtle' },
  in_progress: { dot: 'bg-primary-strong', border: 'border-t-primary-strong' },
  in_review: { dot: 'bg-blue-600', border: 'border-t-blue-600' },
  blocked: { dot: 'bg-[#493548]', border: 'border-t-[#493548]' },
  completed: { dot: 'bg-emerald-600', border: 'border-t-emerald-600' },
};

export function TaskKanbanBoard({
  columns,
  onSelectTask,
  onStatusChange,
  onToggleDailyDone,
  onQuickCreateClick,
  canCreate = false,
  currentEmployeeId,
  isAdmin = false,
  className = '',
  layoutMode = 'auto',
}: TaskKanbanBoardProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldRenderMobile = layoutMode === 'mobile' || (layoutMode !== 'desktop' && isMobile);

  const [draggedItem, setDraggedItem] = useState<{
    task: Task;
    canCompleteOrReopen: boolean;
  } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);

  // Mobile Touch Drag-and-Drop state & refs
  const [touchDragState, setTouchDragState] = useState<TouchDragState | null>(null);
  const [touchHoverCol, setTouchHoverCol] = useState<TaskStatus | null>(null);
  const mobileColumnRefs = useRef<Record<TaskStatus, HTMLDivElement | null>>({
    todo: null,
    in_progress: null,
    in_review: null,
    blocked: null,
    completed: null,
  });

  const canDropInto = (targetCol: TaskStatus): boolean => {
    if (!draggedItem || !onStatusChange) return false;
    const { task } = draggedItem;
    if (task.status === targetCol) return false;
    // CRITICAL RESTRICTION: Employees cannot move tasks directly to Completed or reopen; only Admin can.
    if ((targetCol === 'completed' || task.status === 'completed') && !isAdmin) {
      return false;
    }
    return true;
  };

  const handleTouchDragStart = (
    e: React.TouchEvent | React.MouseEvent,
    task: Task,
    _source: 'handle' | 'longpress',
    cardRect: DOMRect,
  ) => {
    if (!onStatusChange) return;
    const clientX =
      'touches' in e && e.touches[0]
        ? e.touches[0].clientX
        : 'clientX' in e
          ? e.clientX
          : cardRect.left + cardRect.width / 2;
    const clientY =
      'touches' in e && e.touches[0]
        ? e.touches[0].clientY
        : 'clientY' in e
          ? e.clientY
          : cardRect.top + cardRect.height / 2;

    const offsetX = Math.max(10, Math.min(cardRect.width - 10, clientX - cardRect.left));
    const offsetY = Math.max(10, Math.min(cardRect.height - 10, clientY - cardRect.top));

    setDraggedItem({ task, canCompleteOrReopen: Boolean(isAdmin) });
    setTouchDragState({
      task,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      offsetX,
      offsetY,
      currentX: clientX,
      currentY: clientY,
    });
    setTouchHoverCol(task.status);
    setDropNotice(null);
  };

  // Window listeners for touch-dragging & edge auto-scrolling
  useEffect(() => {
    if (!touchDragState) return;

    const handlePointerMove = (cx: number, cy: number) => {
      setTouchDragState((prev) => (prev ? { ...prev, currentX: cx, currentY: cy } : null));

      // Auto-scrolling when approaching top or bottom edge (within 80px)
      if (typeof window !== 'undefined') {
        const vh = window.innerHeight;
        if (cy < 80) {
          const intensity = Math.max(4, Math.min(18, Math.round((80 - cy) / 4)));
          window.scrollBy({ top: -intensity, behavior: 'auto' });
        } else if (cy > vh - 80) {
          const intensity = Math.max(4, Math.min(18, Math.round((cy - (vh - 80)) / 4)));
          window.scrollBy({ top: intensity, behavior: 'auto' });
        }
      }

      // Check which column is hovered
      let hovered: TaskStatus | null = null;
      for (const key of COLUMN_KEYS) {
        const el = mobileColumnRefs.current[key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (cy >= rect.top - 12 && cy <= rect.bottom + 12) {
          hovered = key;
          break;
        }
      }
      setTouchHoverCol(hovered);
    };

    const onWindowTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      if (e.cancelable) e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const finishDrag = () => {
      const activeState = touchDragState;
      const targetCol = touchHoverCol;

      setTouchDragState(null);
      setTouchHoverCol(null);
      setDraggedItem(null);

      if (!activeState || !targetCol || !onStatusChange) return;
      const { task } = activeState;

      if (targetCol === task.status) return;

      // Restrict employees from completing tasks
      if ((targetCol === 'completed' || task.status === 'completed') && !isAdmin) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([60, 50, 60]);
          } catch {}
        }
        setDropNotice(
          'Employees cannot move tasks directly to Completed. An Administrator must review and approve.',
        );
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(35);
        } catch {}
      }

      setDropNotice(null);
      void Promise.resolve(onStatusChange(task.id, targetCol)).catch((err: unknown) => {
        setDropNotice(err instanceof Error ? err.message : 'The status could not be changed.');
      });
    };

    const onWindowTouchEnd = () => {
      finishDrag();
    };

    const onWindowMouseUp = () => {
      finishDrag();
    };

    window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd);
    window.addEventListener('touchcancel', onWindowTouchEnd);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
      window.removeEventListener('touchcancel', onWindowTouchEnd);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [touchDragState, touchHoverCol, onStatusChange, isAdmin]);

  const handleDrop = (e: React.DragEvent, targetCol: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedItem || !onStatusChange) return;

    const { task } = draggedItem;
    setDraggedItem(null);

    if (task.status === targetCol) return;

    if ((targetCol === 'completed' || task.status === 'completed') && !isAdmin) {
      setDropNotice(
        'Employees cannot move tasks directly to Completed. An Administrator must review and approve.',
      );
      return;
    }

    setDropNotice(null);
    void Promise.resolve(onStatusChange(task.id, targetCol)).catch((err: unknown) => {
      setDropNotice(err instanceof Error ? err.message : 'The status could not be changed.');
    });
  };

  return (
    <div className={`w-full space-y-3 ${className}`}>
      {dropNotice && (
        <div
          role="alert"
          className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{dropNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDropNotice(null)}
            className="font-bold hover:underline shrink-0 cursor-pointer text-amber-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Conditional Layout: Desktop (grid >= 768px) vs Mobile (stacked < 768px) */}
      {!shouldRenderMobile ? (
        /* Desktop Kanban Board (>= md) */
        <div
          className="w-full pb-4 overflow-x-auto xl:overflow-x-visible"
          data-testid="task-kanban-board"
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start w-full min-w-0 xl:min-w-[1100px] 2xl:min-w-0">
            {COLUMN_KEYS.map((colKey) => {
              const tasksInCol = columns[colKey] || [];
              const tone = COLUMN_HEADER_TONES[colKey];
              const label = TASK_STATUS_LABELS[colKey];
              const isOver = dragOverCol === colKey;
              const validTarget = isOver && canDropInto(colKey);
              const invalidTarget = isOver && draggedItem !== null && !canDropInto(colKey);

              if (colKey === 'completed') {
                return (
                  <div
                    key={colKey}
                    onDragOver={(e) => {
                      if (!onStatusChange) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = canDropInto(colKey) ? 'move' : 'none';
                      if (dragOverCol !== colKey) setDragOverCol(colKey);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                      setDragOverCol((prev) => (prev === colKey ? null : prev));
                    }}
                    onDrop={(e) => handleDrop(e, colKey)}
                    className={`min-w-0 transition-all duration-150 ${
                      validTarget
                        ? 'ring-2 ring-primary scale-[1.01]'
                        : invalidTarget
                          ? 'ring-2 ring-danger/40'
                          : ''
                    }`}
                    data-testid={`kanban-column-${colKey}`}
                  >
                    <CompletedTasksCard
                      tasks={tasksInCol}
                      onSelectTask={onSelectTask}
                      onStatusChange={onStatusChange}
                      currentEmployeeId={currentEmployeeId}
                      isAdmin={isAdmin}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={colKey}
                  onDragOver={(e) => {
                    if (!onStatusChange) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = canDropInto(colKey) ? 'move' : 'none';
                    if (dragOverCol !== colKey) setDragOverCol(colKey);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverCol((prev) => (prev === colKey ? null : prev));
                  }}
                  onDrop={(e) => handleDrop(e, colKey)}
                  className={`min-w-0 rounded-card border border-border border-t-4 ${tone.border} p-2.5 flex flex-col gap-2.5 transition-all duration-150 ${
                    validTarget
                      ? 'bg-teal-50/70 ring-2 ring-primary border-primary shadow-lg scale-[1.01]'
                      : invalidTarget
                        ? 'bg-rose-50/40 ring-2 ring-danger/40'
                        : 'bg-surface-muted/70'
                  }`}
                  data-testid={`kanban-column-${colKey}`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border/80">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                      <h3 className="font-semibold text-sm text-text">{label}</h3>
                      <span
                        className="px-2 py-0.5 text-xs font-semibold rounded-full bg-surface text-text-subtle border border-border tabular-nums"
                        data-testid={`column-count-${colKey}`}
                      >
                        {tasksInCol.length}
                      </span>
                    </div>
                    {canCreate && onQuickCreateClick && (
                      <button
                        type="button"
                        onClick={onQuickCreateClick}
                        aria-label={`Add task to ${label}`}
                        className="w-7 h-7 rounded-input text-text-muted hover:text-text hover:bg-surface flex items-center justify-center transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Cards Container */}
                  <div
                    className={`flex flex-col gap-2.5 min-h-[160px] transition-colors rounded-lg ${
                      validTarget ? 'bg-primary-soft/20 p-1' : ''
                    }`}
                  >
                    {validTarget && (
                      <div className="flex items-center justify-center h-14 border-2 border-dashed border-teal-400 bg-teal-50/80 rounded-xl text-xs font-semibold text-teal-800 shadow-2xs select-none animate-pulse">
                        Drop to move to {label}
                      </div>
                    )}

                    {tasksInCol.length === 0 && !validTarget ? (
                      <div className="flex items-center justify-center h-28 border border-dashed rounded-lg text-xs select-none border-border text-text-subtle">
                        No {label.toLowerCase()} tasks
                      </div>
                    ) : (
                      tasksInCol.map((task) => (
                        <div
                          key={task.id}
                          className={
                            draggedItem && draggedItem.task.id !== task.id
                              ? 'pointer-events-none'
                              : undefined
                          }
                        >
                          <TaskCard
                            task={task}
                            onSelect={onSelectTask}
                            onStatusChange={onStatusChange}
                            onToggleDailyDone={onToggleDailyDone}
                            onDragStart={(t, canCompleteOrReopen) => {
                              setDropNotice(null);
                              setDraggedItem({ task: t, canCompleteOrReopen });
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDragOverCol(null);
                            }}
                            isDragging={draggedItem?.task.id === task.id}
                            currentEmployeeId={currentEmployeeId}
                            isAdmin={isAdmin}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Mobile Kanban Board (< md screen widths: Vertically Stacked Sections) */
        <div
          className="flex flex-col gap-4 w-full min-w-0"
          data-testid="task-kanban-board"
        >
          {COLUMN_KEYS.map((colKey) => {
            const tasksInCol = columns[colKey] || [];
            const tone = COLUMN_HEADER_TONES[colKey];
            const label = TASK_STATUS_LABELS[colKey];
            const isOver = dragOverCol === colKey;
            const isTouchOver = touchHoverCol === colKey;
            const effectiveIsOver = isOver || isTouchOver;
            const validTarget = effectiveIsOver && canDropInto(colKey);
            const invalidTarget = effectiveIsOver && draggedItem !== null && !canDropInto(colKey);

            if (colKey === 'completed') {
              return (
                <div
                  key={colKey}
                  ref={(el) => {
                    mobileColumnRefs.current[colKey] = el;
                  }}
                  onDragOver={(e) => {
                    if (!onStatusChange) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = canDropInto(colKey) ? 'move' : 'none';
                    if (dragOverCol !== colKey) setDragOverCol(colKey);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    setDragOverCol((prev) => (prev === colKey ? null : prev));
                  }}
                  onDrop={(e) => handleDrop(e, colKey)}
                  className={`w-full min-w-0 transition-all duration-150 ${
                    validTarget
                      ? 'ring-2 ring-primary scale-[1.01]'
                      : invalidTarget
                        ? 'ring-2 ring-danger/40'
                        : ''
                  }`}
                  data-testid={`kanban-column-${colKey}`}
                >
                  <CompletedTasksCard
                    tasks={tasksInCol}
                    onSelectTask={onSelectTask}
                    onStatusChange={onStatusChange}
                    currentEmployeeId={currentEmployeeId}
                    isAdmin={isAdmin}
                  />
                </div>
              );
            }

            return (
              <div
                key={colKey}
                ref={(el) => {
                  mobileColumnRefs.current[colKey] = el;
                }}
                onDragOver={(e) => {
                  if (!onStatusChange) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = canDropInto(colKey) ? 'move' : 'none';
                  if (dragOverCol !== colKey) setDragOverCol(colKey);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverCol((prev) => (prev === colKey ? null : prev));
                }}
                onDrop={(e) => handleDrop(e, colKey)}
                className={`w-full min-w-0 rounded-2xl border border-border border-t-4 ${tone.border} p-3.5 bg-surface-muted/50 flex flex-col gap-3 transition-all duration-150 ${
                  validTarget
                    ? 'bg-teal-50/70 ring-2 ring-primary border-primary shadow-md'
                    : invalidTarget
                      ? 'bg-rose-50/40 ring-2 ring-danger/40'
                      : ''
                }`}
                data-testid={`kanban-column-${colKey}`}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border/80">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                    <h3 className="font-semibold text-sm text-text">{label}</h3>
                    <span
                      className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white text-text-subtle border border-border tabular-nums"
                      data-testid={`column-count-${colKey}`}
                    >
                      {tasksInCol.length}
                    </span>
                  </div>
                  {colKey === 'todo' && canCreate && onQuickCreateClick && (
                    <button
                      type="button"
                      onClick={onQuickCreateClick}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-soft text-primary-ink border border-primary-strong/20 hover:bg-primary-soft/80 transition-colors cursor-pointer"
                    >
                      + Add Task
                    </button>
                  )}
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-2.5 w-full min-w-0">
                  {validTarget && (
                    <div className="flex items-center justify-center h-14 border-2 border-dashed border-teal-400 bg-teal-50/80 rounded-xl text-xs font-semibold text-teal-800 shadow-2xs select-none animate-pulse">
                      Drop to move to {label}
                    </div>
                  )}
                  {invalidTarget && (
                    <div className="flex items-center justify-center h-12 border-2 border-dashed border-rose-300 bg-rose-50/90 rounded-xl text-xs font-semibold text-rose-800 shadow-2xs select-none">
                      Only an Administrator can complete tasks
                    </div>
                  )}

                  {tasksInCol.length === 0 && !validTarget ? (
                    <div className="flex items-center justify-center py-6 border border-dashed rounded-xl text-xs select-none border-border text-text-subtle bg-white/60">
                      No {label.toLowerCase()} tasks
                    </div>
                  ) : (
                    tasksInCol.map((task) => (
                      <div
                        key={task.id}
                        className={
                          draggedItem && draggedItem.task.id !== task.id
                            ? 'pointer-events-none'
                            : undefined
                        }
                      >
                        <MobileTaskCard
                          task={task}
                          onSelect={onSelectTask}
                          onStatusChange={onStatusChange}
                          onToggleDailyDone={onToggleDailyDone}
                          onDragStart={(t, canCompleteOrReopen) => {
                            setDropNotice(null);
                            setDraggedItem({ task: t, canCompleteOrReopen });
                          }}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverCol(null);
                          }}
                          onTouchDragStart={handleTouchDragStart}
                          isDragging={draggedItem?.task.id === task.id && !touchDragState}
                          isTouchDragging={touchDragState?.task.id === task.id}
                          currentEmployeeId={currentEmployeeId}
                          isAdmin={isAdmin}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Floating Preview Ghost Clone while touch-dragging */}
          {touchDragState && (
            <div
              className="fixed pointer-events-none z-50 transition-none shadow-2xl rounded-2xl border-2 border-primary scale-[1.02] rotate-[1deg] opacity-95 bg-white overflow-hidden ring-4 ring-primary/20"
              style={{
                left: `${touchDragState.currentX - touchDragState.offsetX}px`,
                top: `${touchDragState.currentY - touchDragState.offsetY}px`,
                width: `${touchDragState.cardWidth}px`,
              }}
              data-testid="floating-task-preview"
            >
              <MobileTaskCard
                task={touchDragState.task}
                onSelect={() => {}}
                currentEmployeeId={currentEmployeeId}
                isAdmin={isAdmin}
                previewMode
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
