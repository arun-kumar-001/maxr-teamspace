import { useState } from 'react';

export interface LeaveScheduleItem {
  id: string;
  employeeName: string;
  leaveType: string;
  durationLabel: string;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startHour: number; // 6.5 = 6:30am
  durationHours: number;
  variant: 'mint' | 'pink' | 'blue' | 'purple' | 'yellow';
  avatarInitials: string;
  avatarBg: string;
}

const SCHEDULE_ITEMS: LeaveScheduleItem[] = [
  // Sunday (16)
  {
    id: 'leave-1',
    employeeName: 'Alex Mercer',
    leaveType: 'Annual Leave',
    durationLabel: '(Dec 17 - Dec 18)',
    dayIndex: 0,
    startHour: 6.5,
    durationHours: 3.0,
    variant: 'mint',
    avatarInitials: 'AM',
    avatarBg: 'bg-emerald-200 text-emerald-950',
  },
  {
    id: 'leave-2',
    employeeName: 'Daniel Johnson',
    leaveType: 'Work from Home',
    durationLabel: '(10:00 - 12:00)',
    dayIndex: 0,
    startHour: 10.5,
    durationHours: 2.0,
    variant: 'purple',
    avatarInitials: 'DJ',
    avatarBg: 'bg-purple-200 text-purple-950',
  },

  // Monday (17)
  {
    id: 'leave-3',
    employeeName: 'Maya Hart',
    leaveType: 'Sick Leave',
    durationLabel: '(07:00 - 09:30)',
    dayIndex: 1,
    startHour: 7.0,
    durationHours: 2.5,
    variant: 'pink',
    avatarInitials: 'MH',
    avatarBg: 'bg-pink-200 text-pink-950',
  },

  // Tuesday (18)
  {
    id: 'leave-4',
    employeeName: 'Robin Cooper',
    leaveType: 'Casual Leave',
    durationLabel: '(08:00 - 11:00)',
    dayIndex: 2,
    startHour: 8.0,
    durationHours: 3.0,
    variant: 'blue',
    avatarInitials: 'RC',
    avatarBg: 'bg-blue-200 text-blue-950',
  },

  // Wednesday (19)
  {
    id: 'leave-5',
    employeeName: 'John Davis',
    leaveType: 'Work from Home',
    durationLabel: '(10:00 - 01:00)',
    dayIndex: 3,
    startHour: 10.5,
    durationHours: 2.5,
    variant: 'purple',
    avatarInitials: 'JD',
    avatarBg: 'bg-purple-200 text-purple-950',
  },

  // Thursday (20)
  {
    id: 'leave-6',
    employeeName: 'Olive Kenji',
    leaveType: 'Permission',
    durationLabel: '(07:30 - 09:00)',
    dayIndex: 4,
    startHour: 7.5,
    durationHours: 2.0,
    variant: 'yellow',
    avatarInitials: 'OK',
    avatarBg: 'bg-amber-200 text-amber-950',
  },
  {
    id: 'leave-7',
    employeeName: 'Alex Hill',
    leaveType: 'Annual Leave',
    durationLabel: '(10:00 - 12:30)',
    dayIndex: 4,
    startHour: 10.0,
    durationHours: 2.5,
    variant: 'mint',
    avatarInitials: 'AH',
    avatarBg: 'bg-emerald-200 text-emerald-950',
  },
];

const DAYS_OF_WEEK = [
  { name: 'Sunday', date: 16, dayIndex: 0 },
  { name: 'Monday', date: 17, dayIndex: 1 },
  { name: 'Tuesday', date: 18, dayIndex: 2 },
  { name: 'Wednesday', date: 19, dayIndex: 3 },
  { name: 'Thursday', date: 20, dayIndex: 4 },
  { name: 'Friday', date: 21, dayIndex: 5 },
  { name: 'Saturday', date: 22, dayIndex: 6 },
];

const TIME_ROWS = [
  { label: '6 am', hour: 6 },
  { label: '7 am', hour: 7 },
  { label: '8 am', hour: 8 },
  { label: '9 am', hour: 9 },
  { label: '10 am', hour: 10 },
  { label: '11 am', hour: 11 },
  { label: '12 pm', hour: 12 },
  { label: '1 pm', hour: 13 },
];

export interface MyLeaveDashboardProps {
  onApplyClick?: () => void;
}

