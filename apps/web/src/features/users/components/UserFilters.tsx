import { ROLES, type Role } from '@maxr/shared';
import { Button, Input, Select } from '../../../components/ui';
import type { UserFilters as UserFiltersState } from '../types';

export interface UserFiltersProps {
  filters: UserFiltersState;
  onSearchChange: (search: string) => void;
  onRoleChange: (role: Role | '') => void;
  onIsActiveChange: (isActive: boolean | '') => void;
  onReset: () => void;
}

export function UserFilters({
  filters,
  onSearchChange,
  onRoleChange,
  onIsActiveChange,
  onReset,
}: UserFiltersProps) {
  const hasActiveFilters = Boolean(
    filters.search || filters.role || (filters.isActive !== '' && filters.isActive !== undefined),
  );

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: ROLES.ADMIN, label: 'Admin' },
    { value: ROLES.HR_MANAGER, label: 'HR Manager' },
    { value: ROLES.TEAM_LEAD, label: 'Team Lead' },
    { value: ROLES.STAFF, label: 'Staff' },
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ];

  const currentStatusValue =
    filters.isActive === true ? 'true' : filters.isActive === false ? 'false' : '';

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="user-filters"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        <div>
          <label
            htmlFor="user-search"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Search
          </label>
          <Input
            id="user-search"
            name="search"
            placeholder="Search by name, email, code..."
            value={filters.search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            data-testid="user-search-input"
            className="min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor="user-role-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Role
          </label>
          <Select
            id="user-role-filter"
            name="role"
            aria-label="Filter by Role"
            options={roleOptions}
            value={filters.role || ''}
            onChange={(e) => onRoleChange(e.target.value as Role | '')}
            data-testid="user-role-select"
            className="min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor="user-status-filter"
            className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1"
          >
            Status
          </label>
          <Select
            id="user-status-filter"
            name="status"
            aria-label="Filter by Status"
            options={statusOptions}
            value={currentStatusValue}
            onChange={(e) => {
              const val = e.target.value;
              onIsActiveChange(val === 'true' ? true : val === 'false' ? false : '');
            }}
            data-testid="user-status-select"
            className="min-h-[44px]"
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-end">
            <Button
              variant="outline"
              size="md"
              onClick={onReset}
              data-testid="reset-user-filters-btn"
              className="w-full sm:w-auto min-h-[44px]"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
