import { apiFetch, setCsrfToken } from '../../../api/client';
import { isDemoDataEnabled } from '@/lib/demo-data';
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

async function withAuthRetry(fn: () => Promise<Response>): Promise<Response> {
  let res = await fn();
  if (res.status === 401 && import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    try {
      const loginRes = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@maxr.internal', password: 'Password123!' }),
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        if (loginData?.data?.csrfToken) {
          setCsrfToken(loginData.data.csrfToken);
        }
        res = await fn();
      }
    } catch {
      // Ignore retry error and let handleResponse handle original response
    }
  }
  return res;
}

export async function fetchMyTasks(
  query?: ListTasksQuery,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const searchParams = buildSearchParams(query);
  const url = `/api/v1/tasks/me${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await withAuthRetry(() => apiFetch(url, signal ? { signal } : undefined));
  if (!res.ok && isDemoDataEnabled()) {
    return { data: [], meta: { page: 1, pageSize: query?.pageSize ?? 50, total: 0 } };
  }
  return handleResponse<ListTasksResponse>(res);
}

export async function fetchTeamTasks(
  query?: ListTasksQuery,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const searchParams = buildSearchParams(query);
  const url = `/api/v1/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const res = await withAuthRetry(() => apiFetch(url, signal ? { signal } : undefined));
  if (!res.ok && isDemoDataEnabled()) {
    return { data: [], meta: { page: 1, pageSize: query?.pageSize ?? 50, total: 0 } };
  }
  return handleResponse<ListTasksResponse>(res);
}

export async function fetchTaskById(id: string, signal?: AbortSignal): Promise<Task> {
  const res = await withAuthRetry(() =>
    apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`, signal ? { signal } : undefined),
  );
  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `task-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const res = await withAuthRetry(() =>
    apiFetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(input),
    }),
  );

  if (!res.ok && isDemoDataEnabled()) {
    const fallbackTask: Task = {
      id: `task-demo-${Date.now()}`,
      title: input.title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      projectName: null,
      assigneeEmployeeId: input.assigneeEmployeeId,
      assigneeName: 'Me',
      assignerEmployeeId: input.assigneeEmployeeId,
      assignerName: 'Me',
      status: 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      isOverdue: false,
      isDaily: input.isDaily,
      completedAt: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return fallbackTask;
  }

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const res = await withAuthRetry(() =>
    apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );

  const data = await handleResponse<{ data: Task }>(res);
  return data.data;
}

export async function changeTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const res = await withAuthRetry(() =>
    apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  );

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