export function MyLeaveDashboard({ onApplyClick }: MyLeaveDashboardProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [activeDayIndex, setActiveDayIndex] = useState<number>(1); // Monday active like Image 1
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  const getVariantStyles = (variant: LeaveScheduleItem['variant']) => {
    switch (variant) {
      case 'mint':
        return 'bg-emerald-100 text-emerald-950 border border-emerald-200 hover:bg-emerald-200/90';
      case 'pink':
        return 'bg-pink-100 text-pink-950 border border-pink-200 hover:bg-pink-200/90';
      case 'blue':
        return 'bg-blue-100 text-blue-950 border border-blue-200 hover:bg-blue-200/90';
      case 'purple':
        return 'bg-purple-100 text-purple-950 border border-purple-200 hover:bg-purple-200/90';
      case 'yellow':
        return 'bg-amber-100 text-amber-950 border border-amber-200 hover:bg-amber-200/90';
      default:
        return 'bg-surface text-text border border-border';
    }
  };

  return (
    <div className="space-y-6" data-testid="my-leave-dashboard">
      {/* 1. TOP HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display tracking-tight">
            My Leave
          </h1>
          <p className="text-sm text-text-muted mt-1 font-medium">
            View, apply and track your leaves
          </p>
        </div>

        <button
          type="button"
          onClick={onApplyClick}
          data-testid="dashboard-apply-leave-btn"
          className="self-start sm:self-auto px-5 py-2.5 rounded-full bg-primary-deep hover:bg-primary-deep/90 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-all min-h-[44px]"
        >
          <span className="text-base font-bold">+</span>
          <span>Apply Leave</span>
        </button>
      </div>

      {/* 2. TOP METRIC STRIP (4 BALANCE CARDS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Annual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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
          {/* Circular Progress Ring (77%) */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-primary-strong"
                strokeDasharray="77, 100"
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Sick Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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
          {/* Circular Progress Ring (80%) */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-primary-strong"
                strokeDasharray="80, 100"
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Casual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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
          {/* Circular Progress Ring (66%) */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-border"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-primary-strong"
                strokeDasharray="66, 100"
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Work from Home */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
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
          {/* Circular Progress Ring (100%) */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-primary-strong"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT (2 COLUMNS: CALENDAR + RIGHT PANEL) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT / CENTER COLUMN: WEEKLY LEAVE SCHEDULE CALENDAR (~68% width) */}
        <div className="xl:col-span-8 bg-surface rounded-card border border-border shadow-card p-4 sm:p-6 overflow-hidden">
          {/* Calendar Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border/70">
            {/* Title: December, 2023 */}
            <h2 className="font-display text-2xl font-bold text-text tracking-tight">
              December, 2023
            </h2>

            {/* View Mode Pills: Month / Week / Day */}
            <div className="flex items-center bg-surface-muted p-1 rounded-full border border-border self-start md:self-auto">
              {(['month', 'week', 'day'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-text text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                  data-testid={`leave-calendar-view-${mode}`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Date navigation controls */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                aria-label="Previous week"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-muted transition-colors shadow-sm"
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
              <button
                type="button"
                onClick={() => setCurrentWeekOffset(0)}
                className="px-3.5 py-1.5 rounded-lg border border-border bg-surface-muted text-xs font-bold text-text hover:bg-surface transition-colors shadow-sm"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                aria-label="Next week"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-muted transition-colors shadow-sm"
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
          </div>

          {/* Days Header Row (7 Days) */}
          <div className="grid grid-cols-8 gap-2 pt-4 pb-3 items-center">
            {/* Calendar Mini Tile Icon (Left Corner) */}
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-text-muted shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            {/* 7 Days */}
            {DAYS_OF_WEEK.map((day) => {
              const isActive = activeDayIndex === day.dayIndex;
              const displayDate = day.date + currentWeekOffset * 7;
              return (
                <button
                  key={day.dayIndex}
                  type="button"
                  onClick={() => setActiveDayIndex(day.dayIndex)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-text text-white shadow-md transform -translate-y-0.5'
                      : 'bg-surface-muted/60 text-text-muted hover:bg-surface-muted hover:text-text'
                  }`}
                >
                  <span
                    className={`text-[10px] font-medium ${isActive ? 'text-white/80' : 'text-text-muted'}`}
                  >
                    {day.name}
                  </span>
                  <span
                    className={`text-base sm:text-lg font-bold font-display ${isActive ? 'text-white' : 'text-text'}`}
                  >
                    {displayDate}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Grid with Hourly Rows & Leave Cards */}
          <div className="relative mt-2 border-t border-border/80 pt-2 min-h-[520px] overflow-x-auto">
            <div className="min-w-[620px] relative">
              {/* Horizontal hour lines */}
              {TIME_ROWS.map((row) => (
                <div
                  key={row.hour}
                  className="grid grid-cols-8 gap-2 items-center h-16 border-b border-border/40 relative"
                >
                  <div className="text-[11px] font-medium text-text-muted/80 pr-2 text-right select-none">
                    {row.label}
                  </div>
                  <div className="col-span-7 h-full w-full" />
                </div>
              ))}

              {/* Vertical day columns */}
              <div className="absolute inset-0 grid grid-cols-8 gap-2 pointer-events-none">
                <div />
                {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                  <div
                    key={col}
                    className={`h-full border-r border-border/30 ${
                      activeDayIndex === col ? 'bg-primary-soft/10' : ''
                    }`}
                  />
                ))}
              </div>

              {/* Leave Cards Rendered in Schedule Grid */}
              {SCHEDULE_ITEMS.map((item) => {
                const leftPercent = 12.5 + item.dayIndex * 12.5 + 0.3;
                const topPx = (item.startHour - 6) * 64 + 4;
                const heightPx = Math.max(item.durationHours * 64 - 8, 44);

                return (
                  <div
                    key={item.id}
                    style={{
                      left: `${leftPercent}%`,
                      top: `${topPx}px`,
                      height: `${heightPx}px`,
                      width: '11.8%',
                    }}
                    className={`absolute p-2 rounded-xl transition-all duration-200 flex flex-col justify-start overflow-hidden shadow-xs hover:shadow-md hover:scale-[1.02] z-10 cursor-pointer ${getVariantStyles(
                      item.variant,
                    )}`}
                    data-testid={`schedule-item-${item.id}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-5 h-5 rounded-full ${item.avatarBg} text-[9px] font-bold flex items-center justify-center shrink-0 shadow-2xs ring-1 ring-white/50`}
                      >
                        {item.avatarInitials}
                      </div>
                      <span className="font-bold text-[11px] leading-tight truncate">
                        {item.employeeName}
                      </span>
                    </div>

                    <p className="text-[10px] font-semibold opacity-90 mt-1 truncate">
                      {item.leaveType}
                    </p>
                    <p className="text-[9px] opacity-75 font-medium truncate">
                      {item.durationLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 STACKED PANELS (~32% width) */}
        <div className="xl:col-span-4 space-y-5">
          {/* Card 1: Leave Overview (This Month) */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <h3 className="font-display font-bold text-base text-text">Leave Overview</h3>
            <p className="text-xs text-text-muted mt-0.5">This Month</p>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              {/* Approved */}
              <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black font-display text-emerald-700">12</span>
                <span className="text-[11px] font-semibold text-emerald-700 mt-0.5">Approved</span>
              </div>

              {/* Pending */}
              <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black font-display text-amber-700">3</span>
                <span className="text-[11px] font-semibold text-amber-700 mt-0.5">Pending</span>
              </div>

              {/* Rejected */}
              <div className="bg-pink-50/80 border border-pink-100 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black font-display text-pink-700">1</span>
                <span className="text-[11px] font-semibold text-pink-700 mt-0.5">Rejected</span>
              </div>
            </div>
          </div>

          {/* Card 2: My Leave Requests */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <h3 className="font-display font-bold text-base text-text">My Leave Requests</h3>

            <div className="mt-4 space-y-3.5">
              {/* Request 1: Annual Leave */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-[11px] text-text-muted mt-0.5">Dec 17 - Dec 18 (2 days)</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Approved
                </span>
              </div>

              {/* Request 2: Work from Home */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-[11px] text-text-muted mt-0.5">Dec 10 (1 day)</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  Approved
                </span>
              </div>

              {/* Request 3: Sick Leave */}
              <div className="flex items-center justify-between gap-3 p-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="text-[11px] text-text-muted mt-0.5">Nov 28 (1 day)</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                  Pending
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Leave Types Legend */}
          <div className="bg-surface rounded-card border border-border shadow-card p-5">
            <h3 className="font-display font-bold text-base text-text">Leave Types</h3>

            <div className="mt-4 space-y-2.5 text-xs text-text-muted font-medium">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-text font-semibold">Annual Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-pink-400 shrink-0" />
                <span className="text-text font-semibold">Sick Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
                <span className="text-text font-semibold">Casual Leave</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-purple-400 shrink-0" />
                <span className="text-text font-semibold">Work from Home</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                <span className="text-text font-semibold">Permission / Other</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
