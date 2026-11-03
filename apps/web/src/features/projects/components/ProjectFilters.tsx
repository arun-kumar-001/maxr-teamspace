import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import type { ProjectStatus } from '../types';

export interface ProjectFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status?: ProjectStatus;
  onStatusChange: (status?: ProjectStatus) => void;
  canCreate?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export function ProjectFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
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
      className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${className}`}
      data-testid="project-filters"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
        <div className="w-full sm:w-72">
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
            ariaLabel="Filter projects by status"
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

      {canCreate && onCreateClick && (
        <div className="shrink-0 flex items-center">
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
        </div>
      )}
    </div>
  );
}
