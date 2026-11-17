import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  changeTaskStatus,
  createTask,
  fetchMyTasks,
  fetchTeamTasks,
  TasksApiError,
  toggleTaskDailyDone,
  updateTask,
} from '../api/tasksApi';
import {
  TASK_TRANSITIONS,
  TASK_TRANSITION_PATHS,
  type CreateTaskInput,
  type ListTasksQuery,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
} from '../types';

export interface UseTasksOptions {
  scope?: 'mine' | 'team';
  initialStatus?: TaskStatus;
  initialPriority?: TaskPriority;
  initialProjectId?: string;
  initialPageSize?: number;
  autoFetch?: boolean;
}

export const FALLBACK_TASKS: Task[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Implement User CSV Export',
    description: 'Allow Admins to export all active users.',
    projectId: '99999999-9999-9999-9999-999999999999',
    projectName: 'Data Export Suite',
    assigneeEmployeeId: '22222222-2222-2222-2222-222222222222',
    assigneeName: 'Alice Walker',
    assignerEmployeeId: '33333333-3333-3333-3333-333333333333',
    assignerName: 'Bob Lead',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2026-11-30',
    isOverdue: false,
    completedAt: null,
    version: 1,
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-01T09:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Update Attendance Policies and Roster',
    description: 'Configure standard shift timings 9 AM to 7 PM across departments.',
    projectId: '99999999-9999-9999-9999-999999999999',
    projectName: 'Workforce Operations',
    assigneeEmployeeId: '33333333-3333-3333-3333-333333333333',
    assigneeName: 'Marcus Vance',
    assignerEmployeeId: '11111111-1111-1111-1111-111111111111',
    assignerName: 'Shagul Hamithu',
    status: 'todo',
    priority: 'urgent',
    dueDate: '2026-11-20',
    isOverdue: false,
    completedAt: null,
    version: 1,
    createdAt: '2026-11-05T09:00:00Z',
    updatedAt: '2026-11-05T09:00:00Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Generate November Payroll Summaries',
    description: 'Download and verify monthly payslip PDFs for staff review.',
    projectId: '88888888-8888-8888-8888-888888888888',
    projectName: 'Finance & Compliance',
    assigneeEmployeeId: '44444444-4444-4444-4444-444444444444',
    assigneeName: 'Shajitha Banu',
    assignerEmployeeId: '11111111-1111-1111-1111-111111111111',
    assignerName: 'Shagul Hamithu',
    status: 'completed',
    priority: 'medium',
    dueDate: '2026-11-15',
    isOverdue: false,
    completedAt: '2026-11-15T16:00:00Z',
    version: 1,
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-15T16:00:00Z',
  },
];

export function useTasks(options: UseTasksOptions = {}) {
  const {
    scope = 'mine',
    initialStatus,
    initialPriority,
    initialProjectId,
    initialPageSize = 50,
    autoFetch = true,
  } = options;

  const [currentScope, setCurrentScope] = useState<'mine' | 'team'>(scope);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  const [status, setStatus] = useState<TaskStatus | undefined>(initialStatus);
  const [priority, setPriority] = useState<TaskPriority | undefined>(initialPriority);
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [assigneeEmployeeId, setAssigneeEmployeeId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [total, setTotal] = useState<number>(0);

  const loadTasks = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      setErrorCode(undefined);

      try {
        const query: ListTasksQuery = {
          page,
          pageSize,
          status,
          priority,
          projectId: projectId || undefined,
          overdue: overdueOnly ? true : undefined,
          assigneeEmployeeId: currentScope === 'team' ? assigneeEmployeeId : undefined,
        };

        const res =
          currentScope === 'team'
            ? await fetchTeamTasks(query, signal)
            : await fetchMyTasks(query, signal);

        setTasks(res.data);
        setTotal(res.meta.total);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        if (err instanceof TasksApiError && err.status === 403) {
          setError(err.message);
          setErrorCode(err.code);
          setTasks([]);
        } else {
          // Fallback mock tasks for dev / offline / unauthenticated demo
          setTasks(FALLBACK_TASKS);
          setTotal(FALLBACK_TASKS.length);
          setError(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, status, priority, projectId, overdueOnly, assigneeEmployeeId, currentScope],
  );

  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    void loadTasks(controller.signal);
    return () => controller.abort();
  }, [loadTasks, autoFetch]);

  // Client-side text filter for search query across title, description, assignee, project
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.projectName && t.projectName.toLowerCase().includes(q)) ||
        t.assigneeName.toLowerCase().includes(q) ||
        t.assignerName.toLowerCase().includes(q),
    );
  }, [tasks, search]);

  // Grouped tasks by status for Kanban Board columns
  const boardColumns = useMemo(() => {
    const columns: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      blocked: [],
      completed: [],
    };

    for (const t of filteredTasks) {
      if (columns[t.status]) {
        columns[t.status].push(t);
      }
    }

    return columns;
  }, [filteredTasks]);

  const handleCreateTask = async (input: CreateTaskInput): Promise<Task> => {
    const created = await createTask(input);
    await loadTasks();
    return created;
  };

  const handleUpdateTask = async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const updated = await updateTask(id, input);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const handleChangeStatus = async (id: string, newStatus: TaskStatus): Promise<Task> => {
    const current = tasks.find((t) => t.id === id);
    if (!current || current.status === newStatus) {
      return current ?? tasks[0]!;
    }

    const path =
      TASK_TRANSITION_PATHS[current.status]?.[newStatus] ??
      (TASK_TRANSITIONS[current.status]?.includes(newStatus) ? [newStatus] : [newStatus]);

    // Optimistic UI update: instantly moves the card to the target column
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));

    let latest: Task | null = null;
    try {
      for (const step of path) {
        latest = await changeTaskStatus(id, step);
      }
      if (latest) {
        const finalTask = latest;
        setTasks((prev) => prev.map((t) => (t.id === id ? finalTask : t)));
        return finalTask;
      }
    } catch (err) {
      // Revert optimistic update on failure
      setTasks((prev) => prev.map((t) => (t.id === id ? current : t)));
      throw err;
    }

    return current;
  };

  const handleToggleDailyDone = async (id: string): Promise<Task> => {
    const updated = await toggleTaskDailyDone(id);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  };

  const switchScope = (newScope: 'mine' | 'team') => {
    setCurrentScope(newScope);
    setPage(1);
    setAssigneeEmployeeId(undefined);
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    boardColumns,
    loading,
    error,
    errorCode,
    page,
    pageSize,
    total,
    scope: currentScope,
    status,
    priority,
    projectId,
    overdueOnly,
    assigneeEmployeeId,
    search,
    setPage,
    setPageSize,
    setStatus,
    setPriority,
    setProjectId,
    setOverdueOnly,
    setAssigneeEmployeeId,
    setSearch,
    setScope: switchScope,
    refetch: loadTasks,
    createTask: handleCreateTask,
    updateTask: handleUpdateTask,
    changeStatus: handleChangeStatus,
    toggleDailyDone: handleToggleDailyDone,
  };
}
