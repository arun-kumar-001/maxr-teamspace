import React, { useEffect, useMemo, useState } from 'react';
import type { LeaveCalendarEntry } from '../types';
import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  formatDay,
  monthCells,
  monthRange,
  todayIso,
} from '../lib/calendar-dates';

export interface LeaveCalendarViewProps {
  entries: LeaveCalendarEntry[];
  isLoading?: boolean;
  /** Called with the first and last day of the month shown, so the page can load that range. */
  onRangeChange?: (from: string, to: string) => void;
}

const NAV_BUTTON =
  'min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted hover:text-text hover:bg-surface-muted transition-colors';

function daysLabel(entry: LeaveCalendarEntry): string {
  if (entry.halfDay) return 'Half day';
  return `${entry.days} ${entry.days === 1 ? 'day' : 'days'}`;
}

function statusLabel(status: LeaveCalendarEntry['status']): string {
  return status === 'approved' ? 'Approved' : 'Pending';
}

/**
 * Who is on leave, from the server's calendar for the month shown. A pending request is labelled
 * as pending, not only coloured, and the list under the grid works on a phone where the grid is tight.
 */
export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  entries,
  isLoading = false,
  onRangeChange,
}) => {
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [monthIndex, setMonthIndex] = useState(Number(today.slice(5, 7)) - 1);

  useEffect(() => {
    if (!onRangeChange) return;
    const { from, to } = monthRange(year, monthIndex);
    onRangeChange(from, to);
  }, [year, monthIndex, onRangeChange]);

  const step = (delta: number) => {
    const next = monthIndex + delta;
    if (next < 0) {
      setYear(year - 1);
      setMonthIndex(11);
    } else if (next > 11) {
      setYear(year + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex(next);
    }
  };

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName),
      ),
    [entries],
  );

  const onDay = (iso: string) => sorted.filter((e) => e.startDate <= iso && iso <= e.endDate);
  const cells = monthCells(year, monthIndex);

  return (
    <div className="space-y-6" data-testid="leave-calendar-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            Team Leave Calendar
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Approved and pending leave you are allowed to see.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            className={NAV_BUTTON}
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h3
            className="min-w-[10rem] text-center text-base font-bold font-display text-text"
            aria-live="polite"
            data-testid="leave-calendar-month"
          >
            {MONTH_NAMES[monthIndex]} {year}
          </h3>
          <button
            type="button"
            className={NAV_BUTTON}
            onClick={() => step(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading && entries.length === 0 && (
        <p role="status" className="text-sm text-text-muted">
          Loading the leave calendar…
        </p>
      )}

      <div className="hidden md:block p-4 bg-surface rounded-card border border-border shadow-card">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted mb-1">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1" data-testid="leave-calendar-grid">
          {cells.map((cell, i) => {
            if (!cell.iso || cell.day === null) return <span key={`blank-${i}`} />;
            const people = onDay(cell.iso);
            return (
              <div
                key={cell.iso}
                className={`min-h-[5.5rem] p-1.5 rounded-lg border text-left ${
                  cell.iso === today ? 'border-primary-strong' : 'border-border'
                }`}
              >
                <span className="text-xs font-semibold text-text">{cell.day}</span>
                <ul className="mt-1 space-y-0.5">
                  {people.slice(0, 3).map((e) => (
                    <li
                      key={`${e.requestId}-${cell.iso}`}
                      className={`truncate rounded px-1 text-[11px] ${
                        e.status === 'approved'
                          ? 'bg-primary-soft text-primary-ink'
                          : 'bg-tile-yellow text-text border border-dashed border-border-strong'
                      }`}
                      title={`${e.employeeName}: ${e.leaveTypeName} (${statusLabel(e.status)})`}
                    >
                      {e.status === 'pending' ? 'Pending: ' : ''}
                      {e.employeeName}
                    </li>
                  ))}
                  {people.length > 3 && (
                    <li className="text-[11px] text-text-muted">+{people.length - 3} more</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <section
        className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card"
        aria-label="Leave this month"
      >
        <h3 className="text-base font-bold font-display text-text mb-3">
          Leave in {MONTH_NAMES[monthIndex]}
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-text-muted" data-testid="leave-calendar-empty">
            Nobody is on leave in {MONTH_NAMES[monthIndex]}.
          </p>
        ) : (
          <ul className="divide-y divide-border" data-testid="leave-calendar-list">
            {sorted.map((entry) => (
              <li
                key={entry.requestId}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-text">{entry.employeeName}</p>
                  <p className="text-xs text-text-muted">
                    {entry.leaveTypeName} · {formatDay(entry.startDate)}
                    {entry.endDate !== entry.startDate ? ` to ${formatDay(entry.endDate)}` : ''}
                  </p>
                </div>
                <p className="text-xs font-semibold text-text-subtle">
                  {daysLabel(entry)} · {statusLabel(entry.status)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
