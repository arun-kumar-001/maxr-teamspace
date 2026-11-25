import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui';
import type { AttendanceRecord, AttendanceStatus, TodayAttendanceSummary } from '../types';

export type CalendarViewMode = 'month' | 'week' | 'day';

export type DayCategory = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'weekly_off';

interface DaySummaryItem {
  dateStr: string;
  date: Date;
  category: DayCategory;
  label: string;
  checkInLabel: string;
  checkOutLabel: string;
  hoursLabel: string;
  breakLabel: string;
  lateLabel: string;
  notesLabel: string;
  record: AttendanceRecord | null;
}

export interface MyAttendanceCalendarBoardProps {
  records: AttendanceRecord[];
  todaySummary: TodayAttendanceSummary | null;
  onOpenCorrectionModal: (record: AttendanceRecord) => void;
  onGoToCheckIn: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MOBILE_WEEK_TIME_AXIS = ['9 AM', '12 PM', '3 PM', '6 PM'] as const;

const DESKTOP_WEEK_TIME_AXIS = [
  '9 AM',
  '10 AM',
  '11 AM',
  '12 PM',
  '1 PM',
  '2 PM',
  '3 PM',
  '4 PM',
  '5 PM',
  '6 PM',
] as const;

const CATEGORY_STYLES: Record<
  DayCategory,
  {
    cardBg: string;
    cardBorder: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    dotColor: string;
    label: string;
  }
> = {
  present: {
    cardBg: 'rgb(220, 252, 231)',
    cardBorder: 'rgb(187, 247, 208)',
    badgeBg: 'rgb(220, 252, 231)',
    badgeText: 'rgb(21, 128, 61)',
    iconBg: 'rgb(22, 163, 74)',
    dotColor: 'rgb(22, 163, 74)',
    label: 'Present',
  },
  absent: {
    cardBg: 'rgb(254, 226, 226)',
    cardBorder: 'rgb(254, 202, 202)',
    badgeBg: 'rgb(254, 226, 226)',
    badgeText: 'rgb(185, 28, 28)',
    iconBg: 'rgb(220, 38, 38)',
    dotColor: 'rgb(220, 38, 38)',
    label: 'Absent',
  },
  late: {
    cardBg: 'rgb(254, 243, 199)',
    cardBorder: 'rgb(253, 230, 138)',
    badgeBg: 'rgb(254, 243, 199)',
    badgeText: 'rgb(180, 83, 9)',
    iconBg: 'rgb(217, 119, 6)',
    dotColor: 'rgb(217, 119, 6)',
    label: 'Late',
  },
  half_day: {
    cardBg: 'rgb(219, 234, 254)',
    cardBorder: 'rgb(191, 219, 254)',
    badgeBg: 'rgb(219, 234, 254)',
    badgeText: 'rgb(29, 78, 216)',
    iconBg: 'rgb(37, 99, 235)',
    dotColor: 'rgb(37, 99, 235)',
    label: 'Half Day',
  },
  leave: {
    cardBg: 'rgb(243, 232, 255)',
    cardBorder: 'rgb(233, 213, 255)',
    badgeBg: 'rgb(243, 232, 255)',
    badgeText: 'rgb(126, 34, 206)',
    iconBg: 'rgb(147, 51, 234)',
    dotColor: 'rgb(147, 51, 234)',
    label: 'Leave',
  },
  weekly_off: {
    cardBg: 'rgb(243, 244, 246)',
    cardBorder: 'rgb(229, 231, 235)',
    badgeBg: 'rgb(243, 244, 246)',
    badgeText: 'rgb(75, 85, 99)',
    iconBg: 'rgb(107, 114, 128)',
    dotColor: 'rgb(107, 114, 128)',
    label: 'Weekly Off',
  },
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatClockTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '\u2014';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function mapStatusToCategory(status: AttendanceStatus): DayCategory {
  switch (status) {
    case 'present':
      return 'present';
    case 'late':
      return 'late';
    case 'absent':
      return 'absent';
    case 'half_day':
      return 'half_day';
    case 'on_leave':
      return 'leave';
    default:
      return 'present';
  }
}

function StatusGlyph({ category }: { category: DayCategory }) {
  const style = CATEGORY_STYLES[category];
  if (category === 'weekly_off' || category === 'leave') {
    return (
      <span
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center shrink-0"
        style={{
          backgroundColor: category === 'leave' ? style.iconBg : 'transparent',
          color: category === 'leave' ? 'rgb(255, 255, 255)' : 'rgb(55, 65, 81)',
        }}
      >
        <svg
          className="w-3.5 h-3.5 sm:w-4 sm:h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </span>
    );
  }
  if (category === 'absent') {
    return (
      <span
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: style.iconBg }}
      >
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (category === 'late' || category === 'half_day') {
    return (
      <span
        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: style.iconBg }}
      >
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
      style={{ backgroundColor: style.iconBg }}
    >
      <svg
        className="w-3 h-3 sm:w-3.5 sm:h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
      >
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function CircularProgressRing({ percentage }: { percentage: number }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      width="42"
      height="42"
      viewBox="0 0 42 42"
      aria-label={`Attendance ${clamped.toFixed(0)} percent`}
      className="shrink-0"
    >
      <circle cx="21" cy="21" r={radius} fill="none" stroke="rgb(229, 231, 235)" strokeWidth="5" />
      <circle
        cx="21"
        cy="21"
        r={radius}
        fill="none"
        stroke="rgb(85, 205, 179)"
        strokeWidth="5"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 21 21)"
      />
    </svg>
  );
}

export function MyAttendanceCalendarBoard({
  records,
  todaySummary,
  onOpenCorrectionModal,
  onGoToCheckIn,
}: MyAttendanceCalendarBoardProps) {
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => toDateKey(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('week');
  const [popoverDateKey, setPopoverDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (!popoverDateKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverDateKey(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [popoverDateKey]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) {
      map.set(r.workDate, r);
    }
    if (todaySummary?.activeSession) {
      map.set(todaySummary.activeSession.workDate, todaySummary.activeSession);
    }
    return map;
  }, [records, todaySummary]);

  const buildDayItem = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return (d: Date): DaySummaryItem => {
      const key = toDateKey(d);
      const rec = recordMap.get(key) ?? null;
      const dow = d.getDay();

      if (rec) {
        const category = mapStatusToCategory(rec.status);
        const checkIn = formatClockTime(rec.checkInTime);
        const checkOut = formatClockTime(rec.checkOutTime);
        return {
          dateStr: key,
          date: d,
          category,
          label: CATEGORY_STYLES[category].label,
          checkInLabel: checkIn,
          checkOutLabel: checkOut,
          hoursLabel: formatDurationMinutes(rec.durationMinutes),
          breakLabel:
            rec.breakMinutes !== undefined && rec.breakMinutes !== null
              ? formatDurationMinutes(rec.breakMinutes)
              : '\u2014',
          lateLabel: category === 'late' ? 'Late check-in' : '\u2014',
          notesLabel: rec.notes?.trim() ? rec.notes : '\u2014',
          record: rec,
        };
      }

      if (dow === 0 || dow === 6) {
        return {
          dateStr: key,
          date: d,
          category: 'weekly_off',
          label: 'Weekly Off',
          checkInLabel: '\u2014',
          checkOutLabel: '\u2014',
          hoursLabel: '\u2014',
          breakLabel: '\u2014',
          lateLabel: '\u2014',
          notesLabel: '\u2014',
          record: null,
        };
      }

      const isPast = key < todayKey;
      return {
        dateStr: key,
        date: d,
        category: isPast ? 'absent' : 'weekly_off',
        label: isPast ? 'Absent' : 'Scheduled',
        checkInLabel: '\u2014',
        checkOutLabel: '\u2014',
        hoursLabel: '\u2014',
        breakLabel: '\u2014',
        lateLabel: '\u2014',
        notesLabel: '\u2014',
        record: null,
      };
    };
  }, [recordMap]);

