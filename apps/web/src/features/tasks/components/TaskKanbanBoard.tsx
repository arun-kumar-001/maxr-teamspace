import { useState } from 'react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface TaskKanbanBoardProps {
  columns: Record<TaskStatus, Task[]>;
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
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
    const allowed = TASK_TRANSITIONS[task.status] || [];
    if (!allowed.includes(targetCol)) return false;
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

    const allowed = TASK_TRANSITIONS[task.status] || [];
    if (!allowed.includes(targetCol)) {
      setDropNotice(
        `Cannot move "${task.title}" directly from ${TASK_STATUS_LABELS[task.status]} to ${TASK_STATUS_LABELS[targetCol]}.`,
      );
      return;
    }

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
            className="font-bold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        className="w-full overflow-x-auto pb-4 snap-x snap-mandatory"
        data-testid="task-kanban-board"
      >
        <div className="flex gap-4 min-w-[1300px] xl:min-w-full items-start">
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
                onDragLeave={() => {
                  if (dragOverCol === colKey) setDragOverCol(null);
                }}
                onDrop={(e) => handleDrop(e, colKey)}
                className={`flex-1 min-w-[260px] rounded-card border border-border border-t-4 ${tone.border} p-3.5 flex flex-col gap-3 snap-start transition-all duration-200 ${
                  validTarget
                    ? 'bg-primary-surface/50 ring-2 ring-primary scale-[1.01] shadow-raised'
                    : invalidTarget
                      ? 'bg-rose-50/40 ring-2 ring-danger/40'
                      : 'bg-surface-muted/60'
                }`}
                data-testid={`kanban-column-${colKey}`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                    <h3 className="font-semibold text-sm text-text">{label}</h3>
                  </div>
                  <span
                    className="px-2 py-0.5 text-xs font-semibold rounded-full bg-surface text-text-subtle border border-border tabular-nums"
                    data-testid={`column-count-${colKey}`}
                  >
                    {tasksInCol.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex flex-col gap-2.5 min-h-[160px]">
                  {tasksInCol.length === 0 ? (
                    <div
                      className={`flex items-center justify-center h-28 border border-dashed rounded-lg text-xs select-none transition-colors ${
                        validTarget
                          ? 'border-primary text-primary-ink bg-primary-surface/30 font-medium'
                          : 'border-border text-text-subtle'
                      }`}
                    >
                      {validTarget ? `Drop to move to ${label}` : `No ${label.toLowerCase()} tasks`}
                    </div>
                  ) : (
                    tasksInCol.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onSelect={onSelectTask}
                        onStatusChange={onStatusChange}
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
