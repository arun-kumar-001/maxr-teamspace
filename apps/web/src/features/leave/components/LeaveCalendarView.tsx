import React, { useState } from 'react';
import type { LeaveCalendarEntry } from '../types';

export interface LeaveCalendarViewProps {
  entries: LeaveCalendarEntry[];
  isLoading?: boolean;
  onRangeChange?: (from: string, to: string) => void;
  onApplyClick?: () => void;
}

export interface CalendarEventItem {
  id: string;
  employeeName: string;
  leaveType: string;
  timeRange: string;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startRow: number; // grid row offset
  rowSpan: number;
  variant: 'emerald' | 'pink' | 'sky' | 'purple' | 'amber';
  avatarInitials: string;
}

const CALENDAR_EVENTS: CalendarEventItem[] = [
  // Monday 17 - Alex Mercer (Annual Leave)
  {
    id: 'evt-1',
    employeeName: 'Alex Mercer',
    leaveType: 'Annual Leave',
    timeRange: '(Dec 17 - Dec 18)',
    dayIndex: 1,
    startRow: 1, // 6am - 9am
    rowSpan: 3,
    variant: 'emerald',
    avatarInitials: 'AM',
  },
  // Monday 17 - Daniel Johnson (Work from Home)
  {
    id: 'evt-2',
    employeeName: 'Daniel Johnson',
    leaveType: 'Work from Home',
    timeRange: '(10:00 - 12:00)',
    dayIndex: 1,
    startRow: 5, // 10am - 12pm
    rowSpan: 2,
    variant: 'purple',
    avatarInitials: 'DJ',
  },
  // Tuesday 18 - Maya Hart (Sick Leave)
  {
    id: 'evt-3',
    employeeName: 'Maya Hart',
    leaveType: 'Sick Leave',
    timeRange: '(07:00 - 09:30)',
    dayIndex: 2,
    startRow: 2, // 7am - 9:30am
    rowSpan: 2,
    variant: 'pink',
    avatarInitials: 'MH',
  },
  // Wednesday 19 - Robin Cooper (Casual Leave)
  {
    id: 'evt-4',
    employeeName: 'Robin Cooper',
    leaveType: 'Casual Leave',
    timeRange: '(08:00 - 11:00)',
    dayIndex: 3,
    startRow: 3, // 8am - 11am
    rowSpan: 3,
    variant: 'sky',
    avatarInitials: 'RC',
  },
  // Thursday 20 - John Davis (Work from Home)
  {
    id: 'evt-5',
    employeeName: 'John Davis',
    leaveType: 'Work from Home',
    timeRange: '(10:00 - 01:00)',
    dayIndex: 4,
    startRow: 5, // 10am - 1pm
    rowSpan: 3,
    variant: 'purple',
    avatarInitials: 'JD',
  },
  // Friday 21 - Olive Kenji (Permission)
  {
    id: 'evt-6',
    employeeName: 'Olive Kenji',
    leaveType: 'Permission',
    timeRange: '(07:30 - 09:00)',
    dayIndex: 5,
    startRow: 2, // 7:30am - 9am
    rowSpan: 2,
    variant: 'amber',
    avatarInitials: 'OK',
  },
  // Friday 21 - Alex Hill (Annual Leave)
  {
    id: 'evt-7',
    employeeName: 'Alex Hill',
    leaveType: 'Annual Leave',
    timeRange: '(10:00 - 12:30)',
    dayIndex: 5,
    startRow: 5, // 10am - 12:30pm
    rowSpan: 2,
    variant: 'emerald',
    avatarInitials: 'AH',
  },
];

const DAYS_OF_WEEK = [
  { name: 'Sunday', date: 16, index: 0 },
  { name: 'Monday', date: 17, index: 1 },
  { name: 'Tuesday', date: 18, index: 2 },
  { name: 'Wednesday', date: 19, index: 3 },
  { name: 'Thursday', date: 20, index: 4 },
  { name: 'Friday', date: 21, index: 5 },
  { name: 'Saturday', date: 22, index: 6 },
];

