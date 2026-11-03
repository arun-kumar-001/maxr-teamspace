import { apiFetch } from '../../../api/client';
import type {
  CreateProjectInput,
  Project,
  ProjectDetail,
  ProjectListQuery,
  ProjectListResponse,
  UpdateProjectInput,
} from '../types';

export class ProjectsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ProjectsApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // response not JSON
    }
    throw new ProjectsApiError(errorMsg, res.status, code);
  }
  return res.json() as Promise<T>;
}

export async function fetchProjects(
  query?: ProjectListQuery,
  signal?: AbortSignal,
): Promise<ProjectListResponse> {
  const searchParams = new URLSearchParams();
  if (query?.page) searchParams.set('page', String(query.page));
  if (query?.pageSize) searchParams.set('pageSize', String(query.pageSize));
  if (query?.status) searchParams.set('status', query.status);
  if (query?.q?.trim()) searchParams.set('q', query.q.trim());

  const url = `/api/v1/projects${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<ProjectListResponse>(res);
}

export async function fetchProjectById(id: string, signal?: AbortSignal): Promise<ProjectDetail> {
  const res = await apiFetch(
    `/api/v1/projects/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  const data = await handleResponse<{ data: ProjectDetail }>(res);
  return data.data;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const res = await apiFetch('/api/v1/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  const data = await handleResponse<{ data: Project }>(res);
  return data.data;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await handleResponse<{ data: ProjectDetail }>(res);
  return data.data;
}

export async function addProjectMember(id: string, employeeId: string): Promise<ProjectDetail> {
  const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(id)}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId }),
  });

  const data = await handleResponse<{ data: ProjectDetail }>(res);
  return data.data;
}

export async function removeProjectMember(id: string, employeeId: string): Promise<ProjectDetail> {
  const res = await apiFetch(
    `/api/v1/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(employeeId)}`,
    {
      method: 'DELETE',
    },
  );

  const data = await handleResponse<{ data: ProjectDetail }>(res);
  return data.data;
}
