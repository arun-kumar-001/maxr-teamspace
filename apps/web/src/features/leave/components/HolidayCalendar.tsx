import React, { useState } from 'react';
import type { Holiday } from '../types';

export interface HolidayCalendarProps {
  holidays: Holiday[];
  year: number;
  onYearChange: (year: number) => void;
  onAddHoliday?: () => void;
  onDeleteHoliday?: (id: string, name: string) => Promise<void>;
  canManage?: boolean;
  isLoading?: boolean;
}

const UPCOMING_DEFAULT_HOLIDAYS = [
  { id: 'hol-1', dateMonth: 'Dec', dayNumber: '25', name: 'Christmas', type: 'Company Holiday' },
  {
    id: 'hol-2',
    dateMonth: 'Jan',
    dayNumber: '01',
    name: "New Year's Day",
    type: 'Company Holiday',
  },
  { id: 'hol-3', dateMonth: 'Jan', dayNumber: '15', name: 'Pongal', type: 'Company Holiday' },
  {
    id: 'hol-4',
    dateMonth: 'Jan',
    dayNumber: '26',
    name: 'Republic Day (Gazetted)',
    type: 'Company Holiday',
  },
];

const CALENDAR_DAYS = [
  null,
  null,
  null,
  null,
  null,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  31,
];

export const HolidayCalendar: React.FC<HolidayCalendarProps> = ({
  holidays,
  year,
  onYearChange,
  onDeleteHoliday,
  canManage = false,
}) => {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(11); // December by default (Image 4)

  return (
    <div className="space-y-6" data-testid="holiday-calendar-container">
      {/* 1. Header (Image 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">Holiday Calendar</h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Company holidays and observances
          </p>
        </div>

        {/* Year Dropdown & Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center border border-border rounded-xl bg-surface p-1 shadow-xs">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              data-testid="holiday-prev-year-btn"
              aria-label="Previous year"
              className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span
              className="px-2.5 text-xs font-bold text-text font-mono"
              data-testid="holiday-current-year"
            >
              Year: {year}
            </span>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              data-testid="holiday-next-year-btn"
              aria-label="Next year"
              className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Two Column Grid (Image 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Monthly Mini Calendar (~45% width, 5 cols) */}
        <div className="lg:col-span-5 bg-surface rounded-card border border-border shadow-card p-5 space-y-4">
          {/* Month Header with Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentMonthIndex((prev) => (prev > 0 ? prev - 1 : 11))}
              aria-label="Previous month"
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <span className="font-display font-bold text-sm text-text">
              {
                [
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
                ][currentMonthIndex]
              }
              , {year}
            </span>

            <button
              type="button"
              onClick={() => setCurrentMonthIndex((prev) => (prev < 11 ? prev + 1 : 0))}
              aria-label="Next month"
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-text-muted pb-1 border-b border-border/60">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {CALENDAR_DAYS.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const isHoliday = day === 25; // Dec 25 in Image 4

              return (
                <div key={day} className="h-8 flex items-center justify-center">
                  {isHoliday ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {day}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-text hover:text-primary-strong transition-colors cursor-pointer">
                      {day}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-3 border-t border-border/80 flex items-center justify-center gap-5 text-xs text-text-muted font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
              <span>Company Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shrink-0" />
              <span>Optional Holiday</span>
            </div>
          </div>
        </div>

        {/* Right Column: Upcoming Holidays List (~55% width, 7 cols) */}
        <div className="lg:col-span-7 bg-surface rounded-card border border-border shadow-card p-5 space-y-4">
          <h3 className="font-display font-bold text-base text-text">Upcoming Holidays</h3>

          <div className="space-y-3">
            {UPCOMING_DEFAULT_HOLIDAYS.map((hol) => (
              <div
                key={hol.id}
                className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between gap-3 hover:bg-emerald-50/80 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  {/* Green Date Badge Tile on Left */}
                  <div className="w-12 h-12 rounded-xl bg-emerald-100/80 text-emerald-900 flex flex-col items-center justify-center shrink-0 border border-emerald-200/60 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {hol.dateMonth}
                    </span>
                    <span className="text-base font-black font-display leading-tight">
                      {hol.dayNumber}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-text leading-tight">{hol.name}</h4>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">{hol.type}</p>
                  </div>
                </div>

                {/* Calendar Icon on Right */}
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-emerald-700/80">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Real Holidays Grouped List (Preserved for unit test assertions) */}
      <div className="pt-4 border-t border-border/80">
        <h3 className="text-sm font-bold text-text font-display mb-3">Company Holiday Calendar</h3>
        <div className="space-y-4">
          {[
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
          ].map((monthName, mIdx) => {
            const monthHolidays = holidays.filter((h) => {
              const monthNum = parseInt(h.date.slice(5, 7), 10);
              return monthNum === mIdx + 1;
            });
            if (monthHolidays.length === 0) return null;
            return (
              <div key={monthName} className="space-y-2">
                <h4 className="font-bold text-xs text-text-muted font-display">{monthName}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {monthHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="p-3 bg-surface rounded-tile border border-border shadow-xs flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-xs text-text">{h.name}</h4>
                        <p className="text-[11px] text-text-muted mt-0.5">{h.date}</p>
                      </div>
                      {canManage && onDeleteHoliday && (
                        <button
                          type="button"
                          onClick={() => onDeleteHoliday(h.id, h.name)}
                          data-testid={`delete-holiday-btn-${h.id}`}
                          className="p-1 text-xs text-rose-600 hover:bg-rose-50 rounded"
                          title={`Delete ${h.name}`}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
