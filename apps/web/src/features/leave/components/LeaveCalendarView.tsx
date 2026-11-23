import React, { useEffect, useMemo, useState } from 'react';
import type { Holiday, LeaveCalendarEntry } from '../types';
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
  /** Who is on leave today. Loaded apart from the month shown, so paging does not change it. */
  todayEntries?: LeaveCalendarEntry[];
  todayError?: string | null;
  holidays?: Holiday[];
  /** When known, a toggle narrows the calendar to this person's own leave. */
  myEmployeeId?: string;
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
  todayEntries = [],
  todayError = null,
  holidays = [],
  myEmployeeId,
  onRangeChange,
}) => {
  const today = todayIso();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [monthIndex, setMonthIndex] = useState(Number(today.slice(5, 7)) - 1);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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
      entries
        .filter((e) => !onlyMine || e.employeeId === myEmployeeId)
        .sort(
          (a, b) =>
            a.startDate.localeCompare(b.startDate) || a.employeeName.localeCompare(b.employeeName),
        ),
    [entries, onlyMine, myEmployeeId],
  );
  const holidayOn = (iso: string) => holidays.filter((h) => h.date === iso);

  const onDay = (iso: string) => sorted.filter((e) => e.startDate <= iso && iso <= e.endDate);
  const cells = monthCells(year, monthIndex);

  const todayHolidays = holidays.filter((h) => h.date === today);
  const onLeaveToday = [...todayEntries].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  const dayNumber = Number(today.slice(8, 10));
  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-x-6 gap-y-6"
      data-testid="leave-calendar-view"
    >
      <div className="xl:col-start-1 xl:row-start-1 space-y-2 min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
          Team Leave Calendar
        </h2>
        <p className="text-xs sm:text-sm text-text-muted">
          Approved and pending leave you are allowed to see.
        </p>
        {myEmployeeId && (
          <label className="flex items-center gap-2 text-sm text-text min-h-[44px] w-fit">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              data-testid="leave-only-mine"
            />
            Only my leave
          </label>
        )}
      </div>

      <div className="xl:col-start-2 xl:row-start-1 flex items-center justify-between gap-2 self-end">
        <button
          type="button"
          className={NAV_BUTTON}
          onClick={() => step(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h3
          className="flex-1 text-center text-base font-bold font-display text-text"
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

      <aside
        className="xl:col-start-2 xl:row-start-2 xl:sticky xl:top-4 self-start overflow-hidden rounded-card border border-border bg-surface-raised shadow-card"
        aria-label="On leave today"
        data-testid="leave-today-panel"
      >
        <div className="flex items-center gap-4 p-5 bg-primary-soft">
          <div
            aria-hidden="true"
            className="w-14 h-14 shrink-0 rounded-2xl bg-surface-raised border border-border flex flex-col items-center justify-center shadow-xs"
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-primary-ink">
              {MONTH_NAMES[Number(today.slice(5, 7)) - 1]?.slice(0, 3)}
            </span>
            <span className="text-xl font-extrabold font-display leading-none text-text">
              {dayNumber}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold font-display text-text">On leave today</h3>
            <p className="text-xs text-text-muted">{formatDay(today)}</p>
          </div>
          {!todayError && (
            <span
              className="ml-auto shrink-0 rounded-full bg-surface-raised border border-border px-3 py-1 text-sm font-extrabold text-text"
              data-testid="leave-today-count"
            >
              {onLeaveToday.length}
              <span className="sr-only">
                {' '}
                {onLeaveToday.length === 1 ? 'person' : 'people'} on leave
              </span>
            </span>
          )}
        </div>

        <div className="p-5 space-y-3">
          {todayHolidays.map((h) => (
            <p
              key={h.id}
              className="px-3 py-2 rounded-xl bg-tile-blue text-text text-sm font-semibold"
              data-testid="leave-today-holiday"
            >
              Holiday today: {h.name}
            </p>
          ))}
          {todayError ? (
            <p role="alert" className="text-sm text-danger" data-testid="leave-today-error">
              {todayError}
            </p>
          ) : onLeaveToday.length === 0 ? (
            <div className="py-4 text-center space-y-1" data-testid="leave-today-empty">
              <p className="text-sm font-bold text-text">Everyone is in today</p>
              <p className="text-xs text-text-muted">Nobody is on leave today.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="leave-today-list">
              {onLeaveToday.map((entry) => (
                <li
                  key={entry.requestId}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-surface"
                >
                  <span
                    aria-hidden="true"
                    className="w-10 h-10 shrink-0 rounded-full bg-primary-soft text-primary-ink text-sm font-bold flex items-center justify-center"
                  >
                    {initials(entry.employeeName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-text truncate">{entry.employeeName}</p>
                    <p className="text-xs text-text-muted truncate">
                      {entry.leaveTypeName} · {entry.halfDay ? 'Half day' : 'Full day'} ·{' '}
                      {statusLabel(entry.status)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="xl:col-start-1 xl:row-start-2 space-y-6 min-w-0">
        {isLoading && entries.length === 0 && (
          <p role="status" className="text-sm text-text-muted">
            Loading the leave calendar…
          </p>
        )}

        <div className="hidden md:block p-4 bg-surface rounded-card border border-border shadow-card space-y-4">
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted mb-1">
              {WEEKDAY_SHORT.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" data-testid="leave-calendar-grid">
              {cells.map((cell, i) => {
                if (!cell.iso || cell.day === null) return <span key={`blank-${i}`} />;
                const iso = cell.iso;
                const people = onDay(iso);
                const dayHolidays = holidayOn(iso);
                const isWeekend = i % 7 === 0 || i % 7 === 6;
                return (
                  <div
                    key={iso}
                    className={`min-h-[4.5rem] 2xl:min-h-[6rem] p-1.5 rounded-lg border text-left ${
                      iso === today ? 'border-primary-strong' : 'border-border'
                    } ${isWeekend ? 'bg-surface-muted' : ''} ${
                      selected === iso ? 'ring-2 ring-primary-strong' : ''
                    }`}
                    data-testid={isWeekend ? `leave-day-weekend-${iso}` : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(selected === iso ? null : iso)}
                      aria-pressed={selected === iso}
                      aria-label={`Details for ${formatDay(iso)}`}
                      className="min-h-[24px] min-w-[24px] text-xs font-semibold text-text rounded hover:bg-surface-muted"
                    >
                      {cell.day}
                    </button>
                    <ul className="mt-1 space-y-0.5">
                      {dayHolidays.map((h) => (
                        <li
                          key={h.id}
                          className="truncate rounded px-1 text-[11px] bg-tile-blue text-text"
                          title={h.name}
                        >
                          Holiday: {h.name}
                        </li>
                      ))}
                      {people.slice(0, 3).map((e) => (
                        <li
                          key={`${e.requestId}-${iso}`}
                          className={`truncate rounded px-1 text-[11px] ${
                            e.status === 'approved'
                              ? 'bg-primary-soft text-primary-ink'
                              : 'bg-tile-yellow text-text border border-dashed border-border-strong'
                          }`}
                          title={`${e.employeeName}: ${e.leaveTypeName} (${statusLabel(e.status)})`}
                        >
                          {e.status === 'pending' ? 'Pending: ' : ''}
                          {e.employeeName.split(' ')[0]} · {e.leaveTypeCode}
                          {e.halfDay ? ' ½' : ''}
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

          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted"
            aria-label="Legend"
            data-testid="leave-calendar-legend"
          >
            <li>
              <span className="inline-block px-1.5 rounded bg-primary-soft text-primary-ink">
                Name · TYPE
              </span>{' '}
              Approved leave
            </li>
            <li>
              <span className="inline-block px-1.5 rounded bg-tile-yellow border border-dashed border-border-strong">
                Pending: Name
              </span>{' '}
              Waiting for approval
            </li>
            <li>
              <span className="inline-block px-1.5 rounded bg-tile-blue text-text">Holiday</span>{' '}
              Company holiday
            </li>
            <li>
              <span className="inline-block px-1.5 rounded bg-surface-muted border border-border">
                Sat, Sun
              </span>{' '}
              Weekend
            </li>
            <li>½ Half day</li>
          </ul>

          {selected && (
            <div
              className="p-4 rounded-tile border border-border bg-surface-raised space-y-2"
              data-testid="leave-day-detail"
            >
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-bold font-display text-text">{formatDay(selected)}</h4>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="min-h-[44px] px-3 text-sm font-semibold text-text-muted"
                >
                  Close
                </button>
              </div>
              {holidayOn(selected).map((h) => (
                <p key={h.id} className="text-sm font-semibold text-text">
                  Holiday: {h.name}
                </p>
              ))}
              {onDay(selected).length === 0 && holidayOn(selected).length === 0 ? (
                <p className="text-sm text-text-muted">Nobody is on leave this day.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {onDay(selected).map((e) => (
                    <li key={e.requestId} className="py-2">
                      <p className="font-semibold text-sm text-text">{e.employeeName}</p>
                      <p className="text-xs text-text-muted">
                        {e.leaveTypeName} · {e.halfDay ? 'Half day' : 'Full day'} ·{' '}
                        {statusLabel(e.status)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
    </div>
  );
};
