import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

export interface DepartmentFiltersProps {
  search: string;
  statusFilter: string; // "" | "true" | "false"
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
  onReset: () => void;
}

export function DepartmentFilters({
  search,
  statusFilter,
  onSearchChange,
  onStatusChange,
  onReset,
}: DepartmentFiltersProps) {
  const hasActiveFilters = Boolean(search || statusFilter);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="department-filters"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        {/* Search Input */}
        <div>
          <label
            htmlFor="department-search-input"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Search
          </label>
          <Input
            id="department-search-input"
            name="search"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="department-search-input"
          />
        </div>

        {/* Status Select */}
        <div>
          <label
            htmlFor="department-status-select"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Status
          </label>
          <Select
            id="department-status-select"
            aria-label="Filter by Status"
            name="status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="department-status-select"
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="flex sm:justify-start">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="min-h-[44px] text-xs font-semibold"
              data-testid="department-filters-reset"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
