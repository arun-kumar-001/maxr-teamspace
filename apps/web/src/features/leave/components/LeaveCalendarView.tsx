import React, { useMemo, useState } from 'react';
import { Badge, EmptyState } from '../../../components/ui';
import type { Holiday, LeaveCalendarEntry } from '../types';

export interface LeaveCalendarViewProps {
  entries: LeaveCalendarEntry[];
  holidays?: Holiday[];
  isLoading?: boolean;
  onRangeChange?: (from: string, to: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  entries,
  holidays = [],
  isLoading = false,
  onRangeChange,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const navigateMonth = (delta: number | 'today') => {
    const next =
      delta === 'today'
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(next);
    setSelectedDayKey(null);
    if (onRangeChange) {
      const start = new Date(next.getFullYear(), next.getMonth(), 1);
      const end = new Date(next.getFullYear(), next.getMonth() + 1, 0);
      onRangeChange(toDateKey(start), toDateKey(end));
    }
  };

  // Sort chronologically
  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [entries],
  );

  const statusFiltered = useMemo(
    () =>
      sortedEntries.filter((e) => {
        if (filterType === 'all') return true;
        return e.status === filterType;
      }),
    [sortedEntries, filterType],
  );

  const filteredEntries = useMemo(() => {
    if (!selectedDayKey) return statusFiltered;
    return statusFiltered.filter(
      (e) => selectedDayKey >= e.startDate && selectedDayKey <= e.endDate,
    );
  }, [statusFiltered, selectedDayKey]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - offset);
    const todayKey = toDateKey(new Date());

    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + idx);
      const key = toDateKey(d);
      const dayOfWeek = idx % 7;
      return {
        date: d,
        key,
        dayNumber: d.getDate(),
        isCurrentMonth: d.getMonth() === month,
        isToday: key === todayKey,
        isWeekend: dayOfWeek >= 5,
      };
    });
  }, [currentMonth]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const h of holidays) map.set(h.date, h);
    return map;
  }, [holidays]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4" data-testid="leave-calendar-view">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface border border-border rounded-card shadow-card">
        <div>
          <h2 className="text-lg font-bold text-text font-display">Team Leave Calendar</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Overview of upcoming scheduled team leaves and absences to assist in workload planning.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {['all', 'approved', 'pending'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] transition-colors border capitalize cursor-pointer ${
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

      {/* Interactive Month Calendar Grid */}
      <div className="bg-surface border border-border rounded-card shadow-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-text font-display">{monthLabel}</h3>
            {selectedDayKey && (
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep text-[11px] font-semibold cursor-pointer hover:opacity-80"
              >
                Filtered: {selectedDayKey} &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              className="px-2.5 py-1.5 rounded-input border border-border text-xs font-medium text-text hover:bg-surface-muted transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              &larr; Prev
            </button>
            <button
              type="button"
              onClick={() => navigateMonth('today')}
              className="px-2.5 py-1.5 rounded-input border border-border text-xs font-medium text-text hover:bg-surface-muted transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              className="px-2.5 py-1.5 rounded-input border border-border text-xs font-medium text-text hover:bg-surface-muted transition-colors cursor-pointer"
              aria-label="Next month"
            >
              Next &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-text-subtle uppercase tracking-wider">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const holiday = holidayMap.get(day.key);
            const dayLeaves = statusFiltered.filter(
              (e) => day.key >= e.startDate && day.key <= e.endDate,
            );
            const isSelected = selectedDayKey === day.key;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(isSelected ? null : day.key)}
                className={`min-h-[82px] p-1.5 rounded-tile border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary-strong ring-2 ring-primary/25 bg-primary-soft/20'
                    : day.isToday
                      ? 'border-primary-strong/60 bg-primary-soft/15'
                      : day.isCurrentMonth
                        ? day.isWeekend
                          ? 'border-border bg-surface-muted/45 hover:border-border-strong'
                          : 'border-border bg-surface hover:border-primary-strong/40'
                        : 'border-border/50 bg-surface-muted/25 text-text-subtle'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs font-semibold ${
                      day.isToday
                        ? 'px-1.5 py-0.5 rounded-full bg-primary-deep text-surface'
                        : day.isCurrentMonth
                          ? 'text-text'
                          : 'text-text-subtle'
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  {dayLeaves.length > 0 && (
                    <span className="text-[10px] font-semibold text-text-subtle">
                      {dayLeaves.length}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5 w-full overflow-hidden">
                  {holiday && (
                    <div
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold truncate bg-positive-soft text-positive-ink border-l-2 border-l-positive-ink"
                      title={holiday.name}
                    >
                      {holiday.name}
                    </div>
                  )}
                  {dayLeaves.slice(0, holiday ? 1 : 2).map((leave) => (
                    <div
                      key={leave.requestId}
                      title={`${leave.employeeName} · ${leave.leaveTypeName} (${leave.status})`}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate border-l-2 ${
                        leave.status === 'approved'
                          ? 'bg-primary-soft text-primary-deep border-l-primary-strong'
                          : 'bg-tile-yellow text-warning border-l-warning'
                      }`}
                    >
                      {leave.employeeName.split(' ')[0]} &middot; {leave.leaveTypeCode}
                    </div>
                  ))}
                  {dayLeaves.length > (holiday ? 1 : 2) && (
                    <div className="text-[10px] text-text-subtle px-1 font-medium">
                      +{dayLeaves.length - (holiday ? 1 : 2)} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary-strong" />
            <span>Approved leave</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-warning" />
            <span>Pending approval</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-positive-ink" />
            <span>Company holiday</span>
          </span>
        </div>
      </div>

      {/* Detailed Leave Cards Grid */}
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
          {filteredEntries.map((entry, idx) => (
            <div
              key={entry.requestId}
              style={{ animationDelay: `${Math.min(idx, 8) * 45}ms` }}
              className="animate-crm-fade-up p-4 bg-surface border border-border rounded-tile shadow-card hover:shadow-raised hover:-translate-y-0.5 transition-all duration-200 space-y-3"
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
