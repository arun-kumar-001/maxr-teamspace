import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { TaskPriority, TaskStatus } from '../types';

export interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: 'board' | 'list';
  onViewModeChange: (mode: 'board' | 'list') => void;
  scope: 'mine' | 'team';
  onScopeChange: (scope: 'mine' | 'team') => void;
  showScopeToggle?: boolean;
  priority?: TaskPriority;
  onPriorityChange?: (priority?: TaskPriority) => void;
  status?: TaskStatus;
  onStatusChange?: (status?: TaskStatus) => void;
  overdueOnly: boolean;
  onOverdueOnlyToggle: () => void;
  canCreate?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export function TaskFilters({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  scope,
  onScopeChange,
  showScopeToggle = false,
  priority,
  onPriorityChange,
  overdueOnly,
  onOverdueOnlyToggle,
  canCreate = false,
  onCreateClick,
  className = '',
}: TaskFiltersProps) {
  return (
    <div
      className={`flex flex-col gap-3 p-4 bg-surface rounded-card border border-border shadow-card ${className}`}
      data-testid="task-filters"
    >
      {/* Row 1 (Image 5): Search on Left, View Mode Toggle on Right */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0 xl:max-w-lg">
          <input
            type="search"
            placeholder="Search tasks by title, project, assignee..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks"
            className="w-full px-3.5 py-2 pl-3.5 text-xs sm:text-sm bg-surface-raised border border-border rounded-xl text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-strong transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto min-w-0 max-w-full">
          {/* Scope Toggle (My Tasks vs Team Tasks) */}
          {showScopeToggle && (
            <div className="max-w-full">
              <SegmentedControl
                ariaLabel="Task Scope"
                options={[
                  { value: 'mine', label: 'My Tasks' },
                  { value: 'team', label: 'Team Tasks' },
                ]}
                value={scope}
                onChange={(val) => onScopeChange(val as 'mine' | 'team')}
              />
            </div>
          )}

          {/* View Mode Toggle: [Kanban Board] [List View] */}
          <div className="max-w-full">
            <SegmentedControl
              ariaLabel="View Mode"
              options={[
                { value: 'board', label: 'Kanban Board' },
                { value: 'list', label: 'List View' },
              ]}
              value={viewMode}
              onChange={(val) => onViewModeChange(val as 'board' | 'list')}
            />
          </div>
        </div>
      </div>

      {/* Row 2 (Image 5 & 6): Priority Dropdown & Overdue Toggle on Left, Add Task Button on Right */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Left: All Priorities & Overdue Only */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* All Priorities Dropdown */}
          <div className="relative inline-block">
            <select
              aria-label="Filter by priority"
              value={priority || ''}
              onChange={(e) =>
                onPriorityChange?.(e.target.value ? (e.target.value as TaskPriority) : undefined)
              }
              className="appearance-none px-3.5 py-2 pr-8 text-xs font-semibold bg-surface border border-border rounded-xl text-text hover:bg-surface-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-strong"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-text-muted">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>

          {/* Overdue Only Filter Pill (Image 6) */}
          <button
            type="button"
            onClick={onOverdueOnlyToggle}
            aria-pressed={overdueOnly}
            data-testid="overdue-filter-toggle"
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all ${
              overdueOnly
                ? 'bg-rose-50 text-danger border-rose-300 ring-1 ring-danger'
                : 'bg-surface text-text hover:bg-surface-muted border-border'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${overdueOnly ? 'bg-danger' : 'bg-text-subtle'}`}
              aria-hidden="true"
            />
            <span>Overdue Only</span>
          </button>
        </div>

        {/* Right: + Add Task Button (Image 5) */}
        {canCreate && onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            data-testid="create-task-btn"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-text font-bold text-xs sm:text-sm hover:bg-primary-strong hover:text-white transition-all shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>Add Task</span>
          </button>
        )}
      </div>
    </div>
  );
}
