import { useEffect, useState } from 'react';
import { Button, Input } from '../../../components/ui';
import { createTodo, deleteTodo, fetchTodos, toggleTodo } from '../api/todosApi';
import type { PersonalTodo } from '../types';

// Clean inline SVG icons (zero third-party icon dependencies)
function IconListTodo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="m3 17 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}

function IconPlus({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconCheckCircle2({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconCircle({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function IconCalendar({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconClock({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTrash2({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconSpinner({ className = 'w-4 h-4 animate-spin' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconChevronLeft({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export interface PersonalTodoListProps {
  className?: string;
  pageSize?: number;
}

export function PersonalTodoList({ className = '', pageSize = 10 }: PersonalTodoListProps) {
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination states
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const limit = pageSize;

  // Form states
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter: 'all' | 'pending' | 'completed'
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadTodos(filter, offset);
  }, [filter, offset]);

  async function loadTodos(currentFilter: 'all' | 'pending' | 'completed', currentOffset: number) {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchTodos({
        completed: currentFilter === 'all' ? undefined : currentFilter === 'completed',
        limit,
        offset: currentOffset,
      });
      setTodos(res.data);
      setTotal(res.meta.total);
      setHasMore(res.meta.hasMore);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load to-dos';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterChange(newFilter: 'all' | 'pending' | 'completed') {
    setFilter(newFilter);
    setOffset(0);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await createTodo({
        title: trimmed,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDueDate('');
      if (offset === 0) {
        await loadTodos(filter, 0);
      } else {
        setOffset(0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add to-do';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      const updated = await toggleTodo(id);
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update to-do';
      setError(msg);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTodo(id);
      // Reload current page or step back if page becomes empty
      if (todos.length === 1 && offset > 0) {
        setOffset((prev) => Math.max(0, prev - limit));
      } else {
        await loadTodos(filter, offset);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete to-do';
      setError(msg);
    }
  }

  const startIdx = total === 0 ? 0 : offset + 1;
  const endIdx = Math.min(offset + limit, total);

  return (
    <div
      className={`bg-surface border border-border rounded-card shadow-card p-6 space-y-5 ${className}`}
      data-testid="personal-todo-widget"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary-surface text-primary">
            <IconListTodo className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text font-display">My Personal To-Dos</h2>
            <p className="text-xs text-text-muted">Private task and reminder checklist</p>
          </div>
          {total > 0 && (
            <span
              className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-accent text-sidebar font-mono"
              data-testid="todo-total-count"
            >
              {total}
            </span>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-surface-muted rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'all'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="todo-filter-all"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('pending')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'pending'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="todo-filter-pending"
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('completed')}
            className={`px-3 py-1 rounded-md transition-colors ${
              filter === 'completed'
                ? 'bg-surface text-text shadow-xs font-semibold'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="todo-filter-done"
          >
            Done
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 text-xs rounded-lg bg-critical-surface text-critical border border-critical/20 flex items-center justify-between"
          data-testid="todo-error-banner"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-bold hover:underline"
            data-testid="todo-error-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Add Form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-center gap-2">
        <div className="flex-1 w-full">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new personal to-do item..."
            className="w-full text-sm"
            disabled={isSubmitting}
            data-testid="todo-title-input"
          />
        </div>
        <div className="w-full sm:w-44 flex items-center gap-1">
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-xs py-1.5"
            disabled={isSubmitting}
            title="Optional Due Date"
            data-testid="todo-due-date-input"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!title.trim() || isSubmitting}
          className="w-full sm:w-auto min-w-[80px] flex items-center justify-center gap-1.5"
          data-testid="todo-add-button"
        >
          {isSubmitting ? (
            <IconSpinner className="w-4 h-4" />
          ) : (
            <>
              <IconPlus className="w-4 h-4" />
              <span>Add</span>
            </>
          )}
        </Button>
      </form>

      {/* To-Do List */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {isLoading ? (
          <div
            className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted"
            data-testid="todo-loading"
          >
            <IconSpinner className="w-6 h-6 text-primary" />
            <p className="text-xs">Loading to-dos...</p>
          </div>
        ) : todos.length === 0 ? (
          <div
            className="py-8 text-center text-text-muted border border-dashed border-border rounded-lg"
            data-testid="todo-empty"
          >
            <IconListTodo className="w-8 h-8 mx-auto mb-2 text-text-muted/60" />
            <p className="text-sm font-medium">
              {filter === 'completed'
                ? 'No completed to-dos yet.'
                : filter === 'pending'
                  ? 'All caught up! No pending to-dos.'
                  : 'No personal to-dos. Add one above!'}
            </p>
          </div>
        ) : (
          todos.map((todo) => {
            const isOverdue =
              todo.dueDate &&
              !todo.isCompleted &&
              new Date(todo.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

            return (
              <div
                key={todo.id}
                data-testid={`todo-item-${todo.id}`}
                className={`group flex items-center justify-between p-3 rounded-lg border transition-all ${
                  todo.isCompleted
                    ? 'bg-surface-muted/50 border-border/60 text-text-muted'
                    : 'bg-surface border-border hover:border-primary/40 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(todo.id)}
                    className="flex-shrink-0 text-text-muted hover:text-primary transition-colors focus:outline-hidden"
                    title={todo.isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                    data-testid={`todo-toggle-${todo.id}`}
                  >
                    {todo.isCompleted ? (
                      <IconCheckCircle2 className="w-5 h-5 text-positive-ink" />
                    ) : (
                      <IconCircle className="w-5 h-5 text-text-muted group-hover:text-primary" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        todo.isCompleted ? 'line-through text-text-muted/70' : 'text-text'
                      }`}
                    >
                      {todo.title}
                    </p>
                    {todo.description && (
                      <p className="text-xs text-text-muted truncate mt-0.5">{todo.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {todo.dueDate && (
                    <div
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-mono ${
                        todo.isCompleted
                          ? 'bg-surface-muted text-text-muted'
                          : isOverdue
                            ? 'bg-critical-surface text-critical font-medium'
                            : 'bg-primary-surface text-primary'
                      }`}
                      title={`Due ${todo.dueDate}`}
                      data-testid={isOverdue ? `todo-overdue-${todo.id}` : undefined}
                    >
                      {isOverdue ? (
                        <IconClock className="w-3 h-3 text-critical" />
                      ) : (
                        <IconCalendar className="w-3 h-3" />
                      )}
                      <span>{todo.dueDate}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(todo.id)}
                    className="p-1 rounded-md text-text-muted hover:text-critical hover:bg-critical-surface transition-colors"
                    title="Delete to-do"
                    data-testid={`todo-delete-${todo.id}`}
                  >
                    <IconTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {total > 0 && (
        <div
          className="flex items-center justify-between pt-2 border-t border-border text-xs text-text-muted"
          data-testid="todo-pagination"
        >
          <span data-testid="todo-pagination-range">
            Showing {startIdx}-{endIdx} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              disabled={offset === 0 || isLoading}
              className="p-1.5 rounded-md border border-border text-text hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
              data-testid="todo-pagination-prev"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + limit)}
              disabled={!hasMore || isLoading}
              className="p-1.5 rounded-md border border-border text-text hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
              data-testid="todo-pagination-next"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
