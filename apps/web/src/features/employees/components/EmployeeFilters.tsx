import { Button, Input, Select } from '../../../components/ui';
import type { DepartmentItem, DesignationItem, EmployeeStatus, ManagerOption } from '../types';

export interface EmployeeFiltersProps {
  search?: string;
  status?: EmployeeStatus;
  departmentId?: string;
  designationId?: string;
  managerId?: string;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  managers?: ManagerOption[];
  onSearchChange: (search: string) => void;
  onStatusChange: (status: EmployeeStatus | undefined) => void;
  onDepartmentChange: (departmentId: string | undefined) => void;
  onDesignationChange: (designationId: string | undefined) => void;
  onManagerChange?: (managerId: string | undefined) => void;
  onReset: () => void;
}

export function EmployeeFilters({
  search = '',
  status,
  departmentId,
  designationId,
  managerId,
  departments,
  designations,
  managers = [],
  onSearchChange,
  onStatusChange,
  onDepartmentChange,
  onDesignationChange,
  onManagerChange,
  onReset,
}: EmployeeFiltersProps) {
  const hasActiveFilters = Boolean(search || status || departmentId || designationId || managerId);

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

  const managerOptions = [
    { value: '', label: 'All Managers' },
    ...managers.map((m) => ({ value: m.id, label: `${m.name} (${m.employeeCode})` })),
  ];

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="employee-filters"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
            placeholder="Search by name, code, or email..."
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
            aria-label="Filter by Status"
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
            aria-label="Filter by Department"
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
            aria-label="Filter by Designation"
            name="designationId"
            options={designationOptions}
            value={designationId ?? ''}
            onChange={(e) => onDesignationChange(e.target.value || undefined)}
            className="min-h-[44px]"
            data-testid="employee-designation-select"
          />
        </div>

        {/* Manager Select */}
        <div>
          <label
            htmlFor="employee-manager-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Manager
          </label>
          <Select
            id="employee-manager-filter"
            aria-label="Filter by Manager"
            name="managerId"
            options={managerOptions}
            value={managerId ?? ''}
            onChange={(e) => onManagerChange?.(e.target.value || undefined)}
            className="min-h-[44px]"
            data-testid="employee-manager-select"
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
