import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { ProjectStatus } from '../types';
import type { ProjectLifecycleStage } from './ProjectCard';

export type ProjectStageFilter = 'all' | ProjectLifecycleStage;

export interface ProjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: ProjectStatus;
  onStatusChange?: (status?: ProjectStatus) => void;
  stage?: ProjectStageFilter;
  onStageChange?: (stage: ProjectStageFilter) => void;
  viewMode?: 'cards' | 'table';
  onViewModeChange?: (mode: 'cards' | 'table') => void;
  counts?: {
    all: number;
    active?: number;
    archived?: number;
    in_process?: number;
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
  const statusSegment = status || 'all';

  const handleSegmentChange = (val: string) => {
    if (onStageChange) {
      onStageChange(val as ProjectStageFilter);
      return;
    }
    if (onStatusChange) {
      onStatusChange(val === 'all' ? undefined : (val as ProjectStatus));
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
                    value: 'active',
                    label:
                      counts?.active !== undefined ? `In Process (${counts.active})` : 'In Process',
                  },
                  {
                    value: 'archived',
                    label:
                      counts?.archived !== undefined
                        ? `Delivered (${counts.archived})`
                        : 'Delivered',
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
              data-testid="projects-view-cards"
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
              data-testid="projects-view-table"
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
            <Button
              variant="primary"
              onClick={onCreateClick}
              className="w-full sm:w-auto"
              data-testid="create-project-btn"
            >
              Create Project
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
