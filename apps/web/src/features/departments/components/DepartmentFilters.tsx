import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';

export interface DepartmentFiltersProps {
  search?: string;
  statusFilter: string; // "" | "true" | "false"
  onSearchChange?: (search: string) => void;
  onStatusChange: (status: string) => void;
  onReset: () => void;
}

export function DepartmentFilters({
  statusFilter,
  onStatusChange,
  onReset,
}: DepartmentFiltersProps) {
  const hasActiveFilters = Boolean(statusFilter);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  return (
    <div
      className="flex items-center justify-end gap-2 w-full"
      data-testid="department-filters"
    >
      {/* Compact Status Select */}
      <div className="w-32 sm:w-36 shrink-0">
        <Select
          id="department-status-select"
          aria-label="Filter by Status"
          name="status"
          options={statusOptions}
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="!min-h-[34px] h-[34px] py-1 px-2.5 text-xs bg-surface rounded-xl border border-border shadow-xs"
          data-testid="department-status-select"
        />
      </div>

      {/* Clear Button if status is filtered */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="!min-h-[34px] h-[34px] px-2 text-xs font-semibold text-text-muted hover:text-text shrink-0"
          data-testid="department-filters-reset"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
