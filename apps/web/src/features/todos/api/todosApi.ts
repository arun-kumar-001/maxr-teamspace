import { apiFetch } from '../../../api/client';
import type { CreateTodoInput, ListTodosResponse, PersonalTodo, UpdateTodoInput } from '../types';

export async function fetchTodos(options?: {
  completed?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ListTodosResponse> {
  const params = new URLSearchParams();
  if (options?.completed !== undefined) {
    params.set('completed', String(options.completed));
  }
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset !== undefined) {
    params.set('offset', String(options.offset));
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/api/v1/todos${query}`);
  if (!res.ok) throw new Error('Failed to load to-dos');
  const json = await res.json();
  return {
    data: json.data ?? [],
    meta: json.meta ?? {
      total: (json.data ?? []).length,
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
      hasMore: false,
    },
  };
}

export async function createTodo(input: CreateTodoInput): Promise<PersonalTodo> {
  const res = await apiFetch('/api/v1/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message ?? 'Failed to create to-do');
  }
  const data = await res.json();
  return data.data;
}

export async function toggleTodo(id: string): Promise<PersonalTodo> {
  const res = await apiFetch(`/api/v1/todos/${id}/toggle`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to toggle to-do');
  const data = await res.json();
  return data.data;
}

export async function updateTodo(id: string, input: UpdateTodoInput): Promise<PersonalTodo> {
  const res = await apiFetch(`/api/v1/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update to-do');
  const data = await res.json();
  return data.data;
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/todos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete to-do');
}
