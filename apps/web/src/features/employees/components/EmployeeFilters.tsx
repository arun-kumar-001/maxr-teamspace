import { Button, Input, Select } from '../../../components/ui';
import type { DepartmentItem, DesignationItem, EmployeeStatus } from '../types';

export interface EmployeeFiltersProps {
  search?: string;
  status?: EmployeeStatus;
  departmentId?: string;
  designationId?: string;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  onSearchChange: (search: string) => void;
  onStatusChange: (status: EmployeeStatus | undefined) => void;
  onDepartmentChange: (departmentId: string | undefined) => void;
  onDesignationChange: (designationId: string | undefined) => void;
  onReset: () => void;
}

export function EmployeeFilters({
  search = '',
  status,
  departmentId,
  designationId,
  departments,
  designations,
  onSearchChange,
  onStatusChange,
  onDepartmentChange,
  onDesignationChange,
  onReset,
}: EmployeeFiltersProps) {
  const hasActiveFilters = Boolean(search || status || departmentId || designationId);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending Onboarding' },
    { value: 'deactivated', label: 'Deactivated' },
  ];

  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
  ];

  const designationOptions = [
    { value: '', label: 'All Designations' },
    ...designations.map((d) => ({ value: d.id, label: d.title })),
  ];

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="employee-filters"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Search Input */}
        <div>
          <label
            htmlFor="employee-search"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Search
          </label>
          <Input
            id="employee-search"
            name="search"
            placeholder="Search by name, code, email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-h-[44px]"
            data-testid="employee-search-input"
          />
        </div>

        {/* Status Select */}
        <div>
          <label
            htmlFor="employee-status-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Status
          </label>
          <Select
            id="employee-status-filter"
            name="status"
            options={statusOptions}
            value={status ?? ''}
            onChange={(e) =>
              onStatusChange(e.target.value ? (e.target.value as EmployeeStatus) : undefined)
            }
            className="min-h-[44px]"
            data-testid="employee-status-select"
          />
        </div>

        {/* Department Select */}
        <div>
          <label
            htmlFor="employee-dept-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Department
          </label>
          <Select
            id="employee-dept-filter"
            name="departmentId"
            options={departmentOptions}
            value={departmentId ?? ''}
            onChange={(e) => onDepartmentChange(e.target.value || undefined)}
            className="min-h-[44px]"
            data-testid="employee-department-select"
          />
        </div>

        {/* Designation Select */}
        <div>
          <label
            htmlFor="employee-desig-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Designation
          </label>
          <Select
            id="employee-desig-filter"
            name="designationId"
            options={designationOptions}
            value={designationId ?? ''}
            onChange={(e) => onDesignationChange(e.target.value || undefined)}
            className="min-h-[44px]"
            data-testid="employee-designation-select"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="min-h-[44px] text-xs font-semibold"
            data-testid="employee-filters-reset"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
