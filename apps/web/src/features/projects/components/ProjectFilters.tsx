import { PrimaryActionButton } from '../../../components/ui';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type {
  ProjectPriority,
  ProjectSortOption,
  ProjectStatus,
  ProjectWorkflowStatus,
} from '../types';
import type { ProjectLifecycleStage } from './ProjectCard';

export type ProjectStageFilter = 'all' | ProjectLifecycleStage;

export interface ProjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: ProjectStatus;
  onStatusChange?: (status?: ProjectStatus) => void;
  workflowStatus?: ProjectWorkflowStatus;
  onWorkflowStatusChange?: (status?: ProjectWorkflowStatus) => void;
  priority?: ProjectPriority;
  onPriorityChange?: (priority?: ProjectPriority) => void;
  sort?: ProjectSortOption;
  onSortChange?: (sort: ProjectSortOption) => void;
  stage?: ProjectStageFilter;
  onStageChange?: (stage: ProjectStageFilter) => void;
  viewMode?: 'cards' | 'table';
  onViewModeChange?: (mode: 'cards' | 'table') => void;
  counts?: {
    all: number;
    active?: number;
    archived?: number;
    in_process?: number;
    inProgress?: number;
    completed?: number;
    waiting?: number;
    delivered?: number;
  };
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
  stage,
  onStageChange,
  viewMode = 'cards',
  onViewModeChange,
  counts,
  canCreate = false,
  onCreateClick,
  className = '',
}: ProjectFiltersProps) {
  const usesStageMode = Boolean(onStageChange);

  const stageValue = stage ?? 'all';
  const statusSegment =
    workflowStatus === 'completed'
      ? 'completed'
      : status === 'archived'
        ? 'archived'
        : workflowStatus === 'in_progress' || status === 'active'
          ? 'in_progress'
          : 'all';

  const handleSegmentChange = (val: string) => {
    if (onStageChange) {
      onStageChange(val as ProjectStageFilter);
      return;
    }
    if (val === 'in_progress') {
      onStatusChange?.('active');
      onWorkflowStatusChange?.('in_progress');
    } else if (val === 'completed') {
      onStatusChange?.('active');
      onWorkflowStatusChange?.('completed');
    } else if (val === 'archived') {
      onStatusChange?.('archived');
      onWorkflowStatusChange?.(undefined);
    } else {
      onStatusChange?.(undefined);
      onWorkflowStatusChange?.(undefined);
    }
  };

  return (
    <div
      className={`flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 ${className}`}
      data-testid="project-filters"
    >
      <div className="w-full sm:w-auto overflow-x-auto">
        <SegmentedControl
          ariaLabel="Filter projects by status"
          options={
            usesStageMode
              ? [
                  {
                    value: 'all',
                    label: counts ? `All (${counts.all})` : 'All',
                  },
                  {
                    value: 'in_process',
                    label:
                      counts?.in_process !== undefined
                        ? `In Process (${counts.in_process})`
                        : 'In Process',
                  },
                  {
                    value: 'waiting',
                    label:
                      counts?.waiting !== undefined ? `Waiting (${counts.waiting})` : 'Waiting',
                  },
                  {
                    value: 'delivered',
                    label:
                      counts?.delivered !== undefined
                        ? `Delivered (${counts.delivered})`
                        : 'Delivered',
                  },
                ]
              : [
                  {
                    value: 'all',
                    label: counts ? `All (${counts.all})` : 'All',
                  },
                  {
                    value: 'in_progress',
                    label:
                      counts?.inProgress !== undefined
                        ? `In Progress (${counts.inProgress})`
                        : counts?.in_process !== undefined
                          ? `In Progress (${counts.in_process})`
                          : counts?.active !== undefined
                            ? `In Progress (${counts.active})`
                            : 'In Progress',
                  },
                  {
                    value: 'completed',
                    label:
                      counts?.completed !== undefined
                        ? `Completed (${counts.completed})`
                        : counts?.delivered !== undefined
                          ? `Completed (${counts.delivered})`
                          : 'Completed',
                  },
                  {
                    value: 'archived',
                    label:
                      counts?.archived !== undefined ? `Archived (${counts.archived})` : 'Archived',
                  },
                ]
          }
          value={usesStageMode ? stageValue : statusSegment}
          onChange={handleSegmentChange}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap justify-end">
        <div className="w-full sm:w-64">
          <Input
            type="search"
            placeholder="Search projects by name or code..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search projects by name or code"
          />
        </div>

        {onViewModeChange && (
          <div
            className="inline-flex items-center p-1 rounded-control bg-surface-muted border border-border self-start sm:self-auto"
            role="group"
            aria-label="Project layout view"
          >
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              aria-pressed={viewMode === 'cards'}
              data-testid="view-grid-btn"
              className={`px-3 py-1.5 text-xs font-semibold rounded-input transition-colors inline-flex items-center gap-1.5 min-h-[34px] ${
                viewMode === 'cards'
                  ? 'bg-surface text-text shadow-card'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              aria-pressed={viewMode === 'table'}
              data-testid="view-list-btn"
              className={`px-3 py-1.5 text-xs font-semibold rounded-input transition-colors inline-flex items-center gap-1.5 min-h-[34px] ${
                viewMode === 'table'
                  ? 'bg-surface text-text shadow-card'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Table
            </button>
          </div>
        )}

        {canCreate && onCreateClick && (
          <div className="shrink-0 flex items-center">
            <PrimaryActionButton
              type="button"
              onClick={onCreateClick}
              data-testid="create-project-btn"
            >
              Create Project
            </PrimaryActionButton>
          </div>
        )}
      </div>

      {/* Row 2: Workflow Status, Priority & Deadline Sort */}
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
