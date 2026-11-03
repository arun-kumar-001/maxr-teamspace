import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS } from '../types';

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
  return (
    <div
      className={`w-full overflow-x-auto pb-4 snap-x snap-mandatory ${className}`}
      data-testid="task-kanban-board"
    >
      <div className="flex gap-4 min-w-[1300px] xl:min-w-full items-start">
        {COLUMN_KEYS.map((colKey) => {
          const tasksInCol = columns[colKey] || [];
          const tone = COLUMN_HEADER_TONES[colKey];
          const label = TASK_STATUS_LABELS[colKey];

          return (
            <div
              key={colKey}
              className={`flex-1 min-w-[260px] bg-surface-muted/60 rounded-card border border-border border-t-4 ${tone.border} p-3.5 flex flex-col gap-3 snap-start`}
              data-testid={`kanban-column-${colKey}`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden="true" />
                  <h3 className="font-semibold text-sm text-text">{label}</h3>
                </div>
                <span
                  className="px-2 py-0.5 text-xs font-semibold rounded-full bg-surface text-text-subtle border border-border"
                  data-testid={`column-count-${colKey}`}
                >
                  {tasksInCol.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex flex-col gap-2.5 min-h-[160px]">
                {tasksInCol.length === 0 ? (
                  <div className="flex items-center justify-center h-28 border border-dashed border-border rounded-lg text-xs text-text-subtle select-none">
                    No {label.toLowerCase()} tasks
                  </div>
                ) : (
                  tasksInCol.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelect={onSelectTask}
                      onStatusChange={onStatusChange}
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
  );
}
