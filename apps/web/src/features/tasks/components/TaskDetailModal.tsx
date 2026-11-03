import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TaskAttachmentsList } from './TaskAttachmentsList';
import { TaskCommentsThread } from './TaskCommentsThread';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusPill } from './TaskStatusPill';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<unknown>;
  onEditClick?: (task: Task) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onStatusChange,
  onEditClick,
  currentEmployeeId,
  isAdmin = false,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'attachments'>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setTransitionError(null);
    }
  }, [isOpen, task?.id]);

  if (!task) return null;

  const isAssigner = Boolean(currentEmployeeId && task.assignerEmployeeId === currentEmployeeId);
  const isAssignee = Boolean(currentEmployeeId && task.assigneeEmployeeId === currentEmployeeId);
  const canCompleteOrReopen = Boolean(isAdmin || isAssigner);
  const canEdit = Boolean((isAdmin || isAssigner) && task.status !== 'completed');

  const allowedMoves = (TASK_TRANSITIONS[task.status] || []).filter((target) => {
    if (target === 'completed' || task.status === 'completed') {
      return canCompleteOrReopen;
    }
    return true;
  });

  const handleTransition = async (newStatus: TaskStatus) => {
    if (!onStatusChange) return;
    setTransitioning(true);
    setTransitionError(null);

    try {
      await onStatusChange(task.id, newStatus);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setTransitionError(err.message);
      } else {
        setTransitionError('Failed to change status. Illegal transition.');
      }
    } finally {
      setTransitioning(false);
    }
  };

  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return 'None';
    try {
      return new Date(isoStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Task Details"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canEdit && onEditClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEditClick(task);
                }}
                data-testid="detail-edit-task-btn"
              >
                Edit Task
              </Button>
            )}
          </div>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-1" data-testid="task-detail-modal-content">
        {/* Top Header info */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <TaskPriorityBadge priority={task.priority} size="md" />
            <TaskStatusPill status={task.status} size="md" />
            {task.isOverdue && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-negative-soft text-danger border border-border rounded">
                Overdue
              </span>
            )}
            <span className="text-xs text-text-subtle ml-auto">Version {task.version}</span>
          </div>

          <h2 className="font-display text-xl font-bold text-text mb-2">{task.title}</h2>
        </div>

        {/* Tab Navigation */}
        <div className="w-full">
          <SegmentedControl
            ariaLabel="Task Details Section"
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'comments', label: 'Comments' },
              { value: 'attachments', label: 'Attachments' },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'overview' | 'comments' | 'attachments')}
          />
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-5" data-testid="task-tab-overview">
            {task.description ? (
              <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line bg-surface-muted/50 p-3 rounded-lg border border-border">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-text-subtle italic">No description provided.</p>
            )}

            {/* Transition Error if any */}
            {transitionError && (
              <div
                className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-lg"
                role="alert"
              >
                {transitionError}
              </div>
            )}

            {/* Lifecycle Transitions Control */}
            {onStatusChange && (
              <div className="p-3 bg-surface-muted rounded-card border border-border flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider">
                  Change Status (Legal Transitions)
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {allowedMoves.length === 0 ? (
                    <span className="text-xs text-text-subtle italic">
                      No further status transitions available for this task.
                    </span>
                  ) : (
                    allowedMoves.map((target) => (
                      <Button
                        key={target}
                        variant={target === 'completed' ? 'primary' : 'outline'}
                        size="sm"
                        disabled={transitioning}
                        onClick={() => handleTransition(target)}
                        data-testid={`detail-transition-to-${target}`}
                      >
                        → Move to {TASK_STATUS_LABELS[target]}
                      </Button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Metadata Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Assignee</span>
                <span className="font-medium text-text text-sm">{task.assigneeName}</span>
                {isAssignee && (
                  <span className="text-[11px] text-text-subtle block mt-0.5">(You)</span>
                )}
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Assigned By</span>
                <span className="font-medium text-text text-sm">{task.assignerName}</span>
                {isAssigner && (
                  <span className="text-[11px] text-text-subtle block mt-0.5">(You)</span>
                )}
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Project</span>
                <span className="font-medium text-text text-sm">
                  {task.projectName ?? 'Standalone Task'}
                </span>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Due Date</span>
                <span
                  className={`font-medium text-sm ${
                    task.isOverdue ? 'text-danger font-semibold' : 'text-text'
                  }`}
                >
                  {task.dueDate ?? 'Not scheduled'}
                </span>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Created At</span>
                <span className="text-text">{formatDate(task.createdAt)}</span>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <span className="font-semibold text-text-subtle block mb-1">Last Updated</span>
                <span className="text-text">{formatDate(task.updatedAt)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Comments */}
        {activeTab === 'comments' && (
          <div data-testid="task-tab-comments">
            <TaskCommentsThread taskId={task.id} currentEmployeeId={currentEmployeeId} />
          </div>
        )}

        {/* Tab Content: Attachments */}
        {activeTab === 'attachments' && (
          <div data-testid="task-tab-attachments">
            <TaskAttachmentsList
              taskId={task.id}
              currentEmployeeId={currentEmployeeId}
              assignerEmployeeId={task.assignerEmployeeId}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
