import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import {
  getSidebarTodos,
  getSidebarTodoStats,
  isTodoCompletedToday,
  toggleSidebarTodo,
  addSidebarTodo,
  updateSidebarTodo,
  deleteSidebarTodo,
  type TodoItemData,
  TODOS_UPDATED_EVENT,
} from '../features/tasks/utils/todoStats';

export interface PersonalChecklistWidgetProps {
  className?: string;
  onNavigate?: (path: string) => void;
}

export function PersonalChecklistWidget({
  className = '',
  onNavigate,
}: PersonalChecklistWidgetProps) {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const [todos, setTodos] = useState<TodoItemData[]>(() => getSidebarTodos());
  const [stats, setStats] = useState(() => getSidebarTodoStats());
  const [filter, setFilter] = useState<'all' | 'daily' | 'once'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'once'>('daily');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'once'>('daily');

  useEffect(() => {
    const handleUpdate = () => {
      setTodos(getSidebarTodos());
      setStats(getSidebarTodoStats());
    };
    window.addEventListener(TODOS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, handleUpdate);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredTodos = todos.filter((item) => {
    if (filter === 'daily') return item.frequency === 'daily';
    if (filter === 'once') return item.frequency === 'once';
    return true;
  });

  const handleToggle = (id: string) => {
    toggleSidebarTodo(id);
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addSidebarTodo(newTitle.trim(), newFrequency);
    setNewTitle('');
    setIsAdding(false);
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSidebarTodo(id);
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
  };

  const handleStartEdit = (item: TodoItemData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditFrequency(item.frequency);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editTitle.trim()) return;
    updateSidebarTodo(id, { title: editTitle.trim(), frequency: editFrequency });
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
    setEditingId(null);
    setEditTitle('');
  };

  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div
      data-testid="personal-checklist-widget"
      className={`p-4 sm:p-5 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card flex flex-col justify-between h-full min-w-0 transition-all duration-200 hover:border-border ${className}`}
    >
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      user?.role === ROLES.STAFF
                        ? '/staff/personal-checklist'
                        : '/personal-checklist';
                    if (onNavigate) {
                      onNavigate(target);
                    } else if (typeof window !== 'undefined') {
                      window.location.href = target;
                    }
                  }}
                  className="text-sm font-bold text-text truncate hover:text-primary-deep text-left cursor-pointer transition-colors"
                  title="Open Personal Checklist Page"
                >
                  Personal Checklist
                </button>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-soft text-primary-deep shrink-0">
                  {stats.completed}/{stats.total}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding((prev) => !prev)}
            data-testid="widget-add-checklist-btn"
            className="px-2 py-1 text-xs font-semibold rounded-lg bg-primary-deep text-white hover:bg-primary-ink shadow-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>Add</span>
          </button>
        </div>

        {/* 2. Filter Tabs */}
        <div className="flex items-center gap-1 mt-3 mb-2 border-b border-border/60 pb-2">
          {(['all', 'daily', 'once'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              data-testid={`widget-filter-${tab}`}
              className={`px-2 py-0.5 text-[11px] font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-primary-deep text-white shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-muted'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* 3. Add Form Inline */}
        {isAdding && (
          <form
            onSubmit={handleAdd}
            className="p-2.5 mb-2 bg-primary-soft/40 border border-primary/20 rounded-xl space-y-2 animate-fadeIn"
            data-testid="widget-add-todo-form"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What routine item to add?"
              autoFocus
              className="w-full text-xs rounded-lg border border-border bg-white px-2.5 py-1.5 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              data-testid="widget-new-todo-input"
            />
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 bg-surface border border-border rounded-md p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setNewFrequency('daily')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    newFrequency === 'daily'
                      ? 'bg-primary-deep text-white font-bold'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setNewFrequency('once')}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors ${
                    newFrequency === 'once'
                      ? 'bg-primary-deep text-white font-bold'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Once
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTitle('');
                  }}
                  className="px-2 py-0.5 text-[11px] rounded border border-border text-text-muted hover:bg-surface-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  data-testid="widget-save-todo-btn"
                  className="px-2.5 py-0.5 text-[11px] font-semibold rounded bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        )}

        {/* 4. Checklist Items */}
        <div className="space-y-1.5 my-1.5 max-h-52 overflow-y-auto pr-1">
          {filteredTodos.length === 0 ? (
            <div className="py-6 text-center text-xs text-text-subtle">No checklist items yet</div>
          ) : (
            filteredTodos.map((item) => {
              const completed = isTodoCompletedToday(item, todayStr);
              const isEditing = editingId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    data-testid={`widget-todo-item-${item.id}`}
                    className="p-2 rounded-xl bg-surface border border-primary-strong/50 space-y-1.5 text-xs"
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Checklist title..."
                      data-testid={`widget-edit-input-${item.id}`}
                      autoFocus
                      className="w-full px-2 py-1 text-xs bg-white border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary-strong"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id, e);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditFrequency('daily')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                            editFrequency === 'daily'
                              ? 'bg-primary-deep text-white'
                              : 'text-text-muted hover:text-text bg-surface-muted'
                          }`}
                        >
                          Daily
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditFrequency('once')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold cursor-pointer ${
                            editFrequency === 'once'
                              ? 'bg-primary-deep text-white'
                              : 'text-text-muted hover:text-text bg-surface-muted'
                          }`}
                        >
                          Once
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-2 py-0.5 text-[10px] rounded border border-border text-text-muted hover:bg-surface-muted cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleSaveEdit(item.id, e)}
                          disabled={!editTitle.trim()}
                          data-testid={`widget-save-edit-btn-${item.id}`}
                          className="px-2 py-0.5 text-[10px] font-semibold rounded bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggle(item.id)}
                  data-testid={`widget-todo-item-${item.id}`}
                  className="flex items-center justify-between gap-2 p-1.5 sm:p-2 rounded-xl transition-all duration-150 hover:bg-surface-raised border border-transparent hover:border-border/60 text-xs min-w-0 cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button type="button" aria-label={`Toggle ${item.title}`} className="shrink-0">
                      {completed ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                          ✓
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-border-strong group-hover:border-primary-deep transition-colors" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`font-semibold truncate leading-tight transition-colors ${
                          completed ? 'line-through text-text-muted' : 'text-text'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-[10px] text-text-muted capitalize">
                        {item.frequency === 'daily' ? 'Daily habit' : 'One-time'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleStartEdit(item, e)}
                      data-testid={`widget-edit-btn-${item.id}`}
                      aria-label={`Edit ${item.title}`}
                      className="opacity-0 group-hover:opacity-100 hover:text-primary-deep text-text-muted p-1 transition-opacity shrink-0 cursor-pointer"
                      title="Edit item"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      data-testid={`widget-delete-btn-${item.id}`}
                      aria-label={`Delete ${item.title}`}
                      className="opacity-0 group-hover:opacity-100 hover:text-danger text-text-muted p-1 transition-opacity shrink-0 cursor-pointer"
                      title="Delete item"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Footer Progress & Page Link */}
      <div className="pt-2.5 mt-2 border-t border-border/80 text-[11px] text-text-muted flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="h-1.5 flex-1 bg-surface-muted rounded-full overflow-hidden border border-border/40">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="font-mono font-bold text-text shrink-0">{pct}%</span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">
            {stats.completed} of {stats.total} completed
          </span>
          <button
            type="button"
            onClick={() => {
              const target =
                user?.role === ROLES.STAFF ? '/staff/personal-checklist' : '/personal-checklist';
              if (onNavigate) {
                onNavigate(target);
              } else if (typeof window !== 'undefined') {
                window.location.href = target;
              }
            }}
            data-testid="widget-view-checklist-link"
            className="text-primary-ink hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <span>Personal Checklist Page</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
}
