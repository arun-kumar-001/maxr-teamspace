import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { TaskAttachmentsList } from './TaskAttachmentsList';
import { TaskCommentsThread } from './TaskCommentsThread';
import { TaskPriorityBadge } from './TaskPriorityBadge';
import { TaskStatusPill } from './TaskStatusPill';
import type { Task, TaskStatus } from '../types';
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_TRANSITIONS } from '../types';

export interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<unknown>;
  onReassign?: (taskId: string, assigneeEmployeeId: string) => Promise<unknown>;
  onEditClick?: (task: Task) => void;
  currentEmployeeId?: string;
  isAdmin?: boolean;
}

export function TaskDetailModal({
  isOpen,
  onClose,
  task,
  onStatusChange,
  onReassign,
  onEditClick,
  currentEmployeeId,
  isAdmin = false,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'comments' | 'attachments'>('overview');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      setTransitionError(null);
    }
  }, [isOpen, task?.id]);

  const isAssigner = Boolean(
    task && currentEmployeeId && task.assignerEmployeeId === currentEmployeeId,
  );
  const isAssignee = Boolean(
    task && currentEmployeeId && task.assigneeEmployeeId === currentEmployeeId,
  );
  const canCompleteOrReopen = Boolean(isAdmin || isAssigner);
  const canEdit = Boolean(task && (isAdmin || isAssigner) && task.status !== 'completed');

  useEffect(() => {
    if (!isOpen || !canEdit || !onReassign) return;
    void fetchEmployeeDirectory({ status: 'active', pageSize: 20 })
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]));
  }, [isOpen, canEdit, onReassign]);

  if (!task) return null;

  const allowedMoves = (TASK_TRANSITIONS[task.status] || []).filter((target) => {
    if (target === 'completed' || task.status === 'completed') {
      return canCompleteOrReopen;
    }
    return true;
  });

  const handleTransition = async (newStatus: TaskStatus) => {
    if (!onStatusChange || newStatus === task.status) return;
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

  const handleReassignClick = async (employeeId: string) => {
    if (!onReassign || employeeId === task.assigneeEmployeeId) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      await onReassign(task.id, employeeId);
    } catch (err: unknown) {
      setTransitionError(err instanceof Error ? err.message : 'Failed to reassign task.');
    } finally {
      setTransitioning(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const primaryQuickMove = allowedMoves.includes('completed') ? 'completed' : allowedMoves[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      position="drawer"
      title="Task Details"
      subtitle={`${task.projectName ?? 'Standalone task'} · ${TASK_STATUS_LABELS[task.status]}`}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-2 flex-wrap">
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            {onStatusChange && primaryQuickMove && (
              <Button
                variant="primary"
                size="sm"
                disabled={transitioning}
                onClick={() => void handleTransition(primaryQuickMove)}
                data-testid={`detail-quick-primary-${primaryQuickMove}`}
              >
                {primaryQuickMove === 'completed'
                  ? '✓ Done'
                  : `Move to ${TASK_STATUS_LABELS[primaryQuickMove]}`}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
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
            <span className="text-xs text-text-subtle ml-auto">v{task.version}</span>
          </div>

          <h3 className="font-display text-xl font-bold text-text leading-snug">{task.title}</h3>
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

            {/* Lane / Lifecycle Switcher */}
            {onStatusChange && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                  Lane
                </span>
                <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-control bg-surface-muted border border-border">
                  {TASK_STATUSES.map((lane) => {
                    const isCurrent = lane === task.status;
                    const isAllowed = allowedMoves.includes(lane);
                    return (
                      <button
                        key={lane}
                        type="button"
                        disabled={!isAllowed || transitioning}
                        onClick={() => void handleTransition(lane)}
                        data-testid={
                          isAllowed ? `detail-transition-to-${lane}` : `detail-lane-${lane}`
                        }
                        title={
                          isCurrent
                            ? 'Current status'
                            : isAllowed
                              ? `Move to ${TASK_STATUS_LABELS[lane]}`
                              : `Cannot transition directly from ${TASK_STATUS_LABELS[task.status]} to ${TASK_STATUS_LABELS[lane]}`
                        }
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-input transition-colors ${
                          isCurrent
                            ? 'bg-surface text-text shadow-card ring-1 ring-border'
                            : isAllowed
                              ? 'text-text-muted hover:text-text hover:bg-surface/70 cursor-pointer'
                              : 'text-text-subtle/50 cursor-not-allowed'
                        }`}
                      >
                        {TASK_STATUS_LABELS[lane]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Metadata Rows */}
            <div className="divide-y divide-border border-y border-border text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle">Project</span>
                <span className="font-medium text-text">
                  {task.projectName ?? 'Standalone Task'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle">Assignee</span>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-semibold text-[10px]">
                    {getInitials(task.assigneeName)}
                  </span>
                  <span className="font-medium text-text">
                    {task.assigneeName}
                    {isAssignee ? ' (You)' : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle">Assigned By</span>
                <span className="font-medium text-text">
                  {task.assignerName}
                  {isAssigner ? ' (You)' : ''}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle">Due</span>
                <span
                  className={`font-medium ${
                    task.isOverdue ? 'text-danger font-semibold' : 'text-text'
                  }`}
                >
                  {task.dueDate ?? 'Not scheduled'}
                </span>
              </div>
            </div>

            {/* Quick Reassign Pills */}
            {canEdit && onReassign && employees.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                  Reassign
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {employees.slice(0, 8).map((emp) => {
                    const fullName = `${emp.firstName} ${emp.lastName}`.trim();
                    const isSelected = emp.id === task.assigneeEmployeeId;
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        disabled={transitioning}
                        onClick={() => void handleReassignClick(emp.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-sidebar text-sidebar-strong border-sidebar'
                            : 'bg-surface text-text-muted border-border hover:bg-surface-muted hover:text-text'
                        }`}
                      >
                        {emp.firstName || fullName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
