import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { TabPanel, Tabs } from '../../../components/ui/Tabs';
import { AddMemberModal } from '../components/AddMemberModal';
import { ProjectDocumentsSection } from '../components/ProjectDocumentsSection';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectMilestonesSection } from '../components/ProjectMilestonesSection';
import {
  ProjectPriorityBadge,
  ProjectStatusBadge,
  ProjectWorkflowBadge,
} from '../components/ProjectStatusBadge';
import { ProjectUpdatesSection } from '../components/ProjectUpdatesSection';
import { useProjectDetail } from '../hooks/useProjectDetail';
import type { UpdateProjectInput } from '../types';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;

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
    addMilestone,
    updateMilestone,
    postUpdate,
    uploadDocument,
    downloadDocument,
    deleteDocument,
  } = useProjectDetail(id);

  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'updates' | 'documents'>(
    'overview',
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = effectiveRole === ROLES.ADMIN;
  const isOwner = Boolean(project && user && project.ownerEmployeeId === user.employeeId);
  const canManage = isAdmin || (effectiveRole === ROLES.TEAM_LEAD && isOwner);
  const isArchived = project?.status === 'archived';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Open-ended';
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const formatAddedDate = (isoStr: string) => {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleEditSubmit = async (input: Omit<UpdateProjectInput, 'version'>) => {
    setActionError(null);
    await updateProject(input);
  };

  const handleToggleArchiveClick = async () => {
    if (!project) return;
    setActionError(null);
    setIsArchiving(true);
    try {
      await toggleArchive();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to change project archive status',
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleAddMemberSubmit = async (employeeId: string) => {
    setActionError(null);
    await addMember(employeeId);
  };

  const handleRemoveMemberClick = async (employeeId: string, name: string) => {
    setActionError(null);
    setRemovingMemberId(employeeId);
    try {
      await removeMember(employeeId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `Failed to remove ${name}`);
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (loading && !project) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto w-full" aria-busy="true">
        <div className="h-6 w-32 bg-surface-muted rounded animate-pulse" />
        <div className="h-36 bg-surface-muted rounded-[24px] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-24 bg-surface-muted rounded-[20px] animate-pulse" />
          <div className="h-24 bg-surface-muted rounded-[20px] animate-pulse" />
          <div className="h-24 bg-surface-muted rounded-[20px] animate-pulse" />
          <div className="h-24 bg-surface-muted rounded-[20px] animate-pulse" />
        </div>
        <div className="h-64 bg-surface-muted rounded-[24px] animate-pulse" />
      </div>
    );
  }

  if (error || !project) {
    const isNotFound = statusCode === 404;
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {isNotFound ? (
          <EmptyState
            title="Project not found"
            description="The requested project does not exist or you do not have permission to view it."
            actionLabel="Back to Projects"
            onAction={() => navigate('/projects')}
          />
        ) : (
          <ErrorState
            title="Could not load project details"
            message={error || 'Unable to load project information.'}
            onRetry={() => refetch()}
          />
        )}
      </div>
    );
  }

  const progress = Math.max(0, Math.min(100, project.progressPercent ?? 0));
  const workflowStatus = project.workflowStatus ?? 'in_progress';
  const priority = project.priority ?? 'medium';
  const milestones = project.milestones ?? [];
  const updates = project.updates ?? [];
  const documents = project.documents ?? [];
  const technologies = project.technologies ?? [];

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto w-full"
      data-testid="project-detail-view"
    >
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/projects')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors min-h-[44px] px-2 -ml-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong cursor-pointer"
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
      <div
        className="flex flex-col gap-5 p-6 border rounded-[24px]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.76)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 12px 32px rgba(85, 205, 179, 0.08), 0 2px 6px rgba(8, 11, 12, 0.04)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 flex-wrap mb-2.5">
              <span
                className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg border"
                style={{
                  backgroundColor: 'rgb(244, 247, 246)',
                  color: 'rgb(8, 11, 12)',
                  borderColor: 'rgba(8, 11, 12, 0.12)',
                }}
              >
                {project.code}
              </span>
              <ProjectWorkflowBadge workflowStatus={workflowStatus} />
              <ProjectPriorityBadge priority={priority} />
              <ProjectStatusBadge status={project.status} />
              <span className="text-xs text-text-subtle">Revision {project.version}</span>
            </div>

            <h1
              className="font-display text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: 'rgb(8, 11, 12)' }}
            >
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

        {/* Overall Progress Bar */}
        <div className="flex flex-col gap-1.5 pt-3 border-t border-border/70">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">Overall Completion</span>
            <span className="font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
              {progress}%
            </span>
          </div>
          <div
            className="w-full h-2.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(8, 11, 12, 0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor:
                  workflowStatus === 'completed'
                    ? 'rgb(22, 163, 74)'
                    : workflowStatus === 'on_hold'
                      ? 'rgb(73, 53, 72)'
                      : 'rgb(85, 205, 179)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Metadata Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="p-4 border rounded-[20px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 8px 24px rgba(85, 205, 179, 0.06)',
          }}
        >
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1.5">
            Project Manager
          </span>
          <div className="flex items-start gap-2.5 mt-1">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0"
              style={{
                backgroundColor: 'rgba(85, 205, 179, 0.22)',
                color: 'rgb(8, 11, 12)',
              }}
            >
              {project.ownerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span
                className="text-sm font-semibold text-text block truncate"
                title={project.ownerName}
              >
                {project.ownerName}
              </span>
              <span className="text-[11px] text-text-subtle block">
                {project.ownerDesignation || (isOwner ? '(You)' : 'Project Lead')}
                {project.ownerDepartment ? ` · ${project.ownerDepartment}` : ''}
              </span>
              {project.ownerEmail && (
                <span className="text-[11px] text-primary-ink block truncate mt-0.5">
                  {project.ownerEmail}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="p-4 border rounded-[20px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 8px 24px rgba(85, 205, 179, 0.06)',
          }}
        >
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1.5">
            Project Timeline
          </span>
          <span className="text-sm font-semibold text-text block mt-1">
            {formatDate(project.startDate)} → {formatDate(project.endDate)}
          </span>
          <span className="text-[11px] text-text-subtle">
            {!project.startDate && !project.endDate ? 'Open-ended ongoing' : 'Target schedule'}
          </span>
        </div>

        <div
          className="p-4 border rounded-[20px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 8px 24px rgba(85, 205, 179, 0.06)',
          }}
        >
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1.5">
            Team & Milestones
          </span>
          <span className="text-2xl font-display font-bold text-text block mt-0.5">
            {project.members.length}
          </span>
          <span className="text-[11px] text-text-subtle">
            Assigned members · {milestones.length} milestones
          </span>
        </div>

        <div
          className="p-4 border rounded-[20px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.72)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 8px 24px rgba(85, 205, 179, 0.06)',
          }}
        >
          <span className="text-xs font-semibold text-text-subtle uppercase tracking-wider block mb-1.5">
            Last Modified
          </span>
          <span className="text-sm font-semibold text-text block mt-1">
            {formatAddedDate(project.updatedAt)}
          </span>
          <span className="text-[11px] text-text-subtle">
            Created {formatAddedDate(project.createdAt)}
          </span>
        </div>
      </div>

      {/* Workspace Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={(tabId) =>
          setActiveTab(tabId as 'overview' | 'milestones' | 'updates' | 'documents')
        }
        tabs={[
          { id: 'overview', label: 'Project Details & Team' },
          { id: 'milestones', label: `Milestones (${milestones.length})` },
          { id: 'updates', label: `Updates & Activity (${updates.length})` },
          { id: 'documents', label: `Documents (${documents.length})` },
        ]}
      />

      <TabPanel tabId="overview" activeTab={activeTab} className="flex flex-col gap-6">
        {/* Objectives, Scope & Technologies */}
        <div
          className="p-6 border rounded-[24px] grid grid-cols-1 lg:grid-cols-3 gap-6"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.74)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
          }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-subtle">
              Project Objectives
            </h2>
            <p className="text-sm text-text leading-relaxed whitespace-pre-line">
              {project.objectives ||
                project.description ||
                'Deliver core project deliverables within agreed schedule and quality standards.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-subtle">
              Project Scope
            </h2>
            <p className="text-sm text-text leading-relaxed whitespace-pre-line">
              {project.scope ||
                'Includes architecture design, implementation, automated testing, and internal rollout.'}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-text-subtle">
              Technologies Used
            </h2>
            {technologies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {technologies.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 rounded-full text-xs font-semibold border"
                    style={{
                      backgroundColor: 'rgba(85, 205, 179, 0.16)',
                      color: 'rgb(8, 11, 12)',
                      borderColor: 'rgba(85, 205, 179, 0.45)',
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted italic">Standard workspace stack</p>
            )}
          </div>
        </div>

        {/* Members Section */}
        <div
          className="flex flex-col gap-4 border rounded-[24px] p-6"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.74)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-text">
                Assigned Team Members ({project.members.length})
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Collaborators currently assigned to this project.
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

          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {project.members.map((member) => {
              const isProjectOwner = member.employeeId === project.ownerEmployeeId;
              const isRemoving = removingMemberId === member.employeeId;

              return (
                <div
                  key={member.employeeId}
                  className="flex items-center justify-between p-4 bg-surface hover:bg-surface-muted/50 transition-colors gap-3"
                  data-testid={`member-row-${member.employeeId}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0"
                      style={{
                        backgroundColor: 'rgba(85, 205, 179, 0.2)',
                        color: 'rgb(8, 11, 12)',
                      }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text">{member.name}</span>
                        {isProjectOwner && (
                          <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200">
                            Owner
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-subtle block truncate">
                        {member.designation ? `${member.designation} · ` : ''}
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
      </TabPanel>

      <TabPanel tabId="milestones" activeTab={activeTab}>
        <ProjectMilestonesSection
          milestones={milestones}
          canManage={canManage}
          isArchived={Boolean(isArchived)}
          onAddMilestone={addMilestone}
          onUpdateMilestone={updateMilestone}
        />
      </TabPanel>

      <TabPanel tabId="updates" activeTab={activeTab}>
        <ProjectUpdatesSection
          updates={updates}
          currentProgressPercent={progress}
          canManage={canManage}
          isArchived={Boolean(isArchived)}
          onPostUpdate={postUpdate}
        />
      </TabPanel>

      <TabPanel tabId="documents" activeTab={activeTab}>
        <ProjectDocumentsSection
          documents={documents}
          currentEmployeeId={user?.employeeId}
          canManage={canManage}
          isArchived={Boolean(isArchived)}
          onUploadDocument={uploadDocument}
          onDownloadDocument={downloadDocument}
          onDeleteDocument={deleteDocument}
        />
      </TabPanel>

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
