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

const LOCAL_TASKS_KEY = 'maxr_local_created_tasks';

export function getLocalTasks(): Task[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTask(task: Task): void {
  try {
    if (typeof window === 'undefined') return;
    const existing = getLocalTasks();
    localStorage.setItem(
      LOCAL_TASKS_KEY,
      JSON.stringify([task, ...existing.filter((t) => t.id !== task.id)]),
    );
  } catch {
    // non-fatal
  }
}

export function updateLocalTask(id: string, updates: Partial<Task>): Task | null {
  try {
    if (typeof window === 'undefined') return null;
    const existing = getLocalTasks();
    const idx = existing.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const updated = { ...existing[idx]!, ...updates, updatedAt: new Date().toISOString() };
    existing[idx] = updated;
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(existing));
    return updated;
  } catch {
    return null;
  }
}

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
  let apiTasks: Task[] = [];
  let meta = { page: 1, pageSize: 50, total: 0 };

  try {
    const res = await apiFetch(url, signal ? { signal } : undefined);
    const data = await handleResponse<ListTasksResponse>(res);
    apiTasks = data.data;
    meta = data.meta;
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  const localTasks = getLocalTasks();
  if (localTasks.length > 0) {
    const existingIds = new Set(apiTasks.map((t) => t.id));
    let filteredLocal = localTasks.filter((t) => !existingIds.has(t.id));
    if (query?.status) {
      filteredLocal = filteredLocal.filter((t) => t.status === query.status);
    }
    if (query?.priority) {
      filteredLocal = filteredLocal.filter((t) => t.priority === query.priority);
    }
    if (query?.projectId) {
      filteredLocal = filteredLocal.filter((t) => t.projectId === query.projectId);
    }
    return {
      data: [...filteredLocal, ...apiTasks],
      meta: {
        page: meta.page,
        pageSize: meta.pageSize,
        total: meta.total + filteredLocal.length,
      },
    };
  }

  return { data: apiTasks, meta };
}

export async function fetchTeamTasks(
  query?: ListTasksQuery,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const searchParams = buildSearchParams(query);
  const url = `/api/v1/tasks${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  let apiTasks: Task[] = [];
  let meta = { page: 1, pageSize: 50, total: 0 };

  try {
    const res = await apiFetch(url, signal ? { signal } : undefined);
    const data = await handleResponse<ListTasksResponse>(res);
    apiTasks = data.data;
    meta = data.meta;
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  const localTasks = getLocalTasks();
  if (localTasks.length > 0) {
    const existingIds = new Set(apiTasks.map((t) => t.id));
    let filteredLocal = localTasks.filter((t) => !existingIds.has(t.id));
    if (query?.status) {
      filteredLocal = filteredLocal.filter((t) => t.status === query.status);
    }
    if (query?.priority) {
      filteredLocal = filteredLocal.filter((t) => t.priority === query.priority);
    }
    if (query?.projectId) {
      filteredLocal = filteredLocal.filter((t) => t.projectId === query.projectId);
    }
    if (query?.assigneeEmployeeId) {
      filteredLocal = filteredLocal.filter(
        (t) => t.assigneeEmployeeId === query.assigneeEmployeeId,
      );
    }
    return {
      data: [...filteredLocal, ...apiTasks],
      meta: {
        page: meta.page,
        pageSize: meta.pageSize,
        total: meta.total + filteredLocal.length,
      },
    };
  }

  return { data: apiTasks, meta };
}

export async function fetchTaskById(id: string, signal?: AbortSignal): Promise<Task> {
  const local = getLocalTasks().find((t) => t.id === id);
  if (local && id.startsWith('local-')) return local;

  try {
    const res = await apiFetch(
      `/api/v1/tasks/${encodeURIComponent(id)}`,
      signal ? { signal } : undefined,
    );
    const data = await handleResponse<{ data: Task }>(res);
    return data.data;
  } catch (err) {
    if (local) return local;
    throw err;
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { assignerEmployeeId, assigneeName, assignerName, ...apiPayload } = input;
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `task-idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const createLocalFallback = (): Task => {
    const now = new Date().toISOString();
    const localTask: Task = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `local-task-${Date.now()}`,
      title: input.title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      projectName: null,
      assigneeEmployeeId: input.assigneeEmployeeId,
      assigneeName: assigneeName ?? 'Assigned Employee',
      assignerEmployeeId: assignerEmployeeId ?? '',
      assignerName: assignerName ?? 'Self',
      status: 'todo',
      priority: input.priority || 'medium',
      dueDate: input.dueDate ?? null,
      isDaily: input.isDaily ?? false,
      isOverdue: false,
      completedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    saveLocalTask(localTask);
    return localTask;
  };

  try {
    const res = await apiFetch('/api/v1/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(apiPayload),
    });

    if (res.status === 403) {
      return createLocalFallback();
    }

    const data = await handleResponse<{ data: Task }>(res);
    const created = { ...data.data };
    if (assigneeName && !created.assigneeName) created.assigneeName = assigneeName;
    if (assignerName && !created.assignerName) created.assignerName = assignerName;
    return created;
  } catch (err: unknown) {
    if (err instanceof TasksApiError && err.status === 403) {
      return createLocalFallback();
    }
    throw err;
  }
}

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const local = updateLocalTask(id, input as Partial<Task>);
  if (local && id.startsWith('local-')) {
    return local;
  }

  const {
    assignerEmployeeId: _assignerEmployeeId,
    assigneeName: _assigneeName,
    assignerName: _assignerName,
    ...apiPayload
  } = input;
  try {
    const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });

    const data = await handleResponse<{ data: Task }>(res);
    return data.data;
  } catch (err) {
    if (local) return local;
    throw err;
  }
}

export async function changeTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const isLocal = id.startsWith('local-');
  if (isLocal) {
    const updated = updateLocalTask(id, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
    });
    if (updated) return updated;
  }

  try {
    const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    const data = await handleResponse<{ data: Task }>(res);
    return data.data;
  } catch (err) {
    const local = updateLocalTask(id, {
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : null,
    });
    if (local) return local;
    throw err;
  }
}

export async function toggleTaskDailyDone(id: string): Promise<Task> {
  const isLocal = id.startsWith('local-');
  const today = new Date().toISOString().slice(0, 10);
  if (isLocal) {
    const localTasks = getLocalTasks();
    const existing = localTasks.find((t) => t.id === id);
    const isDone = existing?.dailyLastDoneDate === today;
    const updated = updateLocalTask(id, {
      dailyLastDoneDate: isDone ? null : today,
    });
    if (updated) return updated;
  }

  try {
    const res = await apiFetch(`/api/v1/tasks/${encodeURIComponent(id)}/daily-done`, {
      method: 'POST',
    });

    const data = await handleResponse<{ data: Task }>(res);
    return data.data;
  } catch (err) {
    const localTasks = getLocalTasks();
    const existing = localTasks.find((t) => t.id === id);
    const isDone = existing?.dailyLastDoneDate === today;
    const updated = updateLocalTask(id, {
      dailyLastDoneDate: isDone ? null : today,
    });
    if (updated) return updated;
    throw err;
  }
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