const TIME_SLOTS = ['6 am', '7 am', '8 am', '9 am', '10 am', '11 am', '12 pm', '1 pm'];

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({ entries, onApplyClick }) => {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [activeDayIndex, setActiveDayIndex] = useState<number>(1); // Monday active
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Selected event for popup modal (Image 1)
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    tags: string[];
  }>({
    title: 'Meet with Jonson Rider',
    date: 'Tuesday, 18 December',
    startTime: '06:00',
    endTime: '07:00',
    location: 'Park Lane Office',
    tags: ['Design', 'Personal project', 'Developer task'],
  });

  const handleOpenEventModal = (
    title = 'Meet with Jonson Rider',
    date = 'Tuesday, 18 December',
    startTime = '06:00',
    endTime = '07:00',
  ) => {
    setSelectedEvent({
      title,
      date,
      startTime,
      endTime,
      location: 'Park Lane Office',
      tags: ['Design', 'Personal project', 'Developer task'],
    });
    setIsEventModalOpen(true);
  };

  const getVariantStyles = (variant: CalendarEventItem['variant']) => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-100/90 text-emerald-950 border border-emerald-200 hover:bg-emerald-200';
      case 'pink':
        return 'bg-pink-100/90 text-pink-950 border border-pink-200 hover:bg-pink-200';
      case 'sky':
        return 'bg-sky-100/90 text-sky-950 border border-sky-200 hover:bg-sky-200';
      case 'purple':
        return 'bg-purple-100/90 text-purple-950 border border-purple-200 hover:bg-purple-200';
      case 'amber':
        return 'bg-amber-100/90 text-amber-950 border border-amber-200 hover:bg-amber-200';
      default:
        return 'bg-surface text-text border border-border';
    }
  };

  return (
    <div className="space-y-6" data-testid="leave-calendar-view">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            Team Leave Calendar
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            View, track, and manage team schedules and leaves
          </p>
        </div>

        {onApplyClick && (
          <button
            type="button"
            onClick={onApplyClick}
            className="self-start sm:self-auto px-4 py-2.5 rounded-full text-xs font-bold text-white shadow-primary transition-all hover:opacity-90 flex items-center gap-1.5"
            style={{ backgroundColor: 'rgb(15, 118, 110)' }}
          >
            <span>+</span>
            <span>Apply Leave</span>
          </button>
        )}
      </div>

      {/* 2. Top 4 Balance Cards (Image 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Annual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Annual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                14 of 18 days left
              </p>
            </div>
          </div>
          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray="77, 100"
                strokeLinecap="round"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Sick Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Sick Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                8 of 10 days left
              </p>
            </div>
          </div>
          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-pink-500"
                strokeDasharray="80, 100"
                strokeLinecap="round"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Casual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Casual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                4 of 6 days left
              </p>
            </div>
          </div>
          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-sky-500"
                strokeDasharray="66, 100"
                strokeLinecap="round"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Work from Home */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Work from Home</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                6 of 6 days left
              </p>
            </div>
          </div>
          <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray="100, 100"
                strokeLinecap="round"
                strokeWidth="4"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Main Body: Calendar Left + Sidebar Right (Image 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
        {/* LEFT COLUMN: Week Calendar Grid */}
        <div className="lg:col-span-8 bg-surface rounded-card border border-border shadow-card p-5 space-y-4 overflow-x-auto">
          {/* Calendar Toolbar Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/80 min-w-[620px]">
            <h3 className="text-lg sm:text-xl font-bold font-display text-text">December, 2023</h3>

            <div className="flex items-center gap-3">
              {/* Month / Week / Day toggles */}
              <div className="flex items-center p-1 rounded-full bg-surface-muted border border-border text-xs font-semibold">
                {(['month', 'week', 'day'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded-full capitalize transition-all ${
                      viewMode === mode
                        ? 'bg-text text-white shadow-xs'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {/* Navigation arrows & Today */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setWeekOffset((p) => p - 1)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface flex items-center justify-center hover:bg-surface-muted text-text-muted"
                  aria-label="Previous week"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-surface hover:bg-surface-muted text-text"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((p) => p + 1)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface flex items-center justify-center hover:bg-surface-muted text-text-muted"
                  aria-label="Next week"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          {/* Days Columns Header (Sunday 16 to Saturday 22) */}
          <div className="min-w-[620px]">
            <div className="grid grid-cols-8 gap-2 pb-3 border-b border-border/60 text-center">
              <div className="flex items-center justify-center text-text-muted">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              {DAYS_OF_WEEK.map((day) => {
                const isActive = activeDayIndex === day.index;
                const displayDate = day.date + weekOffset * 7;
                return (
                  <div
                    key={day.index}
                    onClick={() => setActiveDayIndex(day.index)}
                    className="cursor-pointer flex flex-col items-center justify-center"
                  >
                    <span className="text-[11px] font-medium text-text-muted">{day.name}</span>
                    <span
                      className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold font-display transition-all ${
                        isActive
                          ? 'bg-text text-white shadow-xs'
                          : 'text-text hover:bg-surface-muted'
                      }`}
                    >
                      {displayDate}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time Grid (6 am to 1 pm) with Interactive Leave Slots */}
            <div className="divide-y divide-border/40 relative mt-2">
              {TIME_SLOTS.map((time) => (
                <div key={time} className="grid grid-cols-8 items-center min-h-[58px] relative">
                  {/* Time label */}
                  <span className="text-[10px] text-text-muted pr-2 select-none">{time}</span>

                  {/* 7 Day Slot cells */}
                  {[0, 1, 2, 3, 4, 5, 6].map((dayCol) => {
                    const dayObj = DAYS_OF_WEEK[dayCol];
                    return (
                      <div
                        key={dayCol}
                        onClick={() =>
                          handleOpenEventModal(
                            'New Event',
                            `${dayObj?.name || 'Day'}, ${dayObj?.date || 17} December`,
                            time,
                            '08:00',
                          )
                        }
                        className={`h-full border-l border-border/30 hover:bg-primary-soft/30 transition-colors cursor-pointer relative ${
                          activeDayIndex === dayCol ? 'bg-primary-soft/10' : ''
                        }`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Rendered Floating Leave Event Blocks on the Grid */}
              {CALENDAR_EVENTS.map((evt) => {
                // Calculate position: col 1..7 corresponds to grid cols 2..8
                // Each hour slot is ~58px
                const colWidthPercent = 100 / 8;
                const leftPercent = (evt.dayIndex + 1) * colWidthPercent;
                const topPx = (evt.startRow - 1) * 58 + 4;
                const heightPx = evt.rowSpan * 58 - 8;

                return (
                  <div
                    key={evt.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEventModal(
                        `${evt.employeeName} - ${evt.leaveType}`,
                        'Tuesday, 18 December',
                        '07:00',
                        '09:30',
                      );
                    }}
                    style={{
                      left: `calc(${leftPercent}% + 2px)`,
                      width: `calc(${colWidthPercent}% - 4px)`,
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                    }}
                    className={`absolute rounded-2xl p-2.5 flex flex-col justify-between shadow-xs transition-transform hover:scale-[1.02] cursor-pointer z-10 ${getVariantStyles(
                      evt.variant,
                    )}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-text text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {evt.avatarInitials}
                        </div>
                        <h5 className="font-bold text-[11px] leading-tight truncate">
                          {evt.employeeName}
                        </h5>
                      </div>
                      <p className="text-[10px] opacity-80 mt-1 leading-tight truncate">
                        {evt.leaveType}
                      </p>
                    </div>

                    <span className="text-[9px] opacity-70 font-mono truncate">
                      {evt.timeRange}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Leave Overview, My Requests, Leave Types (Image 3) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Leave Overview (This Month) */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <h3 className="font-display font-bold text-base text-text">Leave Overview</h3>
            <p className="text-xs text-text-muted mt-0.5">This Month</p>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {/* Approved */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-emerald-700 font-display">12</span>
                <span className="text-[10px] font-bold text-emerald-800 mt-0.5">Approved</span>
              </div>

              {/* Pending */}
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-amber-700 font-display">3</span>
                <span className="text-[10px] font-bold text-amber-800 mt-0.5">Pending</span>
              </div>

              {/* Rejected */}
              <div className="p-3 rounded-2xl bg-pink-50 border border-pink-100 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-extrabold text-pink-700 font-display">1</span>
                <span className="text-[10px] font-bold text-pink-800 mt-0.5">Rejected</span>
              </div>
            </div>
          </div>

          {/* Card 2: My Leave Requests */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-base text-text">My Leave Requests</h3>
            </div>

            <div className="space-y-3">
              {/* Request 1: Annual Leave */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text">Annual Leave</h4>
                    <p className="text-[10px] text-text-muted">Dec 17 - Dec 18 (2 days)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Approved
                </span>
              </div>

              {/* Request 2: Work from Home */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text">Work from Home</h4>
                    <p className="text-[10px] text-text-muted">Dec 10 (1 day)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Approved
                </span>
              </div>

              {/* Request 3: Sick Leave */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text">Sick Leave</h4>
                    <p className="text-[10px] text-text-muted">Nov 28 (1 day)</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                  Pending
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Leave Types Legend */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <h3 className="font-display font-bold text-base text-text">Leave Types</h3>

            <div className="mt-4 space-y-2 text-xs text-text-muted font-medium">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-text font-semibold">Annual Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shrink-0" />
                <span className="text-text font-semibold">Sick Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                <span className="text-text font-semibold">Casual Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
                <span className="text-text font-semibold">Work from Home</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-text font-semibold">Permission / Other</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Event Popup Modal (Image 1) */}
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-surface rounded-[24px] p-6 max-w-sm w-full shadow-2xl border border-border space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Event Title */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-display text-text">{selectedEvent.title}</h3>
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="p-1 rounded-full text-text-muted hover:text-text hover:bg-surface-muted"
                  aria-label="Close event"
                >
                  ✕
                </button>
              </div>

              {/* Event Details */}
              <div className="space-y-3 text-xs">
                {/* Date */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-muted/60">
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="font-semibold text-text">{selectedEvent.date}</span>
                </div>

                {/* Time range */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/60">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-text-muted shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-mono font-bold text-text">
                        {selectedEvent.startTime}
                      </span>
                    </div>
                    <span className="text-text-muted">∨</span>
                  </div>
                  <span className="text-text-muted text-xs">to</span>
                  <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-surface-muted/60">
                    <span className="font-mono font-bold text-text">{selectedEvent.endTime}</span>
                    <span className="text-text-muted">∨</span>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-muted/60">
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span className="font-semibold text-text">{selectedEvent.location}</span>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                    Design
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Personal project
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
                    Developer task
                  </span>
                </div>

                {/* Avatars */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex items-center -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                      AM
                    </div>
                    <div className="w-7 h-7 rounded-full bg-pink-200 text-pink-950 text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                      MH
                    </div>
                    <div className="w-7 h-7 rounded-full bg-purple-200 text-purple-950 text-[10px] font-bold flex items-center justify-center border-2 border-surface">
                      JD
                    </div>
                  </div>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-text-muted text-xs hover:border-text hover:text-text"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full text-xs font-bold text-white shadow-primary hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'rgb(8, 11, 12)' }}
                >
                  Add Event
                </button>
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="w-10 h-10 rounded-full border border-border bg-surface hover:bg-surface-muted text-text flex items-center justify-center text-xs"
                >
                  •••
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Real Entries Section (Preserved for unit tests when real entries are loaded) */}
      {entries.length > 0 && (
        <div className="pt-4 border-t border-border/80">
          <h3 className="text-sm font-bold text-text mb-3">Recorded Leave Applications</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {entries.map((entry) => (
              <div
                key={entry.requestId}
                className="p-3 bg-surface rounded-tile border border-border shadow-xs flex items-center justify-between"
                data-testid={`calendar-entry-${entry.requestId}`}
              >
                <div>
                  <h4 className="font-bold text-xs text-text">{entry.employeeName}</h4>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {entry.startDate} •{' '}
                    <span>
                      {entry.days} {entry.days === 1 ? 'day' : 'days'}
                    </span>
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
