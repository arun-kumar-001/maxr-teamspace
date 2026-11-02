import React from 'react';
import type { Holiday } from '../types';
import { Button, EmptyState } from '../../../components/ui';

export interface HolidayCalendarProps {
  holidays: Holiday[];
  year: number;
  onYearChange: (year: number) => void;
  onAddHoliday?: () => void;
  onDeleteHoliday?: (id: string, name: string) => Promise<void>;
  canManage?: boolean;
  isLoading?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  year,
  onYearChange,
  onAddHoliday,
  onDeleteHoliday,
  canManage = false,
  isLoading = false,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Sort holidays chronologically
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  // Group holidays by month (0-11)
  const holidaysByMonth: { [month: number]: Holiday[] } = {};
  for (let m = 0; m < 12; m++) {
    holidaysByMonth[m] = [];
  }
  for (const h of sortedHolidays) {
    const monthIndex = parseInt(h.date.slice(5, 7), 10) - 1;
    if (holidaysByMonth[monthIndex]) {
      holidaysByMonth[monthIndex].push(h);
    }
  }

  const activeMonths = Object.keys(holidaysByMonth)
    .map(Number)
    .filter((m) => (holidaysByMonth[m]?.length ?? 0) > 0);

  return (
    <div className="space-y-6" data-testid="holiday-calendar-container">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface border border-border rounded-card">
        <div>
          <h2 className="text-lg font-bold text-text font-display">Company Holiday Calendar</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Public and declared company holidays for {year}. Leave day calculations automatically
            exclude these dates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center border border-border rounded-control bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              data-testid="holiday-prev-year-btn"
              aria-label="Previous year"
              className="p-1.5 hover:bg-surface rounded text-text min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span
              className="px-3 text-sm font-bold text-text font-mono"
              data-testid="holiday-current-year"
            >
              {year}
            </span>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              data-testid="holiday-next-year-btn"
              aria-label="Next year"
              className="p-1.5 hover:bg-surface rounded text-text min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {canManage && onAddHoliday && (
            <Button
              type="button"
              variant="primary"
              onClick={onAddHoliday}
              data-testid="add-holiday-btn"
              className="min-h-[44px]"
            >
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {sortedHolidays.length === 0 && !isLoading ? (
        <EmptyState
          title={`No Holidays Configured for ${year}`}
          description="Company holidays define non-working dates and are accounted for during leave applications and payroll summaries."
          actionLabel={canManage && onAddHoliday ? 'Add First Holiday' : undefined}
          onAction={canManage && onAddHoliday ? onAddHoliday : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeMonths.map((m) => {
            const monthList = holidaysByMonth[m] ?? [];
            return (
              <div
                key={m}
                className="p-4 bg-surface border border-border rounded-tile shadow-card space-y-3"
                data-testid={`holiday-month-card-${m}`}
              >
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h3 className="font-bold text-sm text-text font-display">{MONTH_NAMES[m]}</h3>
                  <span className="text-xs text-text-subtle font-mono">
                    {monthList.length} {monthList.length === 1 ? 'holiday' : 'holidays'}
                  </span>
                </div>

                <div className="space-y-2">
                  {monthList.map((holiday) => {
                    const dateObj = new Date(`${holiday.date}T00:00:00Z`);
                    const dayName = DAY_NAMES[dateObj.getUTCDay()] ?? 'Day';
                    const dayNumber = holiday.date.slice(8, 10);
                    const isUpcoming = holiday.date >= todayStr;

                    return (
                      <div
                        key={holiday.id}
                        className="p-2.5 rounded-control bg-surface-muted/60 border border-border flex items-center justify-between gap-3 group"
                        data-testid={`holiday-item-${holiday.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center justify-center w-10 h-10 rounded bg-surface border border-border text-center shrink-0">
                            <span className="text-xs font-bold text-primary-deep leading-none">
                              {dayNumber}
                            </span>
                            <span className="text-[10px] text-text-subtle leading-none mt-0.5">
                              {dayName.slice(0, 3)}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text text-sm">
                                {holiday.name}
                              </span>
                              {isUpcoming && (
                                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-primary-soft text-primary-deep border border-primary/20">
                                  Upcoming
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-subtle">{dayName}</span>
                          </div>
                        </div>

                        {canManage && onDeleteHoliday && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Delete holiday "${holiday.name}" (${holiday.date})?`,
                                )
                              ) {
                                onDeleteHoliday(holiday.id, holiday.name);
                              }
                            }}
                            data-testid={`delete-holiday-btn-${holiday.id}`}
                            aria-label={`Delete ${holiday.name}`}
                            className="opacity-70 group-hover:opacity-100 p-2 hover:bg-rose-50 hover:text-rose-600 rounded text-text-subtle transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
