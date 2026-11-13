import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import type { TaskPriority, TaskStatus } from '../types';

export interface AssigneeOption {
  id: string;
  name: string;
}

export interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: 'board' | 'list' | 'assigned';
  onViewModeChange: (mode: 'board' | 'list' | 'assigned') => void;
  scope: 'mine' | 'team';
  onScopeChange: (scope: 'mine' | 'team') => void;
  showScopeToggle?: boolean;
  priority?: TaskPriority;
  onPriorityChange: (priority?: TaskPriority) => void;
  status?: TaskStatus;
  onStatusChange: (status?: TaskStatus) => void;
  overdueOnly: boolean;
  onOverdueOnlyToggle: () => void;
  assignees?: AssigneeOption[];
  selectedAssigneeId?: string;
  onAssigneeSelect?: (assigneeId?: string) => void;
  counts?: {
    board: number;
    assigned: number;
  };
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
  assignees = [],
  selectedAssigneeId,
  onAssigneeSelect,
  counts,
  canCreate = false,
  onCreateClick,
  className = '',
}: TaskFiltersProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="task-filters">
      {/* Top Underline Tabs + Scope Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-2">
        <div
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto"
          role="tablist"
          aria-label="Tasks view mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'board'}
            onClick={() => onViewModeChange('board')}
            data-testid="tab-view-board"
            className={`px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 min-h-[40px] ${
              viewMode === 'board'
                ? 'border-primary-strong text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <span>Kanban Board</span>
            {counts && (
              <span className="px-1.5 py-0.5 rounded-full bg-surface-muted border border-border text-[11px] text-text-muted tabular-nums">
                {counts.board}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
            data-testid="tab-view-list"
            className={`px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 min-h-[40px] ${
              viewMode === 'list'
                ? 'border-primary-strong text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <span>List View</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'assigned'}
            onClick={() => onViewModeChange('assigned')}
            data-testid="tab-view-assigned"
            className={`px-3 py-2 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap inline-flex items-center gap-1.5 min-h-[40px] ${
              viewMode === 'assigned'
                ? 'border-primary-strong text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <span>Assigned to me</span>
            {counts && (
              <span className="px-1.5 py-0.5 rounded-full bg-surface-muted border border-border text-[11px] text-text-muted tabular-nums">
                {counts.assigned}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {showScopeToggle && (
            <SegmentedControl
              ariaLabel="Task Scope"
              options={[
                { value: 'mine', label: 'My Tasks' },
                { value: 'team', label: 'Team Tasks' },
              ]}
              value={scope}
              onChange={(val) => onScopeChange(val as 'mine' | 'team')}
            />
          )}

          {canCreate && onCreateClick && (
            <Button
              variant="primary"
              onClick={onCreateClick}
              className="min-h-[40px]"
              data-testid="create-task-btn"
            >
              + New Task
            </Button>
          )}
        </div>
      </div>

      {/* Filter Row: Search + Assignee Pills + Priority/Status/Overdue */}
      {viewMode !== 'assigned' && (
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 flex-wrap">
            <div className="w-full sm:w-64">
              <Input
                type="search"
                placeholder="Search tasks by title, project, assignee..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                aria-label="Search tasks"
              />
            </div>

            {onAssigneeSelect && assignees.length > 0 && (
              <div
                className="flex items-center gap-1.5 overflow-x-auto py-0.5"
                role="group"
                aria-label="Team member filter"
              >
                <button
                  type="button"
                  onClick={() => onAssigneeSelect(undefined)}
                  aria-pressed={!selectedAssigneeId}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0 min-h-[34px] ${
                    !selectedAssigneeId
                      ? 'bg-sidebar text-sidebar-strong border-sidebar'
                      : 'bg-surface text-text-muted border-border hover:bg-surface-muted hover:text-text'
                  }`}
                >
                  Everyone
                </button>
                {assignees.map((person) => {
                  const active = selectedAssigneeId === person.id;
                  const firstName = person.name.split(' ')[0] || person.name;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onAssigneeSelect(active ? undefined : person.id)}
                      aria-pressed={active}
                      title={person.name}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors shrink-0 min-h-[34px] ${
                        active
                          ? 'bg-sidebar text-sidebar-strong border-sidebar'
                          : 'bg-surface text-text-muted border-border hover:bg-surface-muted hover:text-text'
                      }`}
                    >
                      {firstName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
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

            {viewMode === 'list' && (
              <div className="w-36">
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
                    { value: 'blocked', label: 'Hold' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />
              </div>
            )}

            <button
              type="button"
              onClick={onOverdueOnlyToggle}
              aria-pressed={overdueOnly}
              data-testid="overdue-filter-toggle"
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors min-h-[40px] ${
                overdueOnly
                  ? 'bg-rose-50 text-danger border-rose-300 ring-1 ring-danger'
                  : 'bg-surface text-text-muted border-border hover:bg-surface-muted'
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
      )}
    </div>
  );
}
