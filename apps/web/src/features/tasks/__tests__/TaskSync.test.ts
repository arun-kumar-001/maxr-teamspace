// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTaskOverrides,
  computeTaskCounts,
  getTaskStatusOverrides,
  notifyTaskStatusChanged,
  onTaskStatusChanged,
  saveTaskStatusOverride,
} from '../task-sync';
import type { Task } from '../types';

describe('task-sync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'First Task',
      description: null,
      projectId: null,
      projectName: null,
      assigneeEmployeeId: 'emp-1',
      assigneeName: 'Alice',
      assignerEmployeeId: 'emp-2',
      assignerName: 'Bob',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-12-01',
      isOverdue: false,
      completedAt: null,
      version: 1,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'task-2',
      title: 'Second Task',
      description: null,
      projectId: null,
      projectName: null,
      assigneeEmployeeId: 'emp-1',
      assigneeName: 'Alice',
      assignerEmployeeId: 'emp-2',
      assignerName: 'Bob',
      status: 'in_progress',
      priority: 'medium',
      dueDate: '2026-11-01', // in past relative to today
      isOverdue: true,
      completedAt: null,
      version: 1,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'task-3',
      title: 'Third Task',
      description: null,
      projectId: null,
      projectName: null,
      assigneeEmployeeId: 'emp-3',
      assigneeName: 'Charlie',
      assignerEmployeeId: 'emp-2',
      assignerName: 'Bob',
      status: 'completed',
      priority: 'low',
      dueDate: '2026-11-10',
      isOverdue: false,
      completedAt: '2026-11-10T12:00:00Z',
      version: 1,
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-10T12:00:00Z',
    },
  ];

  it('persists and retrieves task status overrides in localStorage', () => {
    expect(getTaskStatusOverrides()).toEqual({});

    saveTaskStatusOverride('task-1', 'completed');
    const overrides = getTaskStatusOverrides();
    expect(overrides['task-1']?.status).toBe('completed');
    expect(overrides['task-1']?.completedAt).toBeTruthy();

    saveTaskStatusOverride('task-1', 'in_progress');
    const updated = getTaskStatusOverrides();
    expect(updated['task-1']?.status).toBe('in_progress');
    expect(updated['task-1']?.completedAt).toBeNull();
  });

  it('applies task status overrides correctly to a list of tasks', () => {
    saveTaskStatusOverride('task-1', 'completed');
    saveTaskStatusOverride('task-2', 'in_review');

    const updated = applyTaskOverrides(mockTasks);
    expect(updated[0]?.status).toBe('completed');
    expect(updated[0]?.completedAt).toBeTruthy();
    expect(updated[0]?.isOverdue).toBe(false);

    expect(updated[1]?.status).toBe('in_review');
    expect(updated[2]?.status).toBe('completed');
  });

  it('computes accurate task counts and completed percentage', () => {
    const summary = computeTaskCounts(mockTasks);
    expect(summary.total).toBe(3);
    expect(summary.completed).toBe(1);
    expect(summary.overdue).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.completedPct).toBe(33); // 1 / 3 = 33%
  });

  it('dispatches and listens to task status change events', () => {
    const listener = vi.fn();
    const unsubscribe = onTaskStatusChanged(listener);

    notifyTaskStatusChanged('task-99', 'completed');
    expect(listener).toHaveBeenCalledWith({ id: 'task-99', status: 'completed' });

    unsubscribe();
    notifyTaskStatusChanged('task-99', 'todo');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
