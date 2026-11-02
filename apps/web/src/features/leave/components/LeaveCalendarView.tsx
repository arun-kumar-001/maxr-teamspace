import React, { useState } from 'react';
import type { LeaveCalendarEntry } from '../types';
import { Badge, EmptyState } from '../../../components/ui';

export interface LeaveCalendarViewProps {
  entries: LeaveCalendarEntry[];
  isLoading?: boolean;
  onRangeChange?: (from: string, to: string) => void;
}

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  entries,
  isLoading = false,
}) => {
  const [filterType, setFilterType] = useState<string>('all');

  // Sort chronologically
  const sortedEntries = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const filteredEntries = sortedEntries.filter((e) => {
    if (filterType === 'all') return true;
    return e.status === filterType;
  });

  return (
    <div className="space-y-4" data-testid="leave-calendar-view">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface border border-border rounded-card">
        <div>
          <h2 className="text-lg font-bold text-text font-display">Team Leave Calendar</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Overview of upcoming scheduled team leaves and absences to assist in workload planning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'approved', 'pending'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] transition-colors border capitalize ${
                filterType === type
                  ? 'bg-primary-deep text-white border-primary-deep shadow-primary'
                  : 'bg-surface text-text-muted border-border hover:border-primary-strong hover:text-text'
              }`}
              data-testid={`calendar-filter-${type}`}
            >
              {type === 'all'
                ? `All (${entries.length})`
                : `${type} (${entries.filter((e) => e.status === type).length})`}
            </button>
          ))}
        </div>
      </div>

      {filteredEntries.length === 0 && !isLoading ? (
        <EmptyState
          title="No Scheduled Team Leaves"
          description="There are no approved or pending leave requests scheduled for the selected calendar timeframe."
        />
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          data-testid="calendar-entries-grid"
        >
          {filteredEntries.map((entry) => (
            <div
              key={entry.requestId}
              className="p-4 bg-surface border border-border rounded-tile shadow-card space-y-3"
              data-testid={`calendar-entry-${entry.requestId}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-text font-display">{entry.employeeName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-muted border border-border text-text">
                      {entry.leaveTypeCode}
                    </span>
                    <span className="text-xs text-text-muted">{entry.leaveTypeName}</span>
                  </div>
                </div>

                <Badge variant={entry.status === 'approved' ? 'success' : 'warning'}>
                  {entry.status === 'approved' ? 'Approved' : 'Pending'}
                </Badge>
              </div>

              <div className="p-2.5 rounded-control bg-surface-muted/60 border border-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-text-subtle">Dates:</span>
                  <span className="font-medium text-text font-mono">
                    {entry.startDate}{' '}
                    {entry.startDate !== entry.endDate ? `to ${entry.endDate}` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-subtle">Duration:</span>
                  <span className="font-bold text-primary-deep font-mono">
                    {entry.halfDay
                      ? '0.5 day'
                      : `${entry.days} ${entry.days === 1 ? 'day' : 'days'}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
