import React from 'react';
import { Select } from '../../../components/ui/Select';
import type { ApprovalFilters as Filters, ApprovalStatus } from '../types';

export interface ApprovalFiltersProps {
  filters: Filters;
  onChange: (updated: Filters) => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SUBJECT_OPTIONS = [
  { value: '', label: 'All Subjects' },
  { value: 'attendance_correction', label: 'Attendance Correction' },
  { value: 'leave_request', label: 'Leave Request' },
  { value: 'expense_claim', label: 'Expense Claim' },
];

export const ApprovalFiltersBar: React.FC<ApprovalFiltersProps> = ({
  filters,
  onChange,
  isLoading = false,
}) => {
  return (
    <div
      className="bg-surface rounded-card p-4 border border-border shadow-card flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
      data-testid="approval-filters"
    >
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
        {/* Status Dropdown */}
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by Status"
            value={filters.status ?? ''}
            onChange={(e) => {
              const val = e.target.value as ApprovalStatus | '';
              onChange({
                ...filters,
                status: val ? val : undefined,
              });
            }}
            disabled={isLoading}
            options={STATUS_OPTIONS}
            className="h-11 min-h-[44px]"
          />
        </div>

        {/* Subject Type Dropdown */}
        <div className="w-full sm:w-48">
          <Select
            aria-label="Filter by Subject Type"
            value={filters.subjectType ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filters,
                subjectType: val ? val : undefined,
              });
            }}
            disabled={isLoading}
            options={SUBJECT_OPTIONS}
            className="h-11 min-h-[44px]"
          />
        </div>
      </div>

      {/* Awaiting My Decision Toggle Button */}
      <div className="flex items-center">
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(filters.awaitingMyDecision)}
          onClick={() => {
            onChange({
              ...filters,
              awaitingMyDecision: !filters.awaitingMyDecision,
            });
          }}
          disabled={isLoading}
          data-testid="awaiting-decision-toggle"
          className={`min-h-[44px] px-4 py-2 rounded-control text-sm font-medium transition-colors flex items-center justify-center gap-2 border w-full md:w-auto ${
            filters.awaitingMyDecision
              ? 'bg-primary-deep text-white border-primary-deep shadow-primary'
              : 'bg-surface text-text hover:bg-surface-muted border-border'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              filters.awaitingMyDecision ? 'bg-primary' : 'bg-slate-300'
            }`}
          />
          Awaiting My Decision Only
        </button>
      </div>
    </div>
  );
};
