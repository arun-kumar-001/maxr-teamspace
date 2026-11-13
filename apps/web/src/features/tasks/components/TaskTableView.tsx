import { useMemo, useState } from 'react';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusPill } from './TaskStatusPill';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface TaskTableViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

export function TaskTableView({
  tasks,
  onSelectTask,
  onStatusChange,
  currentEmployeeId,
  isAdmin = false,
  className = '',
}: TaskTableViewProps) {
  const [dueSortAsc, setDueSortAsc] = useState<boolean>(true);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDate = a.dueDate ?? '9999-12-31';
      const bDate = b.dueDate ?? '9999-12-31';
      return dueSortAsc ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    });
  }, [tasks, dueSortAsc]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <div
      className={`w-full overflow-x-auto border border-border rounded-card bg-surface shadow-card ${className}`}
      data-testid="task-table-view"
    >
      <table className="w-full text-left border-collapse min-w-[760px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted/70 text-xs font-semibold text-text-subtle uppercase tracking-wider">
            <th className="py-3 px-4">Task</th>
            <th className="py-3 px-4">Project</th>
            <th className="py-3 px-4">Assignee</th>
            <th className="py-3 px-4">Priority</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">
              <button
                type="button"
                onClick={() => setDueSortAsc((prev) => !prev)}
                className="inline-flex items-center gap-1 hover:text-text font-semibold uppercase tracking-wider"
              >
                <span>Due</span>
                <span aria-hidden="true">{dueSortAsc ? '↑' : '↓'}</span>
              </button>
            </th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-sm">
          {sortedTasks.map((task) => {
            const isAssigner = Boolean(
              currentEmployeeId && task.assignerEmployeeId === currentEmployeeId,
            );
            const canCompleteOrReopen = Boolean(isAdmin || isAssigner);
            const allowedMoves = (TASK_TRANSITIONS[task.status] || []).filter((target) => {
              if (target === 'completed' || task.status === 'completed') {
                return canCompleteOrReopen;
              }
              return true;
            });

            return (
              <tr
                key={task.id}
                onClick={() => onSelectTask(task)}
                className={`hover:bg-surface-muted/50 transition-colors cursor-pointer group ${
                  task.isOverdue ? 'bg-rose-50/10' : ''
                }`}
                data-testid={`task-row-${task.id}`}
              >
                {/* Task Title */}
                <td className="py-3.5 px-4 font-medium text-text group-hover:text-primary-ink transition-colors max-w-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                        task.status === 'completed'
                          ? 'bg-primary border-primary text-sidebar'
                          : 'border-border-strong bg-surface'
                      }`}
                      aria-hidden="true"
                    >
                      {task.status === 'completed' && (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-semibold">{task.title}</span>
                      {task.isOverdue && (
                        <span className="text-[11px] font-semibold text-danger">Overdue</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Project */}
                <td className="py-3.5 px-4 whitespace-nowrap text-text-muted text-xs">
                  {task.projectName ? (
                    <span className="px-2 py-0.5 rounded bg-surface-muted border border-border">
                      {task.projectName}
                    </span>
                  ) : (
                    <span className="text-text-subtle italic">Standalone</span>
                  )}
                </td>

                {/* Assignee */}
                <td className="py-3.5 px-4 whitespace-nowrap text-text text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-semibold text-[10px] shrink-0">
                      {getInitials(task.assigneeName)}
                    </span>
                    <span className="font-medium">{task.assigneeName}</span>
                  </div>
                </td>

                {/* Priority */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TaskPriorityBadge priority={task.priority} />
                </td>

                {/* Status */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <TaskStatusPill status={task.status} size="sm" />
                </td>

                {/* Due Date */}
                <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                  <span
                    className={task.isOverdue ? 'text-danger font-semibold' : 'text-text-muted'}
                  >
                    {task.dueDate ?? 'No deadline'}
                  </span>
                </td>

                {/* Actions */}
                <td
                  className="py-3.5 px-4 whitespace-nowrap text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onStatusChange && allowedMoves.length > 0 ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {allowedMoves.slice(0, 2).map((target) => (
                        <button
                          key={target}
                          type="button"
                          onClick={() => onStatusChange(task.id, target)}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink transition-colors min-h-[32px]"
                          data-testid={`table-move-${task.id}-to-${target}`}
                        >
                          → {TASK_STATUS_LABELS[target]}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectTask(task)}
                      className="text-xs text-primary-ink font-medium hover:underline min-h-[32px] px-2"
                    >
                      View
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
