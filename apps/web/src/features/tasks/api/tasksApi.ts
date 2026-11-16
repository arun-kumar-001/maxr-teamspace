import { apiFetch } from '../../../api/client';
import type {
  AttachmentDownloadLink,
  CreateTaskInput,
  ListTasksQuery,
  ListTasksResponse,
  Task,
  TaskAttachment,
  TaskComment,
  TaskStatus,
  UpdateTaskInput,
} from '../types';

export class TasksApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'TasksApiError';
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
    throw new TasksApiError(errorMsg, res.status, code);
  }
  return res.json() as Promise<T>;
}

function buildSearchParams(query?: ListTasksQuery): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (query?.page) searchParams.set('page', String(query.page));
  if (query?.pageSize) searchParams.set('pageSize', String(query.pageSize));
  if (query?.status) searchParams.set('status', query.status);
  if (query?.priority) searchParams.set('priority', query.priority);
  if (query?.projectId) searchParams.set('projectId', query.projectId);
  if (query?.overdue !== undefined) searchParams.set('overdue', String(query.overdue));
  if (query?.dueFrom) searchParams.set('dueFrom', query.dueFrom);
  if (query?.dueTo) searchParams.set('dueTo', query.dueTo);
  if (query?.assigneeEmployeeId) searchParams.set('assigneeEmployeeId', query.assigneeEmployeeId);
  return searchParams;
}

export async function fetchMyTasks(
  query?: ListTasksQuery,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const searchParams = buildSearchParams(query);
  const url = `/api/v1/tasks/me${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<ListTasksResponse>(res);
}

export async function fetchTeamTasks(
  query?: ListTasksQuery,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const searchParams = buildSearchParams(query);
  const url = `/api/v1/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<ListTasksResponse>(res);
}

export async function fetchTaskById(id: string, signal?: AbortSignal): Promise<Task> {
  const res = await apiFetch(
    `/api/v1/tasks/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `task-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const res = await apiFetch('/api/v1/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function changeTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function toggleTaskDailyDone(id: string): Promise<Task> {
  const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/daily-done`, {
    method: 'POST',
  });

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function fetchTaskComments(
  taskId: string,
  query?: { page?: number; pageSize?: number },
  signal?: AbortSignal,
): Promise<{ data: TaskComment[]; meta?: { page: number; pageSize: number; total: number } }> {
  const params = new URLSearchParams();
  if (query?.page) params.set('page', String(query.page));
  if (query?.pageSize) params.set('pageSize', String(query.pageSize));
  const url = `/api/v1/tasks/${encodeURIComponent(taskId)}/comments${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<{
    data: TaskComment[];
    meta?: { page: number; pageSize: number; total: number };
  }>(res);
}

export async function createTaskComment(taskId: string, body: string): Promise<TaskComment> {
  const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });

  const data = await handleResponse<{ data: TaskComment }>(res);
  return data.data;
}

export async function fetchTaskAttachments(
  taskId: string,
  signal?: AbortSignal,
): Promise<TaskAttachment[]> {
  const res = await apiFetch(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments`,
    signal ? { signal } : undefined,
  );
  const data = await handleResponse<{ data: TaskAttachment[] }>(res);
  return data.data;
}

export async function uploadTaskAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}/attachments`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  });

  const data = await handleResponse<{ data: TaskAttachment }>(res);
  return data.data;
}

export async function fetchAttachmentDownloadLink(
  taskId: string,
  attachmentId: string,
): Promise<AttachmentDownloadLink> {
  const res = await apiFetch(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}/download-link`,
  );
  const data = await handleResponse<{ data: AttachmentDownloadLink }>(res);
  return data.data;
}

export async function deleteTaskAttachment(
  taskId: string,
  attachmentId: string,
): Promise<{ removed: boolean }> {
  const res = await apiFetch(
    `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: 'DELETE',
    },
  );
  const data = await handleResponse<{ data: { removed: boolean } }>(res);
  return data.data;
}
