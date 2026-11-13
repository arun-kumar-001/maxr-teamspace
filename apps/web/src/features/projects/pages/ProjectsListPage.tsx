import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectFilters } from '../components/ProjectFilters';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectOverviewCards } from '../components/ProjectOverviewCards';
import {
  ProjectPriorityBadge,
  ProjectStatusBadge,
  ProjectWorkflowBadge,
} from '../components/ProjectStatusBadge';
import { useProjects } from '../hooks/useProjects';
import type { CreateProjectInput, Project } from '../types';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const canManage = effectiveRole === ROLES.ADMIN || effectiveRole === ROLES.TEAM_LEAD;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const {
    projects,
    summary,
    loading,
    error,
    statusCode,
    page,
    pageSize,
    total,
    status,
    workflowStatus,
    priority,
    sort,
    search,
    setPage,
    setStatus,
    setWorkflowStatus,
    setPriority,
    setSort,
    setSearch,
    refetch,
    createProject,
  } = useProjects();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleSelectProject = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  const handleCreateSubmit = async (input: CreateProjectInput) => {
    const created = await createProject(input);
    navigate(`/projects/${created.id}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(search || status || workflowStatus || priority);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            Projects
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {canManage
              ? 'Manage initiatives, track milestones, and oversee assigned team deliverables.'
              : 'Track your assigned projects, milestones, team updates, and shared documents.'}
          </p>
        </div>

        {canManage && (
          <div className="shrink-0">
            <Button
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              data-testid="header-create-project-btn"
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
                Create Project
              </span>
            </Button>
          </div>
        )}
      </div>

      {/* 1. Projects Overview Summary Cards */}
      <ProjectOverviewCards summary={summary} loading={loading && projects.length === 0} />

      {/* Filters & Search */}
      <ProjectFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        workflowStatus={workflowStatus}
        onWorkflowStatusChange={setWorkflowStatus}
        priority={priority}
        onPriorityChange={setPriority}
        sort={sort}
        onSortChange={setSort}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Content */}
      {loading && projects.length === 0 ? (
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-busy="true"
          aria-label="Loading projects"
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-[20px] border border-border p-5 animate-pulse flex flex-col justify-between"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)' }}
            >
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <div className="h-5 w-20 bg-surface-muted rounded" />
                  <div className="h-5 w-20 bg-surface-muted rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-surface-muted rounded" />
                <div className="h-10 w-full bg-surface-muted rounded" />
              </div>
              <div className="h-3 w-full bg-surface-muted rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col gap-3">
          <ErrorState
            title="Could not load projects"
            message={
              statusCode === 401
                ? 'Your backend session cookie is not active. Sign in on the Login page with your work credentials to load live project data.'
                : error
            }
            onRetry={() => refetch()}
          />
          {statusCode === 401 && (
            <div className="flex justify-center">
              <Button variant="primary" onClick={() => navigate('/login')}>
                Go to Sign In
              </Button>
            </div>
          )}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No assigned projects found"
          description={
            hasActiveFilters
              ? 'No projects match your current search or filters.'
              : canManage
                ? 'There are no projects created yet. Get started by creating your first project.'
                : 'You are not currently assigned to any projects.'
          }
          actionLabel={
            hasActiveFilters ? 'Clear Filters' : canManage ? 'Create First Project' : undefined
          }
          onAction={
            hasActiveFilters
              ? () => {
                  setSearch('');
                  setStatus(undefined);
                  setWorkflowStatus(undefined);
                  setPriority(undefined);
                }
              : canManage
                ? () => setIsCreateOpen(true)
                : undefined
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="flex flex-col gap-6">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            data-testid="projects-grid"
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onSelect={handleSelectProject} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-text-muted">
                Showing <span className="font-medium text-text">{projects.length}</span> of{' '}
                <span className="font-medium text-text">{total}</span> projects
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-text px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4" data-testid="projects-list-view">
          <div
            className="overflow-x-auto border rounded-[20px]"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.74)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              borderColor: 'rgba(255, 255, 255, 0.8)',
              boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
            }}
          >
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                  <th className="py-3.5 px-4">Project</th>
                  <th className="py-3.5 px-4">Manager & Team</th>
                  <th className="py-3.5 px-4">Timeline</th>
                  <th className="py-3.5 px-4">Priority & Status</th>
                  <th className="py-3.5 px-4">Progress</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/80 text-sm">
                {projects.map((project) => {
                  const progress = Math.max(0, Math.min(100, project.progressPercent ?? 0));
                  const workflow = project.workflowStatus ?? 'in_progress';
                  return (
                    <tr
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className="hover:bg-primary-soft/30 cursor-pointer transition-colors"
                      data-testid={`project-card-${project.id}`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5 max-w-xs">
                          <span className="font-mono text-[11px] font-semibold text-text-subtle">
                            {project.code}
                          </span>
                          <span className="font-semibold text-text">{project.name}</span>
                          {project.description && (
                            <span className="text-xs text-text-muted line-clamp-1">
                              {project.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-text">{project.ownerName}</span>
                          <span className="text-xs text-text-subtle">
                            {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-text-muted">
                        <div>Start: {formatDate(project.startDate)}</div>
                        <div>Deadline: {formatDate(project.endDate)}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ProjectPriorityBadge priority={project.priority} />
                          <ProjectWorkflowBadge workflowStatus={workflow} />
                          {project.status === 'archived' && (
                            <ProjectStatusBadge status={project.status} />
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 w-44">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex-1 h-2 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'rgba(8, 11, 12, 0.08)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progress}%`,
                                backgroundColor:
                                  workflow === 'completed'
                                    ? 'rgb(22, 163, 74)'
                                    : 'rgb(85, 205, 179)',
                              }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-text w-9 text-right">
                            {progress}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProject(project);
                          }}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-text-muted">
                Showing <span className="font-medium text-text">{projects.length}</span> of{' '}
                <span className="font-medium text-text">{total}</span> projects
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-text px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {canManage && (
        <ProjectFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          mode="create"
          onSubmitCreate={handleCreateSubmit}
        />
      )}
    </div>
  );
}
