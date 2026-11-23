// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as tasksApi from '../api/tasksApi';
import { useTasks } from '../hooks/useTasks';
import type { Task } from '../types';

vi.mock('../api/tasksApi', async () => {
  const actual = await vi.importActual<typeof tasksApi>('../api/tasksApi');
  return { ...actual, fetchMyTasks: vi.fn(), changeTaskStatus: vi.fn(), updateTask: vi.fn() };
});

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    title: 'Real task',
    status: 'todo',
    assigneeName: 'A',
    assignerName: 'B',
    isOverdue: false,
    completedAt: null,
    ...over,
  }) as Task;

const page = (data: Task[]) => ({ data, meta: { page: 1, pageSize: 20, total: data.length } });

describe('useTasks never shows invented data outside a development demo', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.resetAllMocks());

  it('shows an empty list, not sample tasks, when the server has none', async () => {
    vi.mocked(tasksApi.fetchMyTasks).mockResolvedValue(page([]));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('shows an error, not sample tasks, when the request fails', async () => {
    vi.mocked(tasksApi.fetchMyTasks).mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.error).toBe('network down');
  });

  it('puts the card back and reports the failure when the server refuses a status change', async () => {
    vi.mocked(tasksApi.fetchMyTasks).mockResolvedValue(page([task()]));
    vi.mocked(tasksApi.changeTaskStatus).mockRejectedValue(new Error('Illegal transition'));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await expect(result.current.changeStatus('t1', 'in_progress')).rejects.toThrow(
        'Illegal transition',
      );
    });
    expect(result.current.tasks[0]?.status).toBe('todo');
    expect(localStorage.length).toBe(0);
  });

  it('does not pretend a failed edit worked', async () => {
    vi.mocked(tasksApi.fetchMyTasks).mockResolvedValue(page([task()]));
    vi.mocked(tasksApi.updateTask).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    await act(async () => {
      await expect(result.current.updateTask('t1', { title: 'Renamed' } as never)).rejects.toThrow(
        'Conflict',
      );
    });
    expect(result.current.tasks[0]?.title).toBe('Real task');
  });
});
