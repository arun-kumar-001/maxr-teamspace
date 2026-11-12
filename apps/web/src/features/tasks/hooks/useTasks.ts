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
import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskInput,
} from '../types';

export interface UseTasksOptions {
  scope?: 'mine' | 'team';
  initialStatus?: TaskStatus;
  initialPriority?: TaskPriority;
  initialProjectId?: string;
  initialPageSize?: number;
  autoFetch?: boolean;
}

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
        if (err instanceof TasksApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Failed to fetch tasks.');
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
    const updated = await changeTaskStatus(id, newStatus);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
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
