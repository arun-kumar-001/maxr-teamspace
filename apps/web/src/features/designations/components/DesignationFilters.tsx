import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { DepartmentOption } from '../types';

export interface DesignationFiltersProps {
  search: string;
  departmentId: string;
  statusFilter: string; // "" | "true" | "false"
  departments: DepartmentOption[];
  onSearchChange: (search: string) => void;
  onDepartmentChange: (departmentId: string) => void;
  onStatusChange: (status: string) => void;
  onReset: () => void;
}

export function DesignationFilters({
  search,
  departmentId,
  statusFilter,
  departments,
  onSearchChange,
  onDepartmentChange,
  onStatusChange,
  onReset,
}: DesignationFiltersProps) {
  const hasActiveFilters = Boolean(search || departmentId || statusFilter);

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map((d) => ({
      value: d.id,
      label: `${d.name} (${d.code})`,
    })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="designation-filters"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        {/* Search Input */}
        <div>
          <label
            htmlFor="designation-search-input"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Search
          </label>
          <Input
            id="designation-search-input"
            name="search"
            placeholder="Search by title or code..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="designation-search-input"
          />
        </div>

        {/* Department Select */}
        <div>
          <label
            htmlFor="designation-dept-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Department
          </label>
          <Select
            id="designation-dept-filter"
            aria-label="Filter by Department"
            name="departmentId"
            options={departmentOptions}
            value={departmentId}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="designation-department-select"
          />
        </div>

        {/* Status Select */}
        <div>
          <label
            htmlFor="designation-status-select"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Status
          </label>
          <Select
            id="designation-status-select"
            aria-label="Filter by Status"
            name="status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="designation-status-select"
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
              data-testid="designation-filters-reset"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
