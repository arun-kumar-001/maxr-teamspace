import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { AddMemberModal } from '../components/AddMemberModal';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProjectDetail } from '../hooks/useProjectDetail';
import type { UpdateProjectInput } from '../types';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const {
    project,
    loading,
    error,
    statusCode,
    refetch,
    updateProject,
    toggleArchive,
    addMember,
    removeMember,
  } = useProjectDetail(id);

  // An Admin or the project's designated Owner may manage (edit, archive, manage members)
  const isOwner = user?.employeeId && project?.ownerEmployeeId === user.employeeId;
  const isAdmin = user?.role === ROLES.ADMIN;
  const canManage = Boolean(isAdmin || isOwner);

  const handleEditSubmit = async (input: Omit<UpdateProjectInput, 'version'>) => {
    setActionError(null);
    try {
      await updateProject(input);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update project');
      throw err;
    }
  };

  const handleToggleArchiveClick = async () => {
    if (!project) return;
    const actionLabel = project.status === 'active' ? 'archive' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} project "${project.name}"?`)) {
      return;
    }

    setIsArchiving(true);
    setActionError(null);
    try {
      await toggleArchive();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to ${actionLabel} project`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAddMemberSubmit = async (employeeId: string) => {
    setActionError(null);
    try {
      await addMember(employeeId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member');
      throw err;
    }
  };

  const handleRemoveMemberClick = async (employeeId: string, memberName: string) => {
    if (!window.confirm(`Remove ${memberName} from this project?`)) {
      return;
    }

    setRemovingMemberId(employeeId);
    setActionError(null);
    try {
      await removeMember(employeeId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not set';
    return dateStr;
  };

  const formatAddedDate = (isoStr: string) => {
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

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full">
        <div className="h-8 w-40 bg-surface-muted rounded animate-pulse" />
        <div className="h-64 rounded-card bg-surface-muted border border-border animate-pulse" />
      </div>
    );
  }

  if (statusCode === 404 || (!loading && !project && !error)) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <EmptyState
          title="Project Not Found"
          description="The requested project does not exist, or you do not have permission to view it."
          actionLabel="Back to Projects"
          onAction={() => navigate('/projects')}
        />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <ErrorState
          title="Error Loading Project"
          message={error || 'Project data could not be retrieved.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const isArchived = project.status === 'archived';

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto w-full"
      data-testid="project-detail-view"
    >
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors min-h-[44px] px-2 -ml-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong"
          data-testid="back-to-projects-btn"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Projects
        </button>
      </div>

      {actionError && (
        <div
          className="p-4 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg"
          role="alert"
        >
          {actionError}
        </div>
      )}

      {/* Project Header Banner */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-6 bg-surface rounded-card border border-border shadow-card">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap mb-2">
            <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-surface-muted border border-border text-text">
              {project.code}
            </span>
            <ProjectStatusBadge status={project.status} />
            <span className="text-xs text-text-subtle">Revision {project.version}</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text mb-2">
            {project.name}
          </h1>

          {project.description ? (
            <p className="text-sm text-text-muted leading-relaxed max-w-3xl whitespace-pre-line">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-text-subtle italic">
              No description provided for this project.
            </p>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              disabled={isArchived}
              title={isArchived ? 'Reactivate project to edit details' : undefined}
              data-testid="edit-project-btn"
            >
              Edit Details
            </Button>

            <Button
              variant={isArchived ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToggleArchiveClick}
              disabled={isArchiving}
              data-testid="toggle-archive-btn"
            >
              {isArchiving
                ? 'Processing...'
                : isArchived
                  ? 'Reactivate Project'
                  : 'Archive Project'}
            </Button>
          </div>
        )}
      </div>

      {/* Metadata Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1">
            Project Owner
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-medium text-xs shrink-0">
              {project.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <span
                className="text-sm font-semibold text-text block truncate"
                title={project.ownerName}
              >
                {project.ownerName}
              </span>
              <span className="text-[11px] text-text-subtle">
                {isOwner ? '(You)' : 'Project Lead'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1">
            Timeline
          </span>
          <span className="text-sm font-medium text-text block mt-1">
            {formatDate(project.startDate)} → {formatDate(project.endDate)}
          </span>
          <span className="text-[11px] text-text-subtle">
            {!project.startDate && !project.endDate ? 'Open-ended ongoing' : 'Scheduled dates'}
          </span>
        </div>

        <div className="p-4 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1">
            Total Members
          </span>
          <span className="text-2xl font-display font-bold text-text block mt-0.5">
            {project.members.length}
          </span>
          <span className="text-[11px] text-text-subtle">Collaborators</span>
        </div>

        <div className="p-4 bg-surface rounded-card border border-border shadow-card">
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1">
            Last Modified
          </span>
          <span className="text-sm font-medium text-text block mt-1">
            {formatAddedDate(project.updatedAt)}
          </span>
          <span className="text-[11px] text-text-subtle">
            Created {formatAddedDate(project.createdAt)}
          </span>
        </div>
      </div>

      {/* Members Section */}
      <div className="flex flex-col gap-4 bg-surface rounded-card border border-border shadow-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-text">
              Project Members ({project.members.length})
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Active team members participating in this project.
            </p>
          </div>

          {canManage && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddMemberOpen(true)}
              disabled={isArchived}
              title={isArchived ? 'Reactivate project to manage membership' : undefined}
              data-testid="add-member-btn"
            >
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Member
              </span>
            </Button>
          )}
        </div>

        {/* Members Table / List */}
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {project.members.map((member) => {
            const isProjectOwner = member.employeeId === project.ownerEmployeeId;
            const isRemoving = removingMemberId === member.employeeId;

            return (
              <div
                key={member.employeeId}
                className="flex items-center justify-between p-4 bg-surface hover:bg-surface-muted/50 transition-colors gap-3"
                data-testid={`member-row-${member.employeeId}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-medium text-sm shrink-0">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text">{member.name}</span>
                      {isProjectOwner && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                          Owner
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-subtle">
                      Added on {formatAddedDate(member.addedAt)}
                    </span>
                  </div>
                </div>

                {canManage && !isArchived && (
                  <div>
                    {isProjectOwner ? (
                      <span
                        className="text-xs text-text-subtle italic px-2 py-1"
                        title="The owner cannot be removed"
                      >
                        Owner
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMemberClick(member.employeeId, member.name)}
                        disabled={isRemoving}
                        className="text-danger hover:bg-rose-50 hover:border-rose-200"
                        data-testid={`remove-member-${member.employeeId}`}
                      >
                        {isRemoving ? 'Removing...' : 'Remove'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Project Modal */}
      <ProjectFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        mode="edit"
        initialProject={project}
        onSubmitEdit={handleEditSubmit}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        existingMembers={project.members}
        onAddMember={handleAddMemberSubmit}
      />
    </div>
  );
}
