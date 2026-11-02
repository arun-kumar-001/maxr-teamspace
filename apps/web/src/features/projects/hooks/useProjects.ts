import { useCallback, useEffect, useState } from 'react';
import { createProject, fetchProjects, ProjectsApiError } from '../api/projectsApi';
import type { CreateProjectInput, Project, ProjectListQuery, ProjectStatus } from '../types';

export interface UseProjectsOptions {
  initialStatus?: ProjectStatus;
  initialPageSize?: number;
  initialSearch?: string;
  autoFetch?: boolean;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { initialStatus, initialPageSize = 20, initialSearch = '', autoFetch = true } = options;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  const [status, setStatus] = useState<ProjectStatus | undefined>(initialStatus);
  const [search, setSearch] = useState<string>(initialSearch);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [total, setTotal] = useState<number>(0);

  const loadProjects = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);

      try {
        const query: ProjectListQuery = {
          page,
          pageSize,
          status,
          q: search.trim() ? search.trim() : undefined,
        };

        const res = await fetchProjects(query, signal);
        setProjects(res.data);
        setTotal(res.meta.total);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof ProjectsApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred while fetching projects');
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, status, search],
  );

  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [loadProjects, autoFetch]);

  const handleCreate = async (input: CreateProjectInput): Promise<Project> => {
    const created = await createProject(input);
    await loadProjects();
    return created;
  };

  const handleStatusChange = (newStatus?: ProjectStatus) => {
    setStatus(newStatus);
    setPage(1);
  };

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  };

  return {
    projects,
    loading,
    error,
    errorCode,
    page,
    pageSize,
    total,
    status,
    search,
    setPage,
    setPageSize,
    setStatus: handleStatusChange,
    setSearch: handleSearchChange,
    refetch: loadProjects,
    createProject: handleCreate,
  };
}
