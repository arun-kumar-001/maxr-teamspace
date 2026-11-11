import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { TaskStatusPill } from '../../tasks/components/TaskStatusPill';
import type { Task } from '../../tasks/types';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { formatProjectDueSummary } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import type { ProjectStatus, UpdateProjectInput } from '../types';

export interface ProjectDetailDrawerProps {
  projectId: string | null;
  onClose: () => void;
  tasks: Task[];
  onOpenFullPage: (projectId: string) => void;
  onAddTaskClick?: (projectId: string) => void;
  onProjectUpdated?: () => void;
}

export function ProjectDetailDrawer({
  projectId,
  onClose,
  tasks,
  onOpenFullPage,
  onAddTaskClick,
  onProjectUpdated,
}: ProjectDetailDrawerProps) {
  const { user } = useAuth();
  const { project, loading, error, updateProject, refetch } = useProjectDetail(
    projectId ?? undefined,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isOpen = Boolean(projectId);
  const isOwner = Boolean(user?.employeeId && project?.ownerEmployeeId === user.employeeId);
  const isAdmin = user?.role === ROLES.ADMIN;
  const canManage = Boolean(isAdmin || isOwner);
  const canCreateTasks = Boolean(user?.role === ROLES.ADMIN || user?.role === ROLES.TEAM_LEAD);

  const projectTasks = tasks.filter((t) => t.projectId === projectId);
  const doneCount = projectTasks.filter((t) => t.status === 'completed').length;
  const progressPct =
    projectTasks.length > 0
      ? Math.round((doneCount / projectTasks.length) * 100)
      : project?.status === 'archived'
        ? 100
        : 0;

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const handleStatusSwitch = async (nextStatus: ProjectStatus) => {
    if (!project || project.status === nextStatus || !canManage) return;
    setUpdatingStatus(true);
    setStatusError(null);
    try {
      await updateProject({ status: nextStatus });
      onProjectUpdated?.();
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update project status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditSubmit = async (input: Omit<UpdateProjectInput, 'version'>) => {
    await updateProject(input);
    onProjectUpdated?.();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        position="drawer"
        maxWidth="lg"
        title={project ? project.name : 'Project Details'}
        subtitle={project ? `${project.code} · Lead: ${project.ownerName}` : undefined}
        footer={
          project && (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    data-testid="drawer-edit-project-btn"
                  >
                    Edit Project
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenFullPage(project.id);
                  }}
                  data-testid="drawer-open-project-page-btn"
                >
                  Open Full Page →
                </Button>
                <Button variant="primary" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )
        }
      >
        {loading ? (
          <div className="space-y-4 py-2" data-testid="project-drawer-loading">
            <div className="h-16 bg-surface-muted rounded-card animate-pulse" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 bg-surface-muted rounded-card animate-pulse" />
              <div className="h-20 bg-surface-muted rounded-card animate-pulse" />
              <div className="h-20 bg-surface-muted rounded-card animate-pulse" />
            </div>
            <div className="h-32 bg-surface-muted rounded-card animate-pulse" />
          </div>
        ) : error || !project ? (
          <div className="p-4 rounded-card bg-negative-soft border border-border text-sm text-danger space-y-2">
            <p>{error || 'Could not load project details.'}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-5" data-testid="project-detail-drawer-content">
            {/* Description */}
            <p className="text-sm text-text-muted leading-relaxed">
              {project.description || 'No project description provided.'}
            </p>

            {/* 3 KPI Tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-card bg-surface-muted/70 border border-border">
                <span className="text-[11px] font-medium text-text-subtle block">Progress</span>
                <span className="text-lg font-display font-bold text-text tabular-nums mt-0.5 block">
                  {progressPct}%
                </span>
              </div>
              <div className="p-3 rounded-card bg-surface-muted/70 border border-border">
                <span className="text-[11px] font-medium text-text-subtle block">Tasks</span>
                <span className="text-lg font-display font-bold text-text tabular-nums mt-0.5 block">
                  {doneCount} / {projectTasks.length}
                </span>
              </div>
              <div className="p-3 rounded-card bg-surface-muted/70 border border-border">
                <span className="text-[11px] font-medium text-text-subtle block">Timeline</span>
                <span className="text-sm font-display font-bold text-text mt-1 block truncate">
                  {formatProjectDueSummary(project.startDate, project.endDate)}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full rounded-full bg-track overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  project.status === 'archived' ? 'bg-text-subtle' : 'bg-primary'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Status Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  Status
                </span>
                <ProjectStatusBadge status={project.status} />
              </div>

              {canManage && (
                <div className={updatingStatus ? 'opacity-60 pointer-events-none' : ''}>
                  <SegmentedControl
                    ariaLabel="Change project status"
                    value={project.status}
                    onChange={(val) => void handleStatusSwitch(val as ProjectStatus)}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'archived', label: 'Archived' },
                    ]}
                  />
                </div>
              )}

              {statusError && (
                <p className="text-xs text-danger" role="alert">
                  {statusError}
                </p>
              )}
            </div>

            {/* Metadata Table */}
            <div className="divide-y divide-border border-y border-border text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle text-xs">Lead</span>
                <span className="font-medium text-text text-xs">{project.ownerName}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle text-xs">Started</span>
                <span className="text-text text-xs">{project.startDate ?? 'Not set'}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-text-subtle text-xs">Due</span>
                <span className="text-text text-xs">{project.endDate ?? 'Ongoing'}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <span className="text-text-subtle text-xs">Members ({project.members.length})</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {project.members.slice(0, 5).map((member) => (
                    <span
                      key={member.employeeId}
                      title={member.name}
                      className="w-7 h-7 rounded-full bg-primary-soft text-primary-ink text-[11px] font-semibold flex items-center justify-center border border-border"
                    >
                      {getInitials(member.name)}
                    </span>
                  ))}
                  {project.members.length > 5 && (
                    <span className="text-xs text-text-muted pl-1">
                      +{project.members.length - 5}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Tasks */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                    Tasks
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-muted border border-border text-[11px] font-semibold text-text tabular-nums">
                    {projectTasks.length}
                  </span>
                </div>
                {canCreateTasks && onAddTaskClick && (
                  <button
                    type="button"
                    onClick={() => onAddTaskClick(project.id)}
                    className="text-xs font-semibold text-primary-ink hover:underline"
                    data-testid="drawer-add-task-btn"
                  >
                    + Add task
                  </button>
                )}
              </div>

              {projectTasks.length === 0 ? (
                <div className="p-4 rounded-card bg-surface-muted/50 border border-dashed border-border text-xs text-text-muted text-center">
                  No tasks linked to this project yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {projectTasks.slice(0, 8).map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-surface-muted/50 border border-border"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            task.status === 'completed'
                              ? 'bg-primary text-sidebar border-primary'
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
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text truncate">{task.title}</p>
                          <p className="text-[11px] text-text-muted truncate">
                            {task.assigneeName} · {task.dueDate ?? 'No deadline'}
                          </p>
                        </div>
                      </div>
                      <TaskStatusPill status={task.status} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {project && (
        <ProjectFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          mode="edit"
          initialProject={project}
          onSubmitEdit={handleEditSubmit}
        />
      )}
    </>
  );
}
