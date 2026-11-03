import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { FormField } from '../../../components/ui/FormField';
import type { AuditLogQuery, AuditOutcome } from '../types';

interface AuditLogFiltersProps {
  query: AuditLogQuery;
  onUpdateFilters: (filters: Partial<AuditLogQuery>) => void;
  onResetFilters: () => void;
  isLoading?: boolean;
}

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'auth', label: 'Auth' },
  { value: 'users', label: 'Users & Roles' },
  { value: 'employees', label: 'Employees' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'settings', label: 'Settings' },
  { value: 'departments', label: 'Departments' },
  { value: 'designations', label: 'Designations' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'All Outcomes' },
  { value: 'success', label: 'Success' },
  { value: 'denied', label: 'Denied' },
  { value: 'failure', label: 'Failure' },
];

const SORT_OPTIONS = [
  { value: 'desc', label: 'Newest First' },
  { value: 'asc', label: 'Oldest First' },
];

export function AuditLogFilters({
  query,
  onUpdateFilters,
  onResetFilters,
  isLoading = false,
}: AuditLogFiltersProps) {
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const hasActiveFilters = Boolean(
    query.module ||
      query.action ||
      query.outcome ||
      query.entityType ||
      query.entityId ||
      query.from ||
      query.to ||
      query.sortOrder !== 'desc',
  );

  return (
    <div
      className="bg-surface border border-border rounded-card p-4 shadow-card mb-6"
      data-testid="audit-log-filters"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">Filters & Search</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-soft text-primary-strong">
              Active Filters
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              disabled={isLoading}
              data-testid="reset-filters-btn"
            >
              Reset Filters
            </Button>
          )}
          <button
            type="button"
            className="sm:hidden text-xs text-primary-ink font-medium underline min-h-[44px] flex items-center"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            data-testid="toggle-mobile-filters"
          >
            {isMobileExpanded ? 'Hide Filters' : 'Show Advanced Filters'}
          </button>
        </div>
      </div>

      {/* Grid of filters: always visible on sm+, expandable on mobile */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${isMobileExpanded ? 'block' : 'hidden sm:grid'}`}
      >
        <FormField label="Module" htmlFor="audit-filter-module">
          <Select
            id="audit-filter-module"
            name="module"
            value={query.module || ''}
            onChange={(e) => {
              const val = e.target.value;
              onUpdateFilters({ module: val || undefined });
            }}
            options={MODULE_OPTIONS}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Outcome" htmlFor="audit-filter-outcome">
          <Select
            id="audit-filter-outcome"
            name="outcome"
            value={query.outcome || ''}
            onChange={(e) => {
              const val = e.target.value as AuditOutcome | '';
              onUpdateFilters({ outcome: val || undefined });
            }}
            options={OUTCOME_OPTIONS}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Entity Type" htmlFor="audit-filter-entity-type">
          <Input
            id="audit-filter-entity-type"
            name="entityType"
            placeholder="e.g. employee, user..."
            value={query.entityType || ''}
            onChange={(e) => onUpdateFilters({ entityType: e.target.value || undefined })}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Sort Order" htmlFor="audit-filter-sort-order">
          <Select
            id="audit-filter-sort-order"
            name="sortOrder"
            value={query.sortOrder || 'desc'}
            onChange={(e) => onUpdateFilters({ sortOrder: e.target.value as 'asc' | 'desc' })}
            options={SORT_OPTIONS}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="From (UTC)" htmlFor="audit-filter-from">
          <Input
            id="audit-filter-from"
            type="datetime-local"
            name="from"
            value={query.from ? query.from.slice(0, 16) : ''}
            onChange={(e) => {
              const val = e.target.value ? new Date(e.target.value).toISOString() : undefined;
              onUpdateFilters({ from: val });
            }}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="To (UTC)" htmlFor="audit-filter-to">
          <Input
            id="audit-filter-to"
            type="datetime-local"
            name="to"
            value={query.to ? query.to.slice(0, 16) : ''}
            onChange={(e) => {
              const val = e.target.value ? new Date(e.target.value).toISOString() : undefined;
              onUpdateFilters({ to: val });
            }}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Specific Action (module.verb)" htmlFor="audit-filter-action">
          <Input
            id="audit-filter-action"
            name="action"
            placeholder="e.g. leave.approve"
            value={query.action || ''}
            onChange={(e) => onUpdateFilters({ action: e.target.value || undefined })}
            disabled={isLoading}
          />
        </FormField>

        <FormField label="Entity ID" htmlFor="audit-filter-entity-id">
          <Input
            id="audit-filter-entity-id"
            name="entityId"
            placeholder="Exact entity UUID / ID"
            value={query.entityId || ''}
            onChange={(e) => onUpdateFilters({ entityId: e.target.value || undefined })}
            disabled={isLoading}
          />
        </FormField>
      </div>
    </div>
  );
}
