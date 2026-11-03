import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
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
  onPriorityChange: (priority?: TaskPriority) => void;
  status?: TaskStatus;
  onStatusChange: (status?: TaskStatus) => void;
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
  status,
  onStatusChange,
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
      {/* Top Row: Search & Action Buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Input
            type="search"
            placeholder="Search tasks by title, project, assignee..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search tasks"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Scope Toggle (My Tasks vs Team Tasks) */}
          {showScopeToggle && (
            <div className="w-full sm:w-auto">
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

          {/* View Mode Toggle (Board vs List) */}
          <div className="w-full sm:w-auto">
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

          {/* Create Task Button */}
          {canCreate && onCreateClick && (
            <Button
              variant="primary"
              onClick={onCreateClick}
              className="w-full sm:w-auto min-h-[44px]"
              data-testid="create-task-btn"
            >
              <span className="flex items-center gap-1.5">
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
                    strokeWidth="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Task
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Second Row: Specific Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-border flex-wrap">
        {/* Priority Filter */}
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by priority"
            value={priority || ''}
            onChange={(e) =>
              onPriorityChange(e.target.value ? (e.target.value as TaskPriority) : undefined)
            }
            options={[
              { value: '', label: 'All Priorities' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>

        {/* Status Filter (especially useful in List View) */}
        {viewMode === 'list' && (
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by status"
              value={status || ''}
              onChange={(e) =>
                onStatusChange(e.target.value ? (e.target.value as TaskStatus) : undefined)
              }
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'todo', label: 'To Do' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'in_review', label: 'In Review' },
                { value: 'blocked', label: 'Blocked' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        )}

        {/* Overdue Only Filter */}
        <button
          type="button"
          onClick={onOverdueOnlyToggle}
          aria-pressed={overdueOnly}
          data-testid="overdue-filter-toggle"
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors min-h-[44px] ${
            overdueOnly
              ? 'bg-rose-50 text-danger border-rose-300 ring-1 ring-danger'
              : 'bg-surface-muted text-text-muted border-border hover:bg-surface-raised'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${overdueOnly ? 'bg-danger' : 'bg-text-subtle'}`}
            aria-hidden="true"
          />
          Overdue Only
        </button>
      </div>
    </div>
  );
}
