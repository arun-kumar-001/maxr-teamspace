import { useCallback, useEffect, useState } from 'react';
import { createProject, fetchProjects, ProjectsApiError } from '../api/projectsApi';
import type {
  CreateProjectInput,
  Project,
  ProjectPriority,
  ProjectSortOption,
  ProjectsSummary,
  ProjectStatus,
  ProjectWorkflowStatus,
} from '../types';

export interface UseProjectsOptions {
  initialPageSize?: number;
  autoFetch?: boolean;
}

function deriveSummary(items: Project[]): ProjectsSummary {
  const active = items.filter((p) => p.status === 'active');
  return {
    totalAssigned: active.length,
    inProgress: active.filter((p) => (p.workflowStatus ?? 'in_progress') === 'in_progress').length,
    completed: active.filter((p) => p.workflowStatus === 'completed').length,
    upcoming: active.filter((p) => p.workflowStatus === 'not_started').length,
    onHold: active.filter((p) => p.workflowStatus === 'on_hold').length,
  };
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { initialPageSize = 20, autoFetch = true } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [summary, setSummary] = useState<ProjectsSummary>({
    totalAssigned: 0,
    inProgress: 0,
    completed: 0,
    upcoming: 0,
    onHold: 0,
  });
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [statusCode, setStatusCode] = useState<number | undefined>(undefined);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [total, setTotal] = useState<number>(0);

  const [status, setStatus] = useState<ProjectStatus | undefined>(undefined);
  const [workflowStatus, setWorkflowStatus] = useState<ProjectWorkflowStatus | undefined>(
    undefined,
  );
  const [priority, setPriority] = useState<ProjectPriority | undefined>(undefined);
  const [sort, setSort] = useState<ProjectSortOption>('name');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadProjects = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);
      setStatusCode(undefined);

      try {
        const res = await fetchProjects(
          {
            page,
            pageSize,
            ...(status ? { status } : {}),
            ...(workflowStatus ? { workflowStatus } : {}),
            ...(priority ? { priority } : {}),
            ...(sort && sort !== 'name' ? { sort } : {}),
            ...(debouncedSearch ? { q: debouncedSearch } : {}),
          },
          signal,
        );
        setProjects(res.data);
        setTotal(res.meta.total);
        setSummary(res.summary ?? deriveSummary(res.data));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof ProjectsApiError) {
          setError(err.message);
          setErrorCode(err.code);
          setStatusCode(err.status);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch projects');
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, status, workflowStatus, priority, sort, debouncedSearch],
  );

  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [autoFetch, loadProjects]);

  const handleStatusChange = (newStatus?: ProjectStatus) => {
    setStatus(newStatus);
    setPage(1);
  };

  const handleWorkflowStatusChange = (next?: ProjectWorkflowStatus) => {
    setWorkflowStatus(next);
    setPage(1);
  };

  const handlePriorityChange = (next?: ProjectPriority) => {
    setPriority(next);
    setPage(1);
  };

  const handleSortChange = (next: ProjectSortOption) => {
    setSort(next);
    setPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
  };

  const handleCreateProject = async (input: CreateProjectInput): Promise<Project> => {
    const created = await createProject(input);
    await loadProjects();
    return created;
  };

  return {
    projects,
    summary,
    loading,
    error,
    errorCode,
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
    setPageSize,
    setStatus: handleStatusChange,
    setWorkflowStatus: handleWorkflowStatusChange,
    setPriority: handlePriorityChange,
    setSort: handleSortChange,
    setSearch: handleSearchChange,
    refetch: loadProjects,
    createProject: handleCreateProject,
  };
}
