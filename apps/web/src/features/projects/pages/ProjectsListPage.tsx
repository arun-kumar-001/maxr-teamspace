import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectFilters } from '../components/ProjectFilters';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { useProjects } from '../hooks/useProjects';
import type { CreateProjectInput } from '../types';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canManage = user?.role === ROLES.ADMIN || user?.role === ROLES.TEAM_LEAD;

  const {
    projects,
    loading,
    error,
    page,
    pageSize,
    total,
    status,
    search,
    setPage,
    setStatus,
    setSearch,
    refetch,
    createProject,
  } = useProjects({ autoFetch: true });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleSelectProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateSubmit = async (input: CreateProjectInput) => {
    await createProject(input);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Initiatives, team groups, and task collections across the organization.
          </p>
        </div>

        {canManage && (
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
              New Project
            </span>
          </Button>
        )}
      </div>

      {/* Filters */}
      <ProjectFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        canCreate={false}
      />

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-card bg-surface-muted border border-border animate-pulse p-5"
            />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load projects"
          message={error}
          onRetry={() => void refetch()}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title={search || status ? 'No matching projects found' : 'No projects yet'}
          description={
            search || status
              ? 'Try adjusting your search criteria or status filter.'
              : canManage
                ? 'Create a project to organize tasks, assign team members, and track timelines.'
                : 'You have not been added to any projects yet.'
          }
          actionLabel={canManage && !search && !status ? 'Create Project' : undefined}
          onAction={canManage && !search && !status ? () => setIsCreateOpen(true) : undefined}
        />
      ) : (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
            data-testid="projects-grid"
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onSelect={handleSelectProject} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
              <span className="text-xs text-text-muted">
                Showing {Math.min((page - 1) * pageSize + 1, total)} to{' '}
                {Math.min(page * pageSize, total)} of {total} projects
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs font-medium text-text px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Project Modal */}
      <ProjectFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        onSubmitCreate={handleCreateSubmit}
      />
    </div>
  );
}
