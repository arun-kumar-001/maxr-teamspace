import { formatRelativeTaskDue } from './TaskCard';
import { TaskStatusPill } from './TaskStatusPill';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface AssignedToMeViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
}

export function AssignedToMeView({
  tasks,
  onSelectTask,
  onStatusChange,
  currentEmployeeId,
  isAdmin = false,
}: AssignedToMeViewProps) {
  const myTasks = currentEmployeeId
    ? tasks.filter((t) => t.assigneeEmployeeId === currentEmployeeId)
    : tasks;

  const todayStr = new Date().toISOString().slice(0, 10);
  const openMine = myTasks.filter((t) => t.status !== 'completed');
  const completedCount = myTasks.filter((t) => t.status === 'completed').length;

  const todayTasks = openMine.filter(
    (t) => t.isOverdue || (t.dueDate !== null && t.dueDate <= todayStr),
  );
  const laterTasks = openMine.filter(
    (t) => !t.isOverdue && (t.dueDate === null || t.dueDate > todayStr),
  );

  const renderAgendaList = (title: string, items: Task[], emptyLabel: string) => (
    <div className="bg-surface rounded-card border border-border shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="font-display font-semibold text-sm text-text">{title}</h3>
        <span className="px-2 py-0.5 rounded-full bg-surface-muted border border-border text-xs font-semibold text-text-muted tabular-nums">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-text-muted py-6 text-center">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((task) => {
            const isAssigner = Boolean(
              currentEmployeeId && task.assignerEmployeeId === currentEmployeeId,
            );
            const canCompleteOrReopen = Boolean(isAdmin || isAssigner);
            const nextMove = (TASK_TRANSITIONS[task.status] || []).find((target) => {
              if (target === 'completed' || task.status === 'completed') {
                return canCompleteOrReopen;
              }
              return true;
            });

            return (
              <li
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-muted/40 px-2 -mx-2 rounded-control transition-colors"
                data-testid={`assigned-row-${task.id}`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 ${
                      task.isOverdue ? 'border-danger' : 'border-border-strong'
                    } bg-surface`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{task.title}</p>
                    <p className="text-xs text-text-muted truncate mt-0.5">
                      {task.projectName ?? 'Standalone task'} ·{' '}
                      <span className={task.isOverdue ? 'text-danger font-semibold' : ''}>
                        {formatRelativeTaskDue(task.dueDate, false)}
                      </span>
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <TaskStatusPill status={task.status} size="sm" />
                  {onStatusChange && nextMove && (
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, nextMove)}
                      title={`Move to ${TASK_STATUS_LABELS[nextMove]}`}
                      aria-label={`Move ${task.title} to ${TASK_STATUS_LABELS[nextMove]}`}
                      className="w-7 h-7 rounded-input border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink flex items-center justify-center transition-colors text-xs"
                    >
                      ▶
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="assigned-to-me-view">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {renderAgendaList('Today', todayTasks, 'No tasks due today or overdue.')}
        {renderAgendaList('Later', laterTasks, 'No upcoming tasks scheduled.')}
      </div>

      <p className="text-xs text-text-muted flex items-center gap-1.5">
        <span aria-hidden="true">✓</span>
        <span>
          {completedCount} of {myTasks.length} {myTasks.length === 1 ? 'task' : 'tasks'} completed.
        </span>
      </p>
    </div>
  );
}
