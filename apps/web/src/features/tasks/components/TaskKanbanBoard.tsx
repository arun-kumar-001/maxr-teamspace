import { useState } from 'react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS } from '../types';

export interface TaskKanbanBoardProps {
  columns: Record<TaskStatus, Task[]>;
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onToggleDailyDone?: (taskId: string) => void;
  onQuickCreateClick?: () => void;
  canCreate?: boolean;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

const COLUMN_KEYS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'blocked', 'completed'];

const COLUMN_HEADER_TONES: Record<TaskStatus, { dot: string; border: string }> = {
  todo: { dot: 'bg-text-subtle', border: 'border-t-text-subtle' },
  in_progress: { dot: 'bg-primary-strong', border: 'border-t-primary-strong' },
  in_review: { dot: 'bg-blue-600', border: 'border-t-blue-600' },
  blocked: { dot: 'bg-danger', border: 'border-t-danger' },
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
}: TaskKanbanBoardProps) {
  const [draggedItem, setDraggedItem] = useState<{
    task: Task;
    canCompleteOrReopen: boolean;
  } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);

  const canDropInto = (targetCol: TaskStatus): boolean => {
    if (!draggedItem || !onStatusChange) return false;
    const { task, canCompleteOrReopen } = draggedItem;
    if (task.status === targetCol) return false;
    if ((targetCol === 'completed' || task.status === 'completed') && !canCompleteOrReopen) {
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent, targetCol: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedItem || !onStatusChange) return;

    const { task, canCompleteOrReopen } = draggedItem;
    setDraggedItem(null);

    if (task.status === targetCol) return;

    if ((targetCol === 'completed' || task.status === 'completed') && !canCompleteOrReopen) {
      setDropNotice('Only the task assigner or an Administrator may complete or reopen this task.');
      return;
    }

    setDropNotice(null);
    onStatusChange(task.id, targetCol);
  };

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {dropNotice && (
        <div
          role="alert"
          className="px-3.5 py-2 rounded-control bg-warning-soft border border-warning/30 text-xs text-warning-ink flex items-center justify-between gap-2"
        >
          <span>{dropNotice}</span>
          <button
            type="button"
            onClick={() => setDropNotice(null)}
            className="font-bold hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="w-full pb-4 overflow-x-auto" data-testid="task-kanban-board">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 items-start min-w-[1100px] 2xl:min-w-0">
          {COLUMN_KEYS.map((colKey) => {
            const tasksInCol = columns[colKey] || [];
            const tone = COLUMN_HEADER_TONES[colKey];
            const label = TASK_STATUS_LABELS[colKey];
            const isOver = dragOverCol === colKey;
            const validTarget = isOver && canDropInto(colKey);
            const invalidTarget = isOver && draggedItem !== null && !canDropInto(colKey);

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
                  {canCreate && onQuickCreateClick && colKey !== 'completed' && (
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
    </div>
  );
}
