import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui';
import type { AttendanceRecord } from '../types';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

export interface AttendanceCalendarViewProps {
  records: AttendanceRecord[];
  onDateSelect?: (date: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AttendanceCalendarView({ records, onDateSelect }: AttendanceCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Map records by workDate (YYYY-MM-DD)
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const existing = map.get(r.workDate) ?? [];
      existing.push(r);
      map.set(r.workDate, existing);
    }
    return map;
  }, [records]);

  // Compute days in month
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{ dayNumber: number | null; dateString: string | null }> = [];

    // Prefix empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null, dateString: null });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = (month + 1).toString().padStart(2, '0');
      const dayStr = d.toString().padStart(2, '0');
      const dateString = `${year}-${monthStr}-${dayStr}`;
      days.push({ dayNumber: d, dateString });
    }

    return days;
  }, [year, month]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectedRecord = selectedDate ? recordsByDate.get(selectedDate)?.[0] : null;

  return (
    <div
      className="p-4 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-4"
      data-testid="attendance-calendar-view"
    >
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold text-text font-display">{monthName}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            className="min-h-[44px] min-w-[44px]"
            data-testid="prev-month-btn"
            aria-label="Previous Month"
          >
            &larr;
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            className="min-h-[44px] min-w-[44px]"
            data-testid="next-month-btn"
            aria-label="Next Month"
          >
            &rarr;
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-bold text-text-muted pb-2 border-b border-border">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2" data-testid="calendar-days-grid">
        {calendarDays.map((item, idx) => {
          if (!item.dayNumber || !item.dateString) {
            return (
              <div
                key={`empty-${idx}`}
                className="h-16 sm:h-24 p-1 bg-surface-muted/30 rounded border border-transparent"
                aria-hidden="true"
              />
            );
          }

          const dayRecords = recordsByDate.get(item.dateString) ?? [];
          const primaryRecord = dayRecords[0];
          const isSelected = selectedDate === item.dateString;

          return (
            <button
              type="button"
              key={item.dateString}
              onClick={() => {
                setSelectedDate(item.dateString);
                if (onDateSelect && item.dateString) {
                  onDateSelect(item.dateString);
                }
              }}
              className={`h-16 sm:h-24 p-1.5 sm:p-2 text-left rounded-lg border transition-all flex flex-col justify-between min-h-[44px] ${
                isSelected
                  ? 'border-primary-deep bg-primary-soft ring-2 ring-primary-strong'
                  : primaryRecord
                    ? 'border-border bg-surface hover:bg-surface-muted'
                    : 'border-border/60 bg-surface/50 hover:bg-surface-muted/60'
              }`}
              data-testid={`calendar-day-${item.dateString}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold ${
                    isSelected ? 'text-primary-deep font-bold' : 'text-text'
                  }`}
                >
                  {item.dayNumber}
                </span>
                {primaryRecord?.durationMinutes ? (
                  <span className="hidden sm:inline-block text-[10px] text-text-subtle font-medium">
                    {(primaryRecord.durationMinutes / 60).toFixed(1)}h
                  </span>
                ) : null}
              </div>

              {primaryRecord && (
                <div className="mt-auto">
                  <div className="sm:hidden">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        primaryRecord.status === 'present'
                          ? 'bg-positive-ink'
                          : primaryRecord.status === 'late'
                            ? 'bg-amber-500'
                            : primaryRecord.status === 'half_day'
                              ? 'bg-orange-500'
                              : primaryRecord.status === 'absent'
                                ? 'bg-negative-ink'
                                : 'bg-primary-ink'
                      }`}
                    />
                  </div>
                  <div className="hidden sm:block">
                    <AttendanceStatusBadge status={primaryRecord.status} size="sm" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Details Card */}
      {selectedRecord && (
        <div
          className="p-4 bg-surface-muted border border-border rounded-lg mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          data-testid="selected-day-details"
        >
          <div className="space-y-1">
            <p className="text-sm font-bold text-text">Details for {selectedRecord.workDate}</p>
            <p className="text-xs text-text-muted">
              Check-In:{' '}
              {new Date(selectedRecord.checkInTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              &middot; Check-Out:{' '}
              {selectedRecord.checkOutTime
                ? new Date(selectedRecord.checkOutTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Active / None'}
              {selectedRecord.durationMinutes &&
                ` \u00B7 Total: ${Math.floor(selectedRecord.durationMinutes / 60)}h ${selectedRecord.durationMinutes % 60}m`}
            </p>
            {selectedRecord.notes && (
              <p className="text-xs text-text-muted italic">
                Note: &ldquo;{selectedRecord.notes}&rdquo;
              </p>
            )}
          </div>
          <AttendanceStatusBadge status={selectedRecord.status} />
        </div>
      )}
    </div>
  );
}
