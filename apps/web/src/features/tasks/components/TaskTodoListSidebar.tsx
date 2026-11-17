import React, { useState, useEffect, useRef } from 'react';

export interface TodoItem {
  id: string;
  title: string;
  frequency: 'daily' | 'once';
  createdAt: string; // ISO date string
  completedDates: string[]; // ['2026-11-17', ...] for daily habits
  isCompletedOnce?: boolean; // for one-time tasks
}

const STORAGE_KEY = 'maxr_sidebar_todos_v2';

const INITIAL_TODOS: TodoItem[] = [
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

export function TaskTodoListSidebar() {
  const [todos, setTodos] = useState<TodoItem[]>(() => {
    if (typeof window === 'undefined' || !window.localStorage) return INITIAL_TODOS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback to default
    }
    return INITIAL_TODOS;
  });

  const [filter, setFilter] = useState<'all' | 'daily' | 'once'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'once'>('daily');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'once'>('daily');

  // Active 3-dots in-row actions
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mobile swipe gesture state
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const gestureStartX = useRef<number>(0);
  const gestureStartY = useRef<number>(0);
  const isGestureActive = useRef<boolean>(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Save to localStorage whenever todos change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      } catch {
        // Storage full or private mode
      }
    }
  }, [todos]);

  // Click outside to close in-row actions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to determine if an item is completed for today
  const isItemCompleted = (item: TodoItem): boolean => {
    if (item.frequency === 'daily') {
      return item.completedDates.includes(todayStr);
    }
    return Boolean(item.isCompletedOnce);
  };

  // Toggle item completion
  const handleToggleComplete = (id: string) => {
    setTodos((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (item.frequency === 'daily') {
          const isDone = item.completedDates.includes(todayStr);
          return {
            ...item,
            completedDates: isDone
              ? item.completedDates.filter((d) => d !== todayStr)
              : [...item.completedDates, todayStr],
          };
        } else {
          return {
            ...item,
            isCompletedOnce: !item.isCompletedOnce,
          };
        }
      }),
    );
  };

  // Add new todo
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: TodoItem = {
      id: `todo-${Date.now()}`,
      title: newTitle.trim(),
      frequency: newFrequency,
      createdAt: new Date().toISOString(),
      completedDates: [],
      isCompletedOnce: false,
    };

    setTodos((prev) => [newItem, ...prev]);
    setNewTitle('');
    setIsAdding(false);
  };

  // Save edited todo
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editTitle.trim()) return;

    setTodos((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? { ...item, title: editTitle.trim(), frequency: editFrequency }
          : item,
      ),
    );
    setEditingId(null);
    setActiveMenuId(null);
    setSwipedId(null);
  };

  // Delete todo
  const handleDelete = (id: string) => {
    setTodos((prev) => prev.filter((item) => item.id !== id));
    if (activeMenuId === id) setActiveMenuId(null);
    if (swipedId === id) setSwipedId(null);
  };

  // Start editing
  const startEditing = (item: TodoItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditFrequency(item.frequency);
    setActiveMenuId(null);
    setSwipedId(null);
  };

  // Gesture handlers supporting both real touch and pointer/mouse drag
  const handleGestureStart = (clientX: number, clientY = 0) => {
    gestureStartX.current = clientX;
    gestureStartY.current = clientY ?? 0;
    isGestureActive.current = true;
  };

  const handleGestureMove = (clientX: number, clientY = 0, id: string) => {
    if (!isGestureActive.current) return;
    const diffX = clientX - gestureStartX.current;
    const diffY = (clientY ?? 0) - gestureStartY.current;

    // Horizontal movement must dominate vertical scrolling
    if (Math.abs(diffX) >= Math.abs(diffY)) {
      if (diffX < -25) {
        // Swiped left: reveal actions
        setSwipedId(id);
      } else if (diffX > 25) {
        // Swiped right: hide actions
        setSwipedId((prev) => (prev === id ? null : prev));
      }
    }
  };

  const handleGestureEnd = () => {
    isGestureActive.current = false;
  };

  // Filtered todos
  const filteredTodos = todos.filter((item) => {
    if (filter === 'daily') return item.frequency === 'daily';
    if (filter === 'once') return item.frequency === 'once';
    return true;
  });

  const completedCount = todos.filter(isItemCompleted).length;
  const progressPercent = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return (
    <div
      className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden flex flex-col w-full"
      data-testid="tasks-side-todo-panel"
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border/80 flex items-center justify-between gap-3 bg-surface-raised/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-text font-display flex items-center gap-2">
              To-Do List
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary-soft text-primary-deep">
                {todos.length}
              </span>
            </h2>
            <p className="text-[11px] text-text-muted">Daily checklist &amp; quick tasks</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
          }}
          className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-primary-deep text-white hover:bg-primary-ink shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
          data-testid="add-todo-btn"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span>Add</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5 border-b border-border/60 bg-surface">
        {(['all', 'daily', 'once'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            data-testid={`filter-btn-${mode}`}
            onClick={() => setFilter(mode)}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
              filter === mode
                ? 'bg-primary-deep text-white font-semibold shadow-xs'
                : 'text-text-muted hover:text-text hover:bg-surface-muted'
            }`}
          >
            {mode === 'all' ? 'All' : mode === 'daily' ? 'Daily' : 'Once'}
          </button>
        ))}
      </div>

      {/* Add New Form Inline */}
      {isAdding && (
        <form
          onSubmit={handleAddTodo}
          className="p-3.5 bg-primary-soft/30 border-b border-primary/20 space-y-3 animate-crm-fade-up"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="What needs to be done?"
            autoFocus
            className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            data-testid="input-new-todo-title"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 text-xs">
              <button
                type="button"
                data-testid="add-freq-daily"
                onClick={() => setNewFrequency('daily')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  newFrequency === 'daily'
                    ? 'bg-primary-deep text-white font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                data-testid="add-freq-once"
                onClick={() => setNewFrequency('once')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  newFrequency === 'once'
                    ? 'bg-primary-deep text-white font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Once
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                }}
                className="px-2.5 py-1 text-xs rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-new-todo-btn"
                disabled={!newTitle.trim()}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Form Inline */}
      {editingId && (
        <form
          onSubmit={handleSaveEdit}
          className="p-3.5 bg-amber-50/50 border-b border-amber-200/50 space-y-3 animate-crm-fade-up"
        >
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            data-testid="input-edit-todo-title"
            className="w-full text-xs rounded-lg border border-border bg-surface px-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 text-xs">
              <button
                type="button"
                data-testid="edit-freq-daily"
                onClick={() => setEditFrequency('daily')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  editFrequency === 'daily'
                    ? 'bg-primary-deep text-white font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                data-testid="edit-freq-once"
                onClick={() => setEditFrequency('once')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  editFrequency === 'once'
                    ? 'bg-primary-deep text-white font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                Once
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="px-2.5 py-1 text-xs rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="save-edit-todo-btn"
                disabled={!editTitle.trim()}
                className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Update
              </button>
            </div>
          </div>
        </form>
      )}

      {/* To-Do Items List */}
      <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
        {filteredTodos.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted">
            <p className="font-semibold text-text">No to-do items</p>
            <p className="text-[11px] mt-1">Add daily habits or one-time tasks above.</p>
          </div>
        ) : (
          filteredTodos.map((item) => {
            const completed = isItemCompleted(item);
            const isSwiped = swipedId === item.id;

            return (
              <div
                key={item.id}
                data-testid={`todo-item-${item.id}`}
                className="relative overflow-hidden group select-none transition-colors"
                onTouchStart={(e) => handleGestureStart(e.touches[0].clientX, e.touches[0].clientY)}
                onTouchMove={(e) => handleGestureMove(e.touches[0].clientX, e.touches[0].clientY, item.id)}
                onTouchEnd={handleGestureEnd}
                onPointerDown={(e) => handleGestureStart(e.clientX, e.clientY)}
                onPointerMove={(e) => handleGestureMove(e.clientX, e.clientY, item.id)}
                onPointerUp={handleGestureEnd}
              >
                {/* Background Action Buttons (Revealed on Swipe Left) */}
                <div
                  className={`absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1.5 z-0 transition-opacity duration-200 ${
                    isSwiped ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(item);
                    }}
                    data-testid={`mobile-edit-btn-${item.id}`}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Edit item"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    data-testid={`mobile-delete-btn-${item.id}`}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Delete item"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>

                {/* Foreground Card Layer */}
                <div
                  data-testid={`swipe-card-${item.id}`}
                  style={{ touchAction: 'pan-y' }}
                  onClick={() => {
                    if (isSwiped) setSwipedId(null);
                  }}
                  className={`relative z-10 flex items-center justify-between p-3.5 bg-surface hover:bg-surface-raised transition-transform duration-200 ease-out cursor-pointer ${
                    isSwiped ? '-translate-x-[155px]' : 'translate-x-0'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    {/* Completion Tick Box */}
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={() => handleToggleComplete(item.id)}
                      data-testid={`checkbox-${item.id}`}
                      className="mt-0.5 h-4 w-4 rounded border-border-strong text-primary-deep focus:ring-primary cursor-pointer shrink-0"
                      aria-label={`Mark ${item.title} as ${completed ? 'incomplete' : 'complete'}`}
                    />

                    <div className="min-w-0">
                      <p
                        data-testid={`todo-title-${item.id}`}
                        className={`text-xs font-medium leading-snug break-words transition-all ${
                          completed
                            ? 'line-through text-text-muted opacity-60'
                            : 'text-text'
                        }`}
                      >
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full uppercase tracking-wider ${
                            item.frequency === 'daily'
                              ? 'bg-primary-soft text-primary-deep border border-primary/20'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.frequency === 'daily' ? 'Daily' : 'Once'}
                        </span>
                        {item.frequency === 'daily' && completed && (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            ✓ Done today
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Desktop / In-Row Actions: 3-Dots or Edit/Delete Logos */}
                  <div className="relative shrink-0 flex items-center">
                    {activeMenuId === item.id ? (
                      <div
                        ref={menuRef}
                        data-testid={`desktop-menu-${item.id}`}
                        className="flex items-center gap-1.5 animate-crm-fade-up shrink-0 bg-surface pl-1"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(item);
                          }}
                          data-testid={`desktop-edit-btn-${item.id}`}
                          className="h-7 px-2 flex items-center gap-1 rounded-lg bg-primary-soft text-primary-deep hover:bg-primary-soft/80 transition-colors cursor-pointer text-xs font-semibold"
                          title="Edit item"
                          aria-label="Edit item"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          data-testid={`desktop-delete-btn-${item.id}`}
                          className="h-7 px-2 flex items-center gap-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer text-xs font-semibold"
                          title="Delete item"
                          aria-label="Delete item"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                          }}
                          className="w-6 h-7 flex items-center justify-center text-text-muted hover:text-text text-xs cursor-pointer font-bold"
                          title="Close"
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(item.id);
                        }}
                        data-testid={`menu-btn-${item.id}`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-muted transition-colors cursor-pointer text-sm font-bold tracking-widest shrink-0"
                        title="Task options"
                        aria-label="Task options"
                      >
                        •••
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Progress Footer */}
      <div className="p-3 bg-surface-muted/60 border-t border-border/70 flex items-center justify-between text-[11px] text-text-muted">
        <span className="font-medium">
          {completedCount} of {todos.length} completed
        </span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-primary-deep transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-bold text-text text-[10px]">{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
}
