import { Button, Input, Select } from '../../../components/ui';
import type { AttendanceDisplayMode, AttendanceViewScope } from '../hooks/useAttendanceHistory';
import type { AttendanceStatus } from '../types';

export interface AttendanceFiltersProps {
  startDate: string;
  endDate: string;
  status: AttendanceStatus | '';
  scope: AttendanceViewScope;
  displayMode: AttendanceDisplayMode;
  canViewTeam: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStatusChange: (status: AttendanceStatus | '') => void;
  onScopeChange: (scope: AttendanceViewScope) => void;
  onDisplayModeChange: (mode: AttendanceDisplayMode) => void;
  onReset: () => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'weekend', label: 'Weekend' },
];

export function AttendanceFilters({
  startDate,
  endDate,
  status,
  scope,
  displayMode,
  canViewTeam,
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
  onScopeChange,
  onDisplayModeChange,
  onReset,
}: AttendanceFiltersProps) {
  const hasActiveFilters = Boolean(startDate || endDate || status);

  return (
    <div
      className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="attendance-filters"
    >
      {/* Scope and Display Mode toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-3">
        {canViewTeam ? (
          <div className="flex rounded-md p-1 bg-surface-muted border border-border">
            <button
              type="button"
              onClick={() => onScopeChange('own')}
              className={`px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                scope === 'own'
                  ? 'bg-surface text-primary-deep shadow-sm font-bold'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid="scope-own-btn"
            >
              My Attendance
            </button>
            <button
              type="button"
              onClick={() => onScopeChange('team')}
              className={`px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                scope === 'team'
                  ? 'bg-surface text-primary-deep shadow-sm font-bold'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid="scope-team-btn"
            >
              Team Attendance
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-text">My Attendance Records</span>
        )}

        <div className="flex rounded-md p-1 bg-surface-muted border border-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onDisplayModeChange('list')}
            className={`px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
              displayMode === 'list'
                ? 'bg-surface text-primary-deep shadow-sm font-bold'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="view-list-btn"
          >
            List View
          </button>
          <button
            type="button"
            onClick={() => onDisplayModeChange('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
              displayMode === 'calendar'
                ? 'bg-surface text-primary-deep shadow-sm font-bold'
                : 'text-text-muted hover:text-text'
            }`}
            data-testid="view-calendar-btn"
          >
            Calendar View
          </button>
          {canViewTeam && scope === 'team' && (
            <button
              type="button"
              onClick={() => onDisplayModeChange('teamGrid')}
              className={`px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                displayMode === 'teamGrid'
                  ? 'bg-surface text-primary-deep shadow-sm font-bold'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid="view-grid-btn"
            >
              Team Grid
            </button>
          )}
        </div>
      </div>

      {/* Input Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label
            htmlFor="filter-start-date"
            className="block text-xs font-medium text-text-muted mb-1"
          >
            Start Date
          </label>
          <Input
            id="filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full min-h-[44px] text-xs sm:text-sm"
            data-testid="start-date-input"
          />
        </div>

        <div>
          <label
            htmlFor="filter-end-date"
            className="block text-xs font-medium text-text-muted mb-1"
          >
            End Date
          </label>
          <Input
            id="filter-end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full min-h-[44px] text-xs sm:text-sm"
            data-testid="end-date-input"
          />
        </div>

        <div>
          <label
            htmlFor="filter-status-select"
            className="block text-xs font-medium text-text-muted mb-1"
          >
            Status
          </label>
          <Select
            id="filter-status-select"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as AttendanceStatus | '')}
            options={STATUS_OPTIONS}
            className="w-full min-h-[44px] text-xs sm:text-sm"
            data-testid="status-select"
          />
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="md"
              onClick={onReset}
              className="w-full min-h-[44px] text-xs sm:text-sm"
              data-testid="reset-filters-button"
            >
              Reset Filters
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
