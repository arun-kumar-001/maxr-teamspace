import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import type {
  ProjectPriority,
  ProjectSortOption,
  ProjectStatus,
  ProjectWorkflowStatus,
} from '../types';

export interface ProjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: ProjectStatus;
  onStatusChange: (status?: ProjectStatus) => void;
  workflowStatus?: ProjectWorkflowStatus;
  onWorkflowStatusChange?: (status?: ProjectWorkflowStatus) => void;
  priority?: ProjectPriority;
  onPriorityChange?: (priority?: ProjectPriority) => void;
  sort?: ProjectSortOption;
  onSortChange?: (sort: ProjectSortOption) => void;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
  canCreate?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export function ProjectFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  workflowStatus,
  onWorkflowStatusChange,
  priority,
  onPriorityChange,
  sort = 'name',
  onSortChange,
  viewMode = 'grid',
  onViewModeChange,
  canCreate = false,
  onCreateClick,
  className = '',
}: ProjectFiltersProps) {
  const currentSegment = status || 'all';

  const handleSegmentChange = (value: string) => {
    if (value === 'all') {
      onStatusChange(undefined);
    } else {
      onStatusChange(value as ProjectStatus);
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 p-4 border rounded-[20px] ${className}`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'rgba(255, 255, 255, 0.8)',
        boxShadow: '0 8px 24px rgba(85, 205, 179, 0.06), 0 2px 6px rgba(8, 11, 12, 0.03)',
      }}
      data-testid="project-filters"
    >
      {/* Row 1: Search, Lifecycle Scope, Create Action */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="w-full sm:w-80">
            <Input
              type="search"
              placeholder="Search projects by name or code..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search projects by name or code"
            />
          </div>

          <div className="w-full sm:w-auto overflow-x-auto">
            <SegmentedControl
              ariaLabel="Filter projects by lifecycle"
              options={[
                { value: 'all', label: 'All Projects' },
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={currentSegment}
              onChange={handleSegmentChange}
            />
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {onViewModeChange && (
            <div
              className="inline-flex items-center p-1 rounded-xl border border-border bg-surface-muted"
              role="group"
              aria-label="View layout"
            >
              <button
                type="button"
                onClick={() => onViewModeChange('grid')}
                aria-pressed={viewMode === 'grid'}
                data-testid="view-grid-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
                style={
                  viewMode === 'grid'
                    ? { backgroundColor: 'rgb(85, 205, 179)', color: 'rgb(8, 11, 12)' }
                    : { color: 'rgb(79, 92, 90)' }
                }
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Grid
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                aria-pressed={viewMode === 'list'}
                data-testid="view-list-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[36px]"
                style={
                  viewMode === 'list'
                    ? { backgroundColor: 'rgb(85, 205, 179)', color: 'rgb(8, 11, 12)' }
                    : { color: 'rgb(79, 92, 90)' }
                }
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                List
              </button>
            </div>
          )}

          {canCreate && onCreateClick && (
            <Button
              variant="primary"
              onClick={onCreateClick}
              className="w-full sm:w-auto"
              data-testid="create-project-btn"
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
                Create Project
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Row 2: Project Status, Priority & Deadline Sort */}
      {(onWorkflowStatusChange || onPriorityChange || onSortChange) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/70">
          {onWorkflowStatusChange && (
            <div>
              <label
                htmlFor="filter-workflow-status"
                className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-1"
              >
                Project Status
              </label>
              <Select
                id="filter-workflow-status"
                aria-label="Filter by project status"
                value={workflowStatus ?? ''}
                onChange={(e) =>
                  onWorkflowStatusChange(
                    e.target.value ? (e.target.value as ProjectWorkflowStatus) : undefined,
                  )
                }
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'not_started', label: 'Not Started' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'on_hold', label: 'On Hold' },
                  { value: 'completed', label: 'Completed' },
                ]}
              />
            </div>
          )}

          {onPriorityChange && (
            <div>
              <label
                htmlFor="filter-priority"
                className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-1"
              >
                Priority
              </label>
              <Select
                id="filter-priority"
                aria-label="Filter by priority"
                value={priority ?? ''}
                onChange={(e) =>
                  onPriorityChange(e.target.value ? (e.target.value as ProjectPriority) : undefined)
                }
                options={[
                  { value: '', label: 'All Priorities' },
                  { value: 'high', label: 'High Priority' },
                  { value: 'medium', label: 'Medium Priority' },
                  { value: 'low', label: 'Low Priority' },
                ]}
              />
            </div>
          )}

          {onSortChange && (
            <div>
              <label
                htmlFor="filter-sort-deadline"
                className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle mb-1"
              >
                Sort Order
              </label>
              <Select
                id="filter-sort-deadline"
                aria-label="Sort projects"
                value={sort}
                onChange={(e) => onSortChange(e.target.value as ProjectSortOption)}
                options={[
                  { value: 'name', label: 'Name (A–Z)' },
                  { value: 'deadline_asc', label: 'Deadline (Soonest first)' },
                  { value: 'deadline_desc', label: 'Deadline (Latest first)' },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