  const monthStats = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let workingDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateArrivals = 0;
    let leaveDays = 0;

    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        workingDays += 1;
      }
      const rec = recordMap.get(toDateKey(d));
      if (!rec) continue;
      if (rec.status === 'absent') {
        absentDays += 1;
      } else if (rec.status === 'on_leave') {
        leaveDays += 1;
      } else {
        presentDays += 1;
        if (rec.status === 'late') lateArrivals += 1;
      }
    }

    const pct = workingDays > 0 ? Math.min(100, (presentDays / workingDays) * 100) : 0;
    return {
      workingDays,
      presentDays,
      absentDays,
      lateArrivals,
      leaveDays,
      pct,
      pctText: `${pct.toFixed(2)}%`,
    };
  }, [viewDate, recordMap]);

  const miniMonthCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
    return cells;
  }, [viewDate]);

  const weekDays = useMemo(() => {
    const start = new Date(viewDate);
    const day = start.getDay(); // 0: Sun, 1: Mon, ...
    const diffToMon = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMon);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return buildDayItem(d);
    });
  }, [viewDate, buildDayItem]);

  const monthViewDays = useMemo(
    () => miniMonthCells.map((d) => (d ? buildDayItem(d) : null)),
    [miniMonthCells, buildDayItem],
  );

  const selectedDayItem = useMemo(() => {
    const [y, m, day] = selectedDateKey.split('-').map(Number);
    return buildDayItem(new Date(y || new Date().getFullYear(), (m || 1) - 1, day || 1));
  }, [selectedDateKey, buildDayItem]);

  const popoverItem = useMemo(() => {
    if (!popoverDateKey) return null;
    const [y, m, day] = popoverDateKey.split('-').map(Number);
    return buildDayItem(new Date(y || new Date().getFullYear(), (m || 1) - 1, day || 1));
  }, [popoverDateKey, buildDayItem]);

  const handleShiftPeriod = (delta: number) => {
    const next = new Date(viewDate);
    if (calendarView === 'month') {
      next.setMonth(next.getMonth() + delta);
    } else if (calendarView === 'day') {
      next.setDate(next.getDate() + delta);
      setSelectedDateKey(toDateKey(next));
    } else {
      next.setDate(next.getDate() + delta * 7);
    }
    setViewDate(next);
  };

  const handleSelectDay = (date: Date, openPopover: boolean) => {
    const key = toDateKey(date);
    setSelectedDateKey(key);
    setViewDate(date);
    if (openPopover) {
      setPopoverDateKey(key);
    }
  };

  const mainMonthTitle = `${viewDate.toLocaleDateString('en-US', { month: 'long' })}, ${viewDate.getFullYear()}`;

  const kpiCards = [
    {
      label: 'Working Days',
      value: String(monthStats.workingDays),
      iconBg: 'rgb(243, 244, 246)',
      iconColor: 'rgb(55, 65, 81)',
      glyph: 'calendar' as const,
    },
    {
      label: 'Present',
      value: String(monthStats.presentDays),
      iconBg: 'rgb(220, 252, 231)',
      iconColor: 'rgb(22, 163, 74)',
      glyph: 'present' as const,
    },
    {
      label: 'Absent',
      value: String(monthStats.absentDays),
      iconBg: 'rgb(254, 226, 226)',
      iconColor: 'rgb(220, 38, 38)',
      glyph: 'absent' as const,
    },
    {
      label: 'Late Arrivals',
      value: String(monthStats.lateArrivals),
      iconBg: 'rgb(254, 243, 199)',
      iconColor: 'rgb(217, 119, 6)',
      glyph: 'late' as const,
    },
    {
      label: 'Leave Days',
      value: String(monthStats.leaveDays),
      iconBg: 'rgb(243, 232, 255)',
      iconColor: 'rgb(147, 51, 234)',
      glyph: 'leave' as const,
    },
    {
      label: 'Attendance',
      value: monthStats.pctText,
      iconBg: 'transparent',
      iconColor: 'rgb(85, 205, 179)',
      glyph: 'ring' as const,
    },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Main Attendance Calendar (Expanded Full-Width) */}
      <div className="w-full space-y-3 sm:space-y-4 relative">
        {/* Calendar Header Bar: Month/Year on left, View Switcher on right */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base sm:text-xl font-bold font-display text-text">
            {mainMonthTitle}
          </h2>

          {/* Month / Week / Day View Switcher */}
          <div
            className="inline-flex rounded-xl border border-border/80 p-0.5 bg-white shadow-xs"
            role="group"
            aria-label="Calendar view mode"
          >
            {(['month', 'week', 'day'] as CalendarViewMode[]).map((mode) => {
              const active = calendarView === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCalendarView(mode)}
                  className={`px-3 sm:px-3.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer min-h-[34px] ${
                    active ? 'bg-primary text-text shadow-xs' : 'text-text-muted hover:text-text'
                  }`}
                  data-testid={`my-calendar-view-${mode}`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* 6 KPI Summary Cards: 2 cols on mobile, 3 on tablet, 6 on desktop */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5"
          data-testid="my-attendance-kpi-grid"
        >
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="p-2.5 sm:p-3 rounded-2xl border border-border/80 bg-white flex items-center gap-2.5 shadow-xs"
            >
              {card.glyph === 'ring' ? (
                <CircularProgressRing percentage={monthStats.pct} />
              ) : (
                <span
                  className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
                  style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                >
                  {card.glyph === 'present' ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : card.glyph === 'absent' ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  ) : card.glyph === 'late' ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 2" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  )}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-text-muted leading-tight truncate">
                  {card.label}
                </p>
                <p className="text-base sm:text-lg font-bold font-display text-text tabular-nums leading-tight mt-0.5">
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Compact Navigation Controls Bar (Shifted below KPI cards) */}
        <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-border/80 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xs">
          <button
            type="button"
            aria-label="Previous period"
            onClick={() => handleShiftPeriod(-1)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-border/80 bg-white flex items-center justify-center text-sm font-bold text-text hover:bg-surface-muted cursor-pointer shrink-0 transition-colors"
          >
            &lsaquo;
          </button>

          <span className="text-xs sm:text-sm font-semibold text-text text-center truncate px-1">
            {calendarView === 'week'
              ? `${weekDays[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${weekDays[6]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : calendarView === 'month'
                ? `${viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
                : selectedDayItem.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setViewDate(now);
                setSelectedDateKey(toDateKey(now));
              }}
              className="px-2.5 sm:px-3 h-8 sm:h-9 rounded-lg border border-border/80 bg-white text-xs font-semibold text-text hover:bg-surface-muted cursor-pointer transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              aria-label="Next period"
              onClick={() => handleShiftPeriod(1)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-border/80 bg-white flex items-center justify-center text-sm font-bold text-text hover:bg-surface-muted cursor-pointer shrink-0 transition-colors"
            >
              &rsaquo;
            </button>
          </div>
        </div>

        {/* Main Calendar Body */}
        {calendarView === 'week' && (
          <div
            className="rounded-2xl border border-border/80 bg-white p-2 sm:p-3 md:p-4 shadow-xs"
            data-testid="my-attendance-week-grid"
          >
            {/* Weekday Column Headers Aligned with Time Column */}
            <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] sm:grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2 w-full mb-1.5">
              <div />
              {weekDays.map((item) => (
                <div key={`hdr-${item.dateStr}`} className="text-center min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold text-text truncate">
                    {item.date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className="text-[9px] sm:text-[11px] text-text-muted truncate">
                    {item.date.toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              ))}
            </div>

            {/* Left-Side Timer / Time Axis + 7 Equal Day Columns Without Horizontal Scrolling */}
            <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] sm:grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2 w-full items-stretch">
              {/* Left-Side Timer Column */}
              <div
                className="flex flex-col justify-between py-1 sm:py-3 text-[8px] sm:text-[10px] text-text-muted font-semibold text-right pr-0.5 sm:pr-1 select-none"
                aria-label="Daily work hours timeline"
              >
                {/* Mobile: concise 3-hour milestones (9 AM, 12 PM, 3 PM, 6 PM) */}
                <div className="sm:hidden flex flex-col justify-between h-full">
                  {MOBILE_WEEK_TIME_AXIS.map((slot) => (
                    <span key={`mob-${slot}`} className="leading-none whitespace-nowrap">
                      {slot}
                    </span>
                  ))}
                </div>
                {/* Desktop: detailed 1-hour milestones */}
                <div className="hidden sm:flex flex-col justify-between h-full">
                  {DESKTOP_WEEK_TIME_AXIS.map((slot) => (
                    <span key={`desk-${slot}`} className="leading-none whitespace-nowrap">
                      {slot}
                    </span>
                  ))}
                </div>
              </div>

              {/* 7 Day Cards */}
              {weekDays.map((item) => {
                const style = CATEGORY_STYLES[item.category];
                const isSelected = item.dateStr === selectedDateKey;
                const shortStatus =
                  item.category === 'weekly_off'
                    ? 'Off'
                    : item.category === 'late'
                      ? 'Late'
                      : item.category === 'absent'
                        ? 'Abs'
                        : item.category === 'present'
                          ? 'Pres'
                          : item.label === 'Scheduled'
                            ? 'Sched'
                            : item.label;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => handleSelectDay(item.date, true)}
                    className="min-h-[105px] sm:min-h-[190px] md:min-h-[210px] rounded-xl sm:rounded-2xl border p-1 sm:p-2.5 flex flex-col items-center justify-between text-center transition-all cursor-pointer hover:brightness-[0.98]"
                    style={{
                      backgroundColor: style.cardBg,
                      borderColor: isSelected ? 'rgb(85, 205, 179)' : style.cardBorder,
                      boxShadow: isSelected ? '0 0 0 2px rgba(85, 205, 179, 0.4)' : undefined,
                    }}
                    data-testid={`week-day-card-${item.dateStr}`}
                  >
                    {/* Status Glyph & Label */}
                    <div className="flex flex-col items-center gap-0.5 sm:gap-1.5 pt-0.5 sm:pt-1 w-full min-w-0">
                      <StatusGlyph category={item.category} />
                      {/* Short label on mobile, full label on tablet/desktop */}
                      <span className="sm:hidden text-[9px] font-bold text-text truncate max-w-full">
                        {shortStatus}
                      </span>
                      <span className="hidden sm:inline text-xs font-bold text-text truncate max-w-full">
                        {item.label}
                      </span>
                    </div>

                    {/* Desktop Middle: Check-In & Check-Out times */}
                    {item.checkInLabel !== '\u2014' ? (
                      <div className="hidden sm:flex flex-col items-center text-[10px] text-text-muted leading-tight">
                        <span>{item.checkInLabel}</span>
                        <span className="text-[9px] text-text-subtle">&ndash;</span>
                        <span>{item.checkOutLabel}</span>
                      </div>
                    ) : (
                      <div className="hidden sm:block text-[10px] text-text-subtle">
                        {item.category === 'weekly_off' ? 'Off Day' : 'No punches'}
                      </div>
                    )}

                    {/* Working Duration if applicable */}
                    <div className="pb-0.5 sm:pb-1 w-full min-w-0">
                      {item.checkInLabel !== '\u2014' ? (
                        <span className="text-[9px] sm:text-xs font-semibold text-text truncate block">
                          {item.hoursLabel}
                        </span>
                      ) : item.category !== 'weekly_off' ? (
                        <span className="text-[9px] sm:text-xs text-text-muted">&mdash;</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {calendarView === 'month' && (
          <div
            className="rounded-2xl border border-border/80 bg-white p-2 sm:p-3 md:p-4 shadow-xs"
            data-testid="my-attendance-month-grid"
          >
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2 text-center text-[10px] sm:text-xs font-semibold text-text-muted mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>

            {/* 7 Columns of Date Cells Without Horizontal Scroll */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
              {monthViewDays.map((item, idx) => {
                if (!item) {
                  return <div key={`m-empty-${idx}`} className="min-h-[58px] sm:min-h-[72px]" />;
                }
                const style = CATEGORY_STYLES[item.category];
                const isSelected = item.dateStr === selectedDateKey;
                const shortLabel =
                  item.category === 'weekly_off'
                    ? 'Week Off'
                    : item.label === 'Scheduled'
                      ? 'Sched'
                      : item.label;

                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => handleSelectDay(item.date, true)}
                    className="min-h-[58px] sm:min-h-[72px] md:min-h-[78px] rounded-xl border p-1 sm:p-1.5 text-left flex flex-col justify-between cursor-pointer transition-all hover:brightness-[0.98]"
                    style={{
                      backgroundColor: style.cardBg,
                      borderColor: isSelected ? 'rgb(85, 205, 179)' : style.cardBorder,
                      boxShadow: isSelected ? '0 0 0 2px rgba(85, 205, 179, 0.4)' : undefined,
                    }}
                  >
                    <span className="text-[11px] sm:text-xs font-bold text-text">
                      {item.date.getDate()}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold truncate leading-tight"
                        style={{ color: style.badgeText }}
                      >
                        {shortLabel}
                      </p>
                      {item.hoursLabel !== '\u2014' && (
                        <p className="text-[8px] sm:text-[10px] text-text-muted leading-tight truncate">
                          {item.hoursLabel}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {calendarView === 'day' && (
          <div
            className="rounded-2xl border border-border/80 bg-white p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4 shadow-xs"
            data-testid="my-attendance-day-view"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-text">
                  {selectedDayItem.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-[11px] sm:text-xs text-text-muted">
                  Daily schedule window: 09:00 AM &ndash; 06:00 PM
                </p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit"
                style={{
                  backgroundColor: CATEGORY_STYLES[selectedDayItem.category].badgeBg,
                  color: CATEGORY_STYLES[selectedDayItem.category].badgeText,
                }}
              >
                {selectedDayItem.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="p-2.5 sm:p-3 rounded-xl border border-border/80 bg-surface-muted/30">
                <p className="text-[11px] text-text-muted">Check-in Time</p>
                <p className="font-bold text-text mt-0.5">{selectedDayItem.checkInLabel}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl border border-border/80 bg-surface-muted/30">
                <p className="text-[11px] text-text-muted">Check-out Time</p>
                <p className="font-bold text-text mt-0.5">{selectedDayItem.checkOutLabel}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl border border-border/80 bg-surface-muted/30">
                <p className="text-[11px] text-text-muted">Total Working Hours</p>
                <p className="font-bold text-text mt-0.5">{selectedDayItem.hoursLabel}</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl border border-border/80 bg-surface-muted/30">
                <p className="text-[11px] text-text-muted">Break Duration</p>
                <p className="font-bold text-text mt-0.5">{selectedDayItem.breakLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/80">
              <p className="text-xs text-text-muted truncate max-w-sm">
                Notes: {selectedDayItem.notesLabel}
              </p>
              {selectedDayItem.record ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenCorrectionModal(selectedDayItem.record!)}
                >
                  Request Correction
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={onGoToCheckIn}>
                  Go to Check-In / Check-Out
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Attendance Details Popover / Floating Card */}
        {popoverItem && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40 sm:hidden"
              onClick={() => setPopoverDateKey(null)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-label="Attendance day details"
              className="fixed inset-x-3 bottom-3 sm:absolute sm:right-4 sm:bottom-4 sm:inset-x-auto z-40 max-w-sm mx-auto sm:mx-0 w-auto sm:w-[320px] rounded-2xl border border-border/80 bg-white p-4 space-y-3 shadow-xl"
              data-testid="attendance-detail-popover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-text">
                    {popoverItem.date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: CATEGORY_STYLES[popoverItem.category].badgeBg,
                      color: CATEGORY_STYLES[popoverItem.category].badgeText,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_STYLES[popoverItem.category].dotColor }}
                    />
                    {popoverItem.label}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Close attendance details"
                  onClick={() => setPopoverDateKey(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-muted cursor-pointer transition-colors"
                >
                  &times;
                </button>
              </div>

              <dl className="space-y-1.5 text-xs pt-1.5 border-t border-border/80">
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Check-in Time</dt>
                  <dd className="font-semibold text-text">{popoverItem.checkInLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Check-out Time</dt>
                  <dd className="font-semibold text-text">{popoverItem.checkOutLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Total Working Hours</dt>
                  <dd className="font-semibold text-text">{popoverItem.hoursLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Break Duration</dt>
                  <dd className="font-semibold text-text">{popoverItem.breakLabel}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Late Arrival</dt>
                  <dd className="font-semibold text-text">{popoverItem.lateLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-muted shrink-0">Notes</dt>
                  <dd className="font-semibold text-right truncate text-text">
                    {popoverItem.notesLabel}
                  </dd>
                </div>
              </dl>

              {popoverItem.record && (
                <div className="pt-2 border-t border-border/80">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const rec = popoverItem.record!;
                      setPopoverDateKey(null);
                      onOpenCorrectionModal(rec);
                    }}
                  >
                    Request Correction
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
