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

function formatFullDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getAvatarBg(name: string): string {
  const colors = [
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-sky-100 text-sky-800 border-sky-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-emerald-100 text-emerald-800 border-emerald-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-rose-100 text-rose-800 border-rose-200',
    'bg-purple-100 text-purple-800 border-purple-200',
  ];
  if (!name) return colors[0]!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

const STATUS_PROGRESS: Record<TaskStatus, { pct: number; label: string; barClass: string }> = {
  todo: { pct: 15, label: 'To Do', barClass: 'bg-slate-400' },
  in_progress: { pct: 50, label: 'In Progress', barClass: 'bg-teal-500' },
  in_review: { pct: 80, label: 'In Review', barClass: 'bg-amber-500' },
  completed: { pct: 100, label: 'Completed', barClass: 'bg-emerald-500' },
  blocked: { pct: 25, label: 'On Hold', barClass: 'bg-rose-500' },
};

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
  const progress = STATUS_PROGRESS[task.status] || STATUS_PROGRESS.todo;

  // Determine actual start date:
  // If task has progressed beyond 'todo', it started at createdAt or earlier updatedAt
  const isStarted = task.status !== 'todo';
  const startDateText = isStarted ? formatFullDateTime(task.createdAt) : 'Not started yet';

  // Actual end date:
  const endDateText = task.completedAt ? formatFullDateTime(task.completedAt) : 'Not completed yet';

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
                  ? '✓ Mark Completed'
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
        {/* Top Header Card: Title, Badges, Version */}
        <div className="bg-surface-muted/30 p-4 rounded-xl border border-border/70 space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <TaskPriorityBadge priority={task.priority} size="md" />
            <TaskStatusPill status={task.status} size="md" />
            {task.isDaily && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-soft text-primary-ink border border-primary-strong/20">
                Daily Recurring
              </span>
            )}
            {task.isOverdue && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-md">
                Overdue
              </span>
            )}
            <span className="text-xs text-text-subtle font-mono ml-auto">v{task.version}</span>
          </div>

          <h3 className="font-display text-xl font-bold text-text leading-snug">{task.title}</h3>

          {/* Lifecycle Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-subtle font-medium">Lifecycle Progress</span>
              <span className="font-semibold text-text">
                {progress.pct}% · {progress.label}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress.barClass}`}
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
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
            {/* Description */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                Description
              </span>
              {task.description ? (
                <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line bg-surface-muted/40 p-3.5 rounded-xl border border-border/80">
                  {task.description}
                </p>
              ) : (
                <p className="text-sm text-text-subtle italic bg-surface-muted/20 p-3 rounded-lg border border-dashed border-border/70">
                  No description provided for this task.
                </p>
              )}
            </div>

            {/* Transition Error alert if any */}
            {transitionError && (
              <div
                className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg"
                role="alert"
              >
                {transitionError}
              </div>
            )}

            {/* Status / Lane Transition Pills */}
            {onStatusChange && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                  Workflow Lane
                </span>
                <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-xl bg-surface-muted/60 border border-border/80">
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
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-white text-text shadow-sm ring-1 ring-border font-bold'
                            : isAllowed
                              ? 'text-text-muted hover:text-text hover:bg-white/70 cursor-pointer'
                              : 'text-text-subtle/40 cursor-not-allowed'
                        }`}
                      >
                        {TASK_STATUS_LABELS[lane]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 1: People & Ownership */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                People & Project
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Assignee Box */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs ring-1 ring-white ${getAvatarBg(
                      task.assigneeName,
                    )}`}
                  >
                    {getInitials(task.assigneeName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10.5px] font-semibold text-text-subtle uppercase tracking-wider">
                      Assigned To
                    </span>
                    <span className="font-semibold text-sm text-text truncate">
                      {task.assigneeName}
                      {isAssignee ? ' (You)' : ''}
                    </span>
                    <span className="text-[11px] text-text-subtle">Assignee</span>
                  </div>
                </div>

                {/* Assigner Box */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs ring-1 ring-white ${getAvatarBg(
                      task.assignerName,
                    )}`}
                  >
                    {getInitials(task.assignerName)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10.5px] font-semibold text-text-subtle uppercase tracking-wider">
                      Assigned By
                    </span>
                    <span className="font-semibold text-sm text-text truncate">
                      {task.assignerName}
                      {isAssigner ? ' (You)' : ''}
                    </span>
                    <span className="text-[11px] text-text-subtle">Creator</span>
                  </div>
                </div>
              </div>

              {/* Project Card */}
              <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <svg
                    className="w-4 h-4 text-teal-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="text-xs text-text-subtle">Project</span>
                </div>
                <span className="font-semibold text-xs text-text truncate max-w-[200px]">
                  {task.projectName ?? 'Standalone Task'}
                </span>
              </div>
            </div>

            {/* Section 2: Timeline & Dates (Create Date, Start Date, Due Date, End Date) */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                Timeline & Schedule
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. Created Date */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-text-subtle text-[11px]">
                    <svg
                      className="w-3.5 h-3.5 text-teal-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                      <polyline points="12 6 12 12 16 14" strokeWidth="1.8" />
                    </svg>
                    <span className="font-semibold uppercase tracking-wider">Created Date</span>
                  </div>
                  <span className="font-semibold text-text text-[13px]">
                    {formatFullDateTime(task.createdAt)}
                  </span>
                </div>

                {/* 2. Actual Start Date */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-text-subtle text-[11px]">
                    <svg
                      className="w-3.5 h-3.5 text-sky-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" strokeWidth="1.8" />
                    </svg>
                    <span className="font-semibold uppercase tracking-wider">
                      Actual Start Date
                    </span>
                  </div>
                  <span
                    className={`font-semibold text-[13px] ${
                      isStarted ? 'text-text' : 'text-text-subtle italic font-normal'
                    }`}
                  >
                    {startDateText}
                  </span>
                </div>

                {/* 3. Due Date */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-text-subtle text-[11px]">
                    <svg
                      className="w-3.5 h-3.5 text-amber-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" />
                      <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.8" />
                      <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.8" />
                      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.8" />
                    </svg>
                    <span className="font-semibold uppercase tracking-wider">Due Date</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-semibold text-[13px] ${
                        task.isOverdue ? 'text-rose-600' : 'text-text'
                      }`}
                    >
                      {formatFullDate(task.dueDate)}
                    </span>
                    {task.isOverdue && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                        OVERDUE
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Actual End Date / Completed Date */}
                <div className="p-3 bg-surface-muted/40 rounded-xl border border-border/80 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-text-subtle text-[11px]">
                    <svg
                      className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="font-semibold uppercase tracking-wider">Actual End Date</span>
                  </div>
                  <span
                    className={`font-semibold text-[13px] ${
                      task.completedAt
                        ? 'text-emerald-700 font-bold'
                        : 'text-text-subtle italic font-normal'
                    }`}
                  >
                    {endDateText}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Quick Reassign Pills */}
            {canEdit && onReassign && employees.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
                  Quick Reassign
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
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-sidebar text-sidebar-strong border-sidebar shadow-2xs font-bold'
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
