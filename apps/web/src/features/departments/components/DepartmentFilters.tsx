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
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
      data-testid="department-filters"
    >
      {/* Search Input on the Left */}
      <div className="relative flex-1 max-w-sm">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-subtle">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <Input
          id="department-search-input"
          name="search"
          placeholder="Search by name or code..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 min-h-[42px] text-xs sm:text-sm bg-surface rounded-xl border border-border shadow-xs"
          data-testid="department-search-input"
        />
      </div>

      {/* Right Side: Status Select + Clear Button */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <div className="w-40 sm:w-48">
          <Select
            id="department-status-select"
            aria-label="Filter by Status"
            name="status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="min-h-[42px] text-xs sm:text-sm bg-surface rounded-xl border border-border shadow-xs"
            data-testid="department-status-select"
          />
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="min-h-[42px] text-xs font-semibold text-text-muted hover:text-text"
            data-testid="department-filters-reset"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
