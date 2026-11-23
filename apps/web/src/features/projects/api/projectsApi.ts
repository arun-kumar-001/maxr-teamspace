import { apiFetch } from '../../../api/client';
import type {
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  ProjectDetail,
  ProjectDocument,
  ProjectDocumentCategory,
  ProjectListQuery,
  ProjectListResponse,
  ProjectMilestone,
  ProjectUpdate,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from '../types';
import {
  mockAddProjectMember,
  mockCreateProject,
  mockCreateProjectMilestone,
  mockCreateProjectUpdate,
  mockDeleteProjectDocument,
  mockFetchProjectById,
  mockFetchProjects,
  mockGetDocumentDownloadLink,
  mockRemoveProjectMember,
  mockUpdateProject,
  mockUpdateProjectMilestone,
  mockUploadProjectDocument,
} from './mockProjects';

export class ProjectsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown[],
  ) {
    super(message);
    this.name = 'ProjectsApiError';
  }
}

function isDevMockFallbackCandidate(err: unknown): boolean {
  const devMockEnabled =
    import.meta.env.DEV &&
    import.meta.env.VITE_DEV_MOCK_AUTH === 'true' &&
    import.meta.env.MODE !== 'test';
  if (!devMockEnabled) return false;
  if (err instanceof DOMException && err.name === 'AbortError') return false;
  if (err instanceof ProjectsApiError) {
    return err.status === 401 || err.status === 502 || err.status === 503 || err.status === 504;
  }
  return err instanceof TypeError;
}

async function withDevMockFallback<T>(
  requestFn: () => Promise<T>,
  fallbackFn: () => T,
): Promise<T> {
  try {
    return await requestFn();
  } catch (err) {
    if (isDevMockFallbackCandidate(err)) {
      return fallbackFn();
    }
    throw err;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const errObj = data?.error || {};
    throw new ProjectsApiError(
      errObj.message || `API request failed with status ${res.status}`,
      res.status,
      errObj.code,
      errObj.details,
    );
  }
  return data as T;
}

export async function fetchProjects(
  query: ProjectListQuery = {},
  signal?: AbortSignal,
): Promise<ProjectListResponse> {
  return withDevMockFallback(
    async () => {
      const params = new URLSearchParams();
      if (query.page !== undefined) params.set('page', String(query.page));
      if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
      if (query.status) params.set('status', query.status);
      if (query.workflowStatus) params.set('workflowStatus', query.workflowStatus);
      if (query.priority) params.set('priority', query.priority);
      if (query.sort) params.set('sort', query.sort);
      if (query.q && query.q.trim()) params.set('q', query.q.trim());

      const qs = params.toString();
      const res = await apiFetch(
        `/api/v1/projects${qs ? `?${qs}` : ''}`,
        signal ? { signal } : undefined,
      );
      return handleResponse<ProjectListResponse>(res);
    },
    () => mockFetchProjects(query),
  );
}

export async function fetchProjectById(id: string, signal?: AbortSignal): Promise<ProjectDetail> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(id)}`,
        signal ? { signal } : undefined,
      );
      const data = await handleResponse<{ data: ProjectDetail }>(res);
      return data.data;
    },
    () => {
      const found = mockFetchProjectById(id);
      if (!found) {
        throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      }
      return found;
    },
  );
}

export async function createProject(input: CreateProjectInput): Promise<ProjectDetail> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await handleResponse<{ data: ProjectDetail }>(res);
      return data.data;
    },
    () => mockCreateProject(input),
  );
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDetail> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await handleResponse<{ data: ProjectDetail }>(res);
      return data.data;
    },
    () => {
      const updated = mockUpdateProject(id, input);
      if (!updated) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return updated;
    },
  );
}

export async function addProjectMember(id: string, employeeId: string): Promise<ProjectDetail> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(id)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });
      const data = await handleResponse<{ data: ProjectDetail }>(res);
      return data.data;
    },
    () => {
      const updated = mockAddProjectMember(id, employeeId);
      if (!updated) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return updated;
    },
  );
}

export async function removeProjectMember(id: string, employeeId: string): Promise<ProjectDetail> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(employeeId)}`,
        { method: 'DELETE' },
      );
      const data = await handleResponse<{ data: ProjectDetail }>(res);
      return data.data;
    },
    () => {
      const updated = mockRemoveProjectMember(id, employeeId);
      if (!updated) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return updated;
    },
  );
}

export async function createProjectMilestone(
  projectId: string,
  input: CreateMilestoneInput,
): Promise<ProjectMilestone> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await handleResponse<{ data: ProjectMilestone }>(res);
      return data.data;
    },
    () => {
      const created = mockCreateProjectMilestone(projectId, input);
      if (!created) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return created;
    },
  );
}

export async function updateProjectMilestone(
  projectId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<ProjectMilestone> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      const data = await handleResponse<{ data: ProjectMilestone }>(res);
      return data.data;
    },
    () => {
      const updated = mockUpdateProjectMilestone(projectId, milestoneId, input);
      if (!updated) throw new ProjectsApiError('Milestone not found', 404, 'NOT_FOUND');
      return updated;
    },
  );
}

export async function createProjectUpdate(
  projectId: string,
  input: CreateProjectUpdateInput,
): Promise<ProjectUpdate> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(`/api/v1/projects/${encodeURIComponent(projectId)}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await handleResponse<{ data: ProjectUpdate }>(res);
      return data.data;
    },
    () => {
      const created = mockCreateProjectUpdate(projectId, input);
      if (!created) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return created;
    },
  );
}

export async function uploadProjectDocument(
  projectId: string,
  file: File,
  category: ProjectDocumentCategory = 'general',
): Promise<ProjectDocument> {
  return withDevMockFallback(
    async () => {
      const params = new URLSearchParams({ category });
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/documents?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'X-Filename': encodeURIComponent(file.name),
          },
          body: file,
        },
      );
      const data = await handleResponse<{ data: ProjectDocument }>(res);
      return data.data;
    },
    () => {
      const created = mockUploadProjectDocument(projectId, file, category);
      if (!created) throw new ProjectsApiError('Project not found', 404, 'NOT_FOUND');
      return created;
    },
  );
}

export async function fetchProjectDocumentDownloadLink(
  projectId: string,
  documentId: string,
): Promise<{ url: string; expiresAt: string }> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}/download-link`,
      );
      const data = await handleResponse<{ data: { url: string; expiresAt: string } }>(res);
      return data.data;
    },
    () => mockGetDocumentDownloadLink(documentId),
  );
}

export async function deleteProjectDocument(
  projectId: string,
  documentId: string,
): Promise<{ removed: boolean }> {
  return withDevMockFallback(
    async () => {
      const res = await apiFetch(
        `/api/v1/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`,
        { method: 'DELETE' },
      );
      const data = await handleResponse<{ data: { removed: boolean } }>(res);
      return data.data;
    },
    () => ({ removed: mockDeleteProjectDocument(projectId, documentId) }),
  );
}
