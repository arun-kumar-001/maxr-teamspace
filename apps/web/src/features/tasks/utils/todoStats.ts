export interface TodoItemData {
  id: string;
  title: string;
  frequency: 'daily' | 'once';
  createdAt: string;
  completedDates: string[];
  isCompletedOnce?: boolean;
}

export const TODOS_STORAGE_KEY = 'maxr_sidebar_todos_v2';
export const TODOS_UPDATED_EVENT = 'maxr:todos-updated';

export const DEFAULT_INITIAL_TODOS: TodoItemData[] = [
  {
    id: 'todo-1',
    title: 'Daily standup & team status check',
    frequency: 'daily',
    createdAt: new Date().toISOString(),
    completedDates: [],
  },
  {
    id: 'todo-2',
    title: 'Review submitted pull requests',
    frequency: 'daily',
    createdAt: new Date().toISOString(),
    completedDates: [],
  },
  {
    id: 'todo-3',
    title: 'Verify onboarding checklist documents',
    frequency: 'once',
    createdAt: new Date().toISOString(),
    completedDates: [],
    isCompletedOnce: false,
  },
];

export function getSidebarTodos(): TodoItemData[] {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_INITIAL_TODOS;
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY);
    if (!raw) return DEFAULT_INITIAL_TODOS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INITIAL_TODOS;
  } catch {
    return DEFAULT_INITIAL_TODOS;
  }
}

export function isTodoCompletedToday(
  item: TodoItemData,
  todayStr = new Date().toISOString().slice(0, 10),
): boolean {
  if (item.frequency === 'daily') {
    return Array.isArray(item.completedDates) && item.completedDates.includes(todayStr);
  }
  return Boolean(item.isCompletedOnce);
}

export interface SidebarTodoStats {
  total: number;
  completed: number;
  pending: number;
}

export function getSidebarTodoStats(): SidebarTodoStats {
  const todos = getSidebarTodos();
  const todayStr = new Date().toISOString().slice(0, 10);
  let completed = 0;
  for (const t of todos) {
    if (isTodoCompletedToday(t, todayStr)) {
      completed += 1;
    }
  }
  return {
    total: todos.length,
    completed,
    pending: todos.length - completed,
  };
}

export function notifyTodosUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TODOS_UPDATED_EVENT));
  }
}

export function toggleSidebarTodo(id: string): TodoItemData[] {
  const todos = getSidebarTodos();
  const todayStr = new Date().toISOString().slice(0, 10);
  const updated = todos.map((item) => {
    if (item.id !== id) return item;
    if (item.frequency === 'daily') {
      const isDone = Array.isArray(item.completedDates) && item.completedDates.includes(todayStr);
      return {
        ...item,
        completedDates: isDone
          ? item.completedDates.filter((d) => d !== todayStr)
          : [...(item.completedDates || []), todayStr],
      };
    } else {
      return {
        ...item,
        isCompletedOnce: !item.isCompletedOnce,
      };
    }
  });
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    notifyTodosUpdated();
  }
  return updated;
}

export function addSidebarTodo(title: string, frequency: 'daily' | 'once' = 'daily'): TodoItemData[] {
  const todos = getSidebarTodos();
  const newItem: TodoItemData = {
    id: `todo-${Date.now()}`,
    title: title.trim(),
    frequency,
    createdAt: new Date().toISOString(),
    completedDates: [],
    isCompletedOnce: false,
  };
  const updated = [newItem, ...todos];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    notifyTodosUpdated();
  }
  return updated;
}

export function deleteSidebarTodo(id: string): TodoItemData[] {
  const todos = getSidebarTodos();
  const updated = todos.filter((item) => item.id !== id);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    notifyTodosUpdated();
  }
  return updated;
}
