import { useState } from 'react';
import { TaskCard } from './TaskCard';
import type { Task, TaskStatus } from '../types';

export interface TaskKanbanBoardProps {
  columns: Record<TaskStatus, Task[]>;
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onAddTask?: (initialStatus?: TaskStatus) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

interface ColumnDef {
  key: TaskStatus;
  title: string;
  subtitle: string;
  dotColor: string;
  topBorderColor: string;
}

const PRIMARY_COLUMNS: ColumnDef[] = [
  {
    key: 'todo',
    title: 'BACKLOG',
    subtitle: 'Tasks waiting to be started.',
    dotColor: 'bg-text-subtle',
    topBorderColor: 'border-t-text-subtle',
  },
  {
    key: 'in_progress',
    title: 'IN PROGRESS',
    subtitle: 'Tasks currently being worked on.',
    dotColor: 'bg-primary-strong',
    topBorderColor: 'border-t-primary-strong',
  },
  {
    key: 'in_review',
    title: 'REVIEW',
    subtitle: 'Tasks waiting for manager or team-lead approval.',
    dotColor: 'bg-blue-600',
    topBorderColor: 'border-t-blue-600',
  },
  {
    key: 'completed',
    title: 'DONE',
    subtitle: 'Successfully completed tasks.',
    dotColor: 'bg-emerald-600',
    topBorderColor: 'border-t-emerald-600',
  },
];

export function TaskKanbanBoard({
  columns,
  onSelectTask,
  onStatusChange,
  onAddTask,
  currentEmployeeId,
  isAdmin = false,
  className = '',
}: TaskKanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [activeMenuCol, setActiveMenuCol] = useState<TaskStatus | null>(null);
  const [showBlockedColumn, setShowBlockedColumn] = useState(false);

  const blockedTasks = columns.blocked || [];

  const handleDragOver = (e: React.DragEvent, colKey: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCol !== colKey) {
      setDragOverCol(colKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, colKey: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && onStatusChange) {
      onStatusChange(taskId, colKey);
    }
  };

  return (
    <div className={`w-full flex flex-col gap-4 ${className}`} data-testid="task-kanban-board">
      {/* 4 Primary Columns Grid */}
      <div className="w-full overflow-x-auto pb-4 snap-x snap-mandatory">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[1020px] lg:min-w-full items-start">
          {PRIMARY_COLUMNS.map((col) => {
            const tasksInCol = columns[col.key] || [];
            const isDragTarget = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
                className={`flex-1 bg-surface-muted/60 rounded-card border border-border border-t-4 ${
                  col.topBorderColor
                } p-4 flex flex-col gap-3 snap-start transition-all min-h-[480px] ${
                  isDragTarget
                    ? 'ring-2 ring-primary-strong/40 border-primary-strong bg-primary-soft/30 shadow-raised'
                    : ''
                }`}
                data-testid={`kanban-column-${col.key}`}
              >
                {/* Column Header */}
                <div className="flex flex-col gap-1 pb-3 border-b border-border/80">
                  <div className="flex items-center justify-between">
                    {/* Title & Dot */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`}
                        aria-hidden="true"
                      />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-text font-display">
                        {col.title}
                      </h3>
                    </div>

                    {/* Right: Count Badge, Add Task (+), Three-Dot Menu */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 text-xs font-bold rounded-full bg-surface text-text-subtle border border-border shadow-xs"
                        data-testid={`column-count-${col.key}`}
                      >
                        {tasksInCol.length}
                      </span>

                      {/* Add Task (+) Button */}
                      <button
                        type="button"
                        onClick={() => onAddTask?.(col.key)}
                        className="p-1 rounded-md text-text-muted hover:text-primary-ink hover:bg-primary-soft transition-colors"
                        title={`Add task to ${col.title}`}
                        aria-label={`Add task to ${col.title}`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>

                      {/* Three-Dot Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuCol(activeMenuCol === col.key ? null : col.key)
                          }
                          className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
                          title={`Column options for ${col.title}`}
                          aria-label={`Options for ${col.title}`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 5v.01M12 12v.01M12 19v.01"
                            />
                          </svg>
                        </button>

                        {activeMenuCol === col.key && (
                          <div
                            className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-xl shadow-raised border border-border py-1.5 z-30 flex flex-col text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuCol(null);
                                onAddTask?.(col.key);
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
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                              Add Task
                            </button>
                            <div className="px-3 py-1 text-[11px] text-text-subtle border-t border-border mt-1 pt-1">
                              {tasksInCol.length} {tasksInCol.length === 1 ? 'task' : 'tasks'} total
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Subtitle */}
                  <p className="text-[11px] text-text-muted leading-tight">{col.subtitle}</p>
                </div>

                {/* Drop Zone & Cards Container */}
                <div
                  className={`flex flex-col gap-3 min-h-[220px] rounded-xl p-1 transition-colors ${
                    isDragTarget
                      ? 'bg-primary-soft/40 border-2 border-dashed border-primary-strong/50'
                      : ''
                  }`}
                >
                  {isDragTarget && (
                    <div className="py-3 px-2 text-center text-xs font-semibold text-primary-ink border-2 border-dashed border-primary-strong/60 rounded-xl bg-primary-soft/60 animate-pulse">
                      Drop here to move to {col.title}
                    </div>
                  )}

                  {tasksInCol.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 border border-dashed border-border rounded-xl text-xs text-text-subtle select-none p-4 text-center">
                      <span className="font-medium">No {col.title.toLowerCase()} tasks</span>
                      <span className="text-[11px] text-text-muted mt-1">
                        Drag a task here or click + to add
                      </span>
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

                  {/* Add Task button below the column cards */}
                  <button
                    type="button"
                    onClick={() => onAddTask?.(col.key)}
                    className="w-full py-2 px-3 rounded-xl border border-dashed border-border hover:border-primary-strong text-xs font-semibold text-text-muted hover:text-primary-ink flex items-center justify-center gap-1.5 transition-colors bg-surface-muted/20 hover:bg-primary-soft/30 mt-1"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Add Task</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blocked Column Section (Collapsible & Test-Compatible) */}
      <div
        className="w-full bg-surface rounded-card border border-border p-3 flex flex-col gap-2"
        data-testid="kanban-column-blocked"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-danger" aria-hidden="true" />
            <h4 className="font-bold text-xs uppercase tracking-wider text-text">BLOCKED TASKS</h4>
            <span
              className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-danger border border-rose-200"
              data-testid="column-count-blocked"
            >
              {blockedTasks.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowBlockedColumn(!showBlockedColumn)}
            className="text-xs text-text-muted hover:text-text font-medium px-2 py-1 rounded-md hover:bg-surface-muted transition-colors flex items-center gap-1"
          >
            <span>{showBlockedColumn ? 'Hide Blocked' : 'View Blocked'}</span>
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showBlockedColumn ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {showBlockedColumn && (
          <div
            onDragOver={(e) => handleDragOver(e, 'blocked')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'blocked')}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border"
          >
            {blockedTasks.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-text-subtle border border-dashed border-border rounded-xl">
                No blocked tasks currently.
              </div>
            ) : (
              blockedTasks.map((task) => (
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
        )}
      </div>
    </div>
  );
}
