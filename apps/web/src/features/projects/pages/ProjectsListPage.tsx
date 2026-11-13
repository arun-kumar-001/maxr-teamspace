import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { createTask, fetchMyTasks, fetchTeamTasks } from '../../tasks/api/tasksApi';
import { TaskFormModal } from '../../tasks/components/TaskFormModal';
import type { CreateTaskInput, Task } from '../../tasks/types';
import {
  ProjectCard,
  formatProjectDueSummary,
  type ProjectTaskSummary,
} from '../components/ProjectCard';
import { ProjectDetailDrawer } from '../components/ProjectDetailDrawer';
import { ProjectFilters } from '../components/ProjectFilters';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProjects } from '../hooks/useProjects';
import type { CreateProjectInput } from '../types';

export function ProjectsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [quickTaskProjectId, setQuickTaskProjectId] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);

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

  const loadTasksSummary = useCallback(() => {
    const loader = canManage ? fetchTeamTasks({ pageSize: 100 }) : fetchMyTasks({ pageSize: 100 });
    void loader.then((res) => setProjectTasks(res.data || [])).catch(() => setProjectTasks([]));
  }, [canManage]);

  useEffect(() => {
    loadTasksSummary();
  }, [loadTasksSummary]);

  const taskSummaryByProject = useMemo(() => {
    const map = new Map<string, ProjectTaskSummary>();
    for (const task of projectTasks) {
      if (!task.projectId) continue;
      const entry = map.get(task.projectId) ?? { total: 0, open: 0, completed: 0 };
      entry.total += 1;
      if (task.status === 'completed') {
        entry.completed += 1;
      } else {
        entry.open += 1;
      }
      map.set(task.projectId, entry);
    }
    return map;
  }, [projectTasks]);

  const counts = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active').length;
    const archived = projects.filter((p) => p.status === 'archived').length;
    return {
      all: status ? projects.length : total,
      active,
      archived,
    };
  }, [projects, status, total]);

  const openTasksTotal = useMemo(
    () => projectTasks.filter((t) => t.status !== 'completed').length,
    [projectTasks],
  );

  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const handleCreateSubmit = async (input: CreateProjectInput) => {
    await createProject(input);
  };

  const handleQuickCreateTask = async (input: CreateTaskInput) => {
    await createTask(input);
    loadTasksSummary();
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
            {total} {total === 1 ? 'project' : 'projects'} · {counts.active} active
            {openTasksTotal > 0 ? ` · ${openTasksTotal} open tasks` : ''}
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            data-testid="header-create-project-btn"
          >
            <svg
              className="w-4 h-4 shrink-0"
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
          </Button>
        )}
      </div>

      {/* Filters */}
      <ProjectFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        counts={counts}
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
          {viewMode === 'cards' ? (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
              data-testid="projects-grid"
            >
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={selectedProjectId === project.id}
                  taskSummary={taskSummaryByProject.get(project.id)}
                  onSelect={handleSelectProject}
                />
              ))}
            </div>
          ) : (
            <div
              className="w-full overflow-x-auto border border-border rounded-card bg-surface shadow-card"
              data-testid="projects-table"
            >
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/70 text-xs font-semibold text-text-subtle uppercase tracking-wider">
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Lead</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Team</th>
                    <th className="py-3 px-4">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {projects.map((project) => {
                    const summary = taskSummaryByProject.get(project.id);
                    const pct =
                      summary && summary.total > 0
                        ? Math.round((summary.completed / summary.total) * 100)
                        : project.status === 'archived'
                          ? 100
                          : 0;
                    return (
                      <tr
                        key={project.id}
                        onClick={() => handleSelectProject(project.id)}
                        className="hover:bg-surface-muted/50 transition-colors cursor-pointer"
                        data-testid={`project-row-${project.id}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
                              {project.code}
                            </span>
                            <span className="font-semibold text-text">{project.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-muted">{project.ownerName}</td>
                        <td className="py-3.5 px-4">
                          <ProjectStatusBadge status={project.status} />
                        </td>
                        <td className="py-3.5 px-4 w-40">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-track overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-text tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-muted">
                          {project.memberCount} {project.memberCount === 1 ? 'member' : 'members'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-muted">
                          {formatProjectDueSummary(project.startDate, project.endDate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

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

      {/* Project Slide-Over Detail Drawer */}
      <ProjectDetailDrawer
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        tasks={projectTasks}
        onOpenFullPage={(id) => navigate(`/projects/${id}`)}
        onAddTaskClick={(id) => setQuickTaskProjectId(id)}
        onProjectUpdated={() => void refetch()}
      />

      {/* Create Project Modal */}
      <ProjectFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        mode="create"
        onSubmitCreate={handleCreateSubmit}
      />

      {/* Quick Create Task for Project Modal */}
      <TaskFormModal
        isOpen={Boolean(quickTaskProjectId)}
        onClose={() => setQuickTaskProjectId(null)}
        mode="create"
        defaultProjectId={quickTaskProjectId ?? undefined}
        onSubmitCreate={handleQuickCreateTask}
      />
    </div>
  );
}
