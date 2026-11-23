import React, { useMemo, useState } from 'react';
import type { Holiday } from '../types';
import { MONTH_NAMES, WEEKDAY_SHORT, formatDay, monthCells, todayIso } from '../lib/calendar-dates';

export interface HolidayCalendarProps {
  holidays: Holiday[];
  year: number;
  onYearChange: (year: number) => void;
  onAddHoliday?: () => void;
  onDeleteHoliday?: (id: string, name: string) => Promise<void>;
  canManage?: boolean;
  isLoading?: boolean;
}

const NAV_BUTTON =
  'min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted hover:text-text hover:bg-surface-muted transition-colors';

/** Holidays come only from what the company added; with none, the page says so. */
export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  year,
  onYearChange,
  onAddHoliday,
  onDeleteHoliday,
  canManage = false,
  isLoading = false,
}) => {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const [monthIndex, setMonthIndex] = useState(
    year === thisYear ? Number(today.slice(5, 7)) - 1 : 0,
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const holiday of holidays) {
      map.set(holiday.date, [...(map.get(holiday.date) ?? []), holiday]);
    }
    return map;
  }, [holidays]);

  const grouped = useMemo(() => {
    const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));
    const groups: { month: number; items: Holiday[] }[] = [];
    for (const holiday of sorted) {
      const month = Number(holiday.date.slice(5, 7)) - 1;
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(holiday);
      else groups.push({ month, items: [holiday] });
    }
    return groups;
  }, [holidays]);

  const step = (delta: number) => {
    const next = monthIndex + delta;
    if (next < 0) {
      onYearChange(year - 1);
      setMonthIndex(11);
    } else if (next > 11) {
      onYearChange(year + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex(next);
    }
  };

  const cells = monthCells(year, monthIndex);

  return (
    <div className="space-y-6" data-testid="holiday-calendar-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            Company Holiday Calendar
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Holidays the company has added for {year}. They are not counted as leave days.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            className={NAV_BUTTON}
            onClick={() => onYearChange(year - 1)}
            data-testid="holiday-prev-year-btn"
            aria-label="Previous year"
          >
            ‹
          </button>
          <span className="px-2 text-sm font-bold text-text font-mono" data-testid="holiday-year">
            Year: {year}
          </span>
          <button
            type="button"
            className={NAV_BUTTON}
            onClick={() => onYearChange(year + 1)}
            data-testid="holiday-next-year-btn"
            aria-label="Next year"
          >
            ›
          </button>
        </div>
      </div>

      {isLoading && holidays.length === 0 ? (
        <p role="status" className="text-sm text-text-muted">
          Loading holidays…
        </p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section
            aria-label={`${MONTH_NAMES[monthIndex]} ${year}`}
            className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card"
          >
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                className={NAV_BUTTON}
                onClick={() => step(-1)}
                aria-label="Previous month"
              >
                ‹
              </button>
              <h3 className="text-base font-bold font-display text-text" aria-live="polite">
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
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-text-muted mb-1">
              {WEEKDAY_SHORT.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" data-testid="holiday-month-grid">
              {cells.map((cell, i) => {
                if (!cell.iso || cell.day === null) return <span key={`blank-${i}`} />;
                const names = (byDate.get(cell.iso) ?? []).map((h) => h.name);
                const isHoliday = names.length > 0;
                return (
                  <div
                    key={cell.iso}
                    title={isHoliday ? names.join(', ') : undefined}
                    aria-label={isHoliday ? `${cell.day}: ${names.join(', ')}` : undefined}
                    data-testid={isHoliday ? `holiday-day-${cell.iso}` : undefined}
                    className={`min-h-[3rem] sm:min-h-[4.5rem] p-1 flex flex-col items-center rounded-lg text-sm ${
                      isHoliday
                        ? 'bg-primary-soft text-primary-ink font-bold border border-primary-strong'
                        : cell.iso === today
                          ? 'border border-border-strong text-text font-semibold'
                          : 'text-text'
                    }`}
                  >
                    {cell.day}
                    {isHoliday && <span className="sr-only">holiday</span>}
                    {isHoliday && (
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    {isHoliday && (
                      <span
                        aria-hidden="true"
                        className="hidden sm:block mt-0.5 w-full truncate text-center text-[10px] font-semibold leading-tight"
                      >
                        {names.join(', ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card">
            <h3 className="text-base font-bold font-display text-text mb-3">Holidays in {year}</h3>
            {deleteError && (
              <p role="alert" className="text-sm text-danger mb-3">
                {deleteError}
              </p>
            )}
            {grouped.length === 0 ? (
              <div className="text-center py-8 space-y-2" data-testid="holiday-empty">
                <p className="font-bold text-text">No holidays added yet</p>
                <p className="text-xs text-text-muted">
                  {canManage
                    ? 'Add the days the company is closed so they are not counted as leave.'
                    : 'Your company has not added any holidays for this year.'}
                </p>
                {canManage && onAddHoliday && (
                  <button
                    type="button"
                    onClick={onAddHoliday}
                    className="min-h-[44px] px-4 rounded-control bg-primary-deep text-white text-sm font-semibold"
                  >
                    Add Holiday
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map((group) => (
                  <div key={group.month}>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-text-subtle mb-1.5">
                      {MONTH_NAMES[group.month]}
                    </h4>
                    <ul className="space-y-2">
                      {group.items.map((holiday) => (
                        <li
                          key={holiday.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-tile border border-border bg-surface-raised"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-text truncate">
                              {holiday.name}
                            </p>
                            <p className="text-xs text-text-muted">{formatDay(holiday.date)}</p>
                          </div>
                          {canManage && onDeleteHoliday && (
                            <button
                              type="button"
                              data-testid={`delete-holiday-btn-${holiday.id}`}
                              aria-label={`Delete ${holiday.name}`}
                              onClick={async () => {
                                if (!window.confirm(`Delete holiday "${holiday.name}"?`)) return;
                                try {
                                  setDeleteError(null);
                                  await onDeleteHoliday(holiday.id, holiday.name);
                                } catch (err) {
                                  setDeleteError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Could not delete the holiday',
                                  );
                                }
                              }}
                              className="min-h-[44px] px-3 text-sm font-semibold text-danger"
                            >
                              Delete
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
