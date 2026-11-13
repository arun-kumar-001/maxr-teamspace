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

const TIME_SLOTS = [
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
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

const LEGEND_ITEMS: Array<{ label: string; dotColor: string }> = [
  { label: 'Present (P)', dotColor: 'rgb(22, 163, 74)' },
  { label: 'Absent (A)', dotColor: 'rgb(220, 38, 38)' },
  { label: 'Late Check-in (L)', dotColor: 'rgb(217, 119, 6)' },
  { label: 'Half Day (HD)', dotColor: 'rgb(37, 99, 235)' },
  { label: 'Approved Leave (L)', dotColor: 'rgb(147, 51, 234)' },
  { label: 'Holiday (H) / Weekly Off (WO)', dotColor: 'rgb(107, 114, 128)' },
];

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
        className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0"
        style={{
          backgroundColor: category === 'leave' ? style.iconBg : 'transparent',
          color: category === 'leave' ? 'rgb(255, 255, 255)' : 'rgb(55, 65, 81)',
        }}
      >
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
      </span>
    );
  }
  if (category === 'absent') {
    return (
      <span
        className="w-7 h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: style.iconBg }}
      >
        <svg
          className="w-3.5 h-3.5"
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
        className="w-7 h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: style.iconBg }}
      >
        <svg
          className="w-3.5 h-3.5"
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
      className="w-7 h-7 rounded-full inline-flex items-center justify-center text-white shrink-0"
      style={{ backgroundColor: style.iconBg }}
    >
      <svg
        className="w-3.5 h-3.5"
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
  const [categoriesOpen, setCategoriesOpen] = useState<boolean>(true);

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
    start.setDate(start.getDate() - start.getDay());
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

  const miniMonthTitle = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    <div className="grid grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)] gap-5 items-start">
      {/* Left Content Panel */}
      <aside className="space-y-4">
        {/* Mini Monthly Calendar */}
        <div
          className="p-4 rounded-2xl border bg-white"
          style={{ borderColor: 'rgb(229, 231, 235)' }}
          data-testid="mini-attendance-calendar"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              {miniMonthTitle}
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => {
                  const prev = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
                  setViewDate(prev);
                }}
                className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                &lsaquo;
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
                  setViewDate(next);
                }}
                className="w-7 h-7 rounded-lg border flex items-center justify-center text-xs hover:bg-gray-50 cursor-pointer"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                &rsaquo;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-500 mb-1.5">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {miniMonthCells.map((d, idx) => {
              if (!d) return <div key={`empty-${idx}`} className="h-8" />;
              const key = toDateKey(d);
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectDay(d, true)}
                  className="h-8 w-8 mx-auto rounded-full text-xs font-medium flex items-center justify-center transition-colors cursor-pointer"
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'rgb(85, 205, 179)',
                          color: 'rgb(8, 11, 12)',
                          fontWeight: 700,
                        }
                      : { color: 'rgb(8, 11, 12)' }
                  }
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly Summary Card */}
        <div
          className="p-4 rounded-2xl border bg-white space-y-3"
          style={{ borderColor: 'rgb(229, 231, 235)' }}
          data-testid="monthly-summary-card"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              Monthly Summary
            </h2>
            <svg
              className="w-4 h-4 text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M3 3v18h18M8 16v-5M13 16V7M18 16v-3" strokeLinecap="round" />
            </svg>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Working Days</span>
              <span className="font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                {monthStats.workingDays}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Present Days</span>
              <span className="font-bold tabular-nums" style={{ color: 'rgb(22, 163, 74)' }}>
                {monthStats.presentDays}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Absent Days</span>
              <span className="font-bold tabular-nums" style={{ color: 'rgb(220, 38, 38)' }}>
                {monthStats.absentDays}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Late Arrivals</span>
              <span className="font-bold tabular-nums" style={{ color: 'rgb(217, 119, 6)' }}>
                {monthStats.lateArrivals}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Leave Days</span>
              <span className="font-bold tabular-nums" style={{ color: 'rgb(147, 51, 234)' }}>
                {monthStats.leaveDays}
              </span>
            </div>
          </div>

          <div
            className="p-3 rounded-xl flex items-center justify-between"
            style={{ backgroundColor: 'rgb(240, 253, 250)' }}
          >
            <div>
              <p className="text-xs font-medium text-gray-600">Attendance %</p>
              <p
                className="text-lg font-bold font-display tabular-nums"
                style={{ color: 'rgb(15, 118, 110)' }}
              >
                {monthStats.pctText}
              </p>
            </div>
            <CircularProgressRing percentage={monthStats.pct} />
          </div>
        </div>

        {/* Attendance Categories Legend */}
        <div
          className="p-4 rounded-2xl border bg-white"
          style={{ borderColor: 'rgb(229, 231, 235)' }}
          data-testid="attendance-categories-legend"
        >
          <button
            type="button"
            onClick={() => setCategoriesOpen((prev) => !prev)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
            aria-expanded={categoriesOpen}
          >
            <span className="text-sm font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              Attendance Categories
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${
                categoriesOpen ? 'rotate-180' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {categoriesOpen && (
            <ul className="mt-3 space-y-2">
              {LEGEND_ITEMS.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5 text-xs text-gray-700">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.dotColor }}
                  />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Main Attendance Calendar */}
      <div className="min-w-0 space-y-4 relative">
        {/* Calendar Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2
            className="text-lg sm:text-xl font-bold font-display"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            {mainMonthTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month / Week / Day View Switcher */}
            <div
              className="inline-flex rounded-xl border p-0.5 bg-white"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
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
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer min-h-[36px]"
                    style={
                      active
                        ? { backgroundColor: 'rgb(85, 205, 179)', color: 'rgb(8, 11, 12)' }
                        : { color: 'rgb(55, 65, 81)' }
                    }
                    data-testid={`my-calendar-view-${mode}`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            {/* Prev / Today / Next */}
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                aria-label="Previous period"
                onClick={() => handleShiftPeriod(-1)}
                className="w-9 h-9 rounded-xl border bg-white flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                &lsaquo;
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewDate(now);
                  setSelectedDateKey(toDateKey(now));
                }}
                className="px-3.5 h-9 rounded-xl border bg-white text-xs font-semibold hover:bg-gray-50 cursor-pointer"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next period"
                onClick={() => handleShiftPeriod(1)}
                className="w-9 h-9 rounded-xl border bg-white flex items-center justify-center text-sm hover:bg-gray-50 cursor-pointer"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        </div>

        {/* 6 KPI Summary Cards */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5"
          data-testid="my-attendance-kpi-grid"
        >
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="p-2.5 rounded-2xl border bg-white flex items-center gap-2"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
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
                <p className="text-[11px] font-medium text-gray-500 leading-tight">{card.label}</p>
                <p
                  className="text-base font-bold font-display tabular-nums leading-tight mt-0.5"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  {card.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Calendar Body */}
        {calendarView === 'week' && (
          <div
            className="rounded-2xl border bg-white overflow-x-auto"
            style={{ borderColor: 'rgb(229, 231, 235)' }}
            data-testid="my-attendance-week-grid"
          >
            <div className="min-w-[680px] p-3 sm:p-4">
              {/* Weekday Column Headers */}
              <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] gap-2 mb-2">
                <div />
                {weekDays.map((item) => {
                  const isSelected = item.dateStr === selectedDateKey;
                  return (
                    <button
                      key={`hdr-${item.dateStr}`}
                      type="button"
                      onClick={() => handleSelectDay(item.date, true)}
                      className="py-2 px-1 rounded-xl text-center transition-colors cursor-pointer border"
                      style={
                        isSelected
                          ? {
                              backgroundColor: 'rgb(240, 253, 250)',
                              borderColor: 'rgb(85, 205, 179)',
                            }
                          : { borderColor: 'transparent' }
                      }
                    >
                      <p className="text-xs font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                        {item.date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {item.date.toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Time Slots + 7 Colored Status Columns */}
              <div className="grid grid-cols-[68px_repeat(7,minmax(0,1fr))] gap-2 items-stretch">
                {/* 09:00 AM – 06:00 PM Time Axis */}
                <div className="flex flex-col justify-between py-2 text-[11px] text-gray-500 font-medium">
                  {TIME_SLOTS.map((slot) => (
                    <span key={slot} className="leading-none">
                      {slot}
                    </span>
                  ))}
                </div>

                {/* Day Status Cards */}
                {weekDays.map((item) => {
                  const style = CATEGORY_STYLES[item.category];
                  const isSelected = item.dateStr === selectedDateKey;
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => handleSelectDay(item.date, true)}
                      className="min-h-[290px] rounded-2xl border p-2.5 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:brightness-[0.98] cursor-pointer"
                      style={{
                        backgroundColor: style.cardBg,
                        borderColor: isSelected ? 'rgb(85, 205, 179)' : style.cardBorder,
                        boxShadow: isSelected ? '0 0 0 2px rgba(85, 205, 179, 0.35)' : undefined,
                      }}
                      data-testid={`week-day-card-${item.dateStr}`}
                    >
                      <StatusGlyph category={item.category} />
                      <span className="text-xs font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                        {item.label}
                      </span>
                      {item.checkInLabel !== '\u2014' ? (
                        <>
                          <span className="text-[11px] text-gray-700 leading-tight">
                            {item.checkInLabel} &ndash;
                            <br />
                            {item.checkOutLabel}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-800">
                            {item.hoursLabel}
                          </span>
                        </>
                      ) : item.category !== 'weekly_off' ? (
                        <span className="text-xs text-gray-500">&mdash;</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {calendarView === 'month' && (
          <div
            className="rounded-2xl border bg-white p-3 sm:p-4"
            style={{ borderColor: 'rgb(229, 231, 235)' }}
            data-testid="my-attendance-month-grid"
          >
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-gray-500 mb-2">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthViewDays.map((item, idx) => {
                if (!item) return <div key={`m-empty-${idx}`} className="min-h-[84px]" />;
                const style = CATEGORY_STYLES[item.category];
                const isSelected = item.dateStr === selectedDateKey;
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => handleSelectDay(item.date, true)}
                    className="min-h-[84px] rounded-xl border p-2 text-left flex flex-col justify-between cursor-pointer transition-all"
                    style={{
                      backgroundColor: style.cardBg,
                      borderColor: isSelected ? 'rgb(85, 205, 179)' : style.cardBorder,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                      {item.date.getDate()}
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold" style={{ color: style.badgeText }}>
                        {item.label}
                      </p>
                      {item.hoursLabel !== '\u2014' && (
                        <p className="text-[10px] text-gray-700">{item.hoursLabel}</p>
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
            className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4"
            style={{ borderColor: 'rgb(229, 231, 235)' }}
            data-testid="my-attendance-day-view"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {selectedDayItem.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-gray-500">
                  Daily schedule window: 09:00 AM &ndash; 06:00 PM
                </p>
              </div>
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold w-fit"
                style={{
                  backgroundColor: CATEGORY_STYLES[selectedDayItem.category].badgeBg,
                  color: CATEGORY_STYLES[selectedDayItem.category].badgeText,
                }}
              >
                {selectedDayItem.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl border" style={{ borderColor: 'rgb(229, 231, 235)' }}>
                <p className="text-gray-500">Check-in Time</p>
                <p className="font-bold mt-1" style={{ color: 'rgb(8, 11, 12)' }}>
                  {selectedDayItem.checkInLabel}
                </p>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'rgb(229, 231, 235)' }}>
                <p className="text-gray-500">Check-out Time</p>
                <p className="font-bold mt-1" style={{ color: 'rgb(8, 11, 12)' }}>
                  {selectedDayItem.checkOutLabel}
                </p>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'rgb(229, 231, 235)' }}>
                <p className="text-gray-500">Total Working Hours</p>
                <p className="font-bold mt-1" style={{ color: 'rgb(8, 11, 12)' }}>
                  {selectedDayItem.hoursLabel}
                </p>
              </div>
              <div className="p-3 rounded-xl border" style={{ borderColor: 'rgb(229, 231, 235)' }}>
                <p className="text-gray-500">Break Duration</p>
                <p className="font-bold mt-1" style={{ color: 'rgb(8, 11, 12)' }}>
                  {selectedDayItem.breakLabel}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <p className="text-xs text-gray-600">Notes: {selectedDayItem.notesLabel}</p>
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

        {/* Attendance Details Popover */}
        {popoverItem && (
          <div
            role="dialog"
            aria-label="Attendance day details"
            className="sm:absolute sm:right-4 sm:bottom-4 z-30 w-full sm:w-[320px] rounded-2xl border bg-white p-4 space-y-3"
            style={{
              borderColor: 'rgb(229, 231, 235)',
              boxShadow: '0 20px 40px rgba(8, 11, 12, 0.14)',
            }}
            data-testid="attendance-detail-popover"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
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
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <dl
              className="space-y-2 text-xs pt-1 border-t"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
            >
              <div className="flex items-center justify-between pt-1">
                <dt className="text-gray-500">Check-in Time</dt>
                <dd className="font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.checkInLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Check-out Time</dt>
                <dd className="font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.checkOutLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Total Working Hours</dt>
                <dd className="font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.hoursLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Break Duration</dt>
                <dd className="font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.breakLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Late Arrival</dt>
                <dd className="font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                  {popoverItem.lateLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500 shrink-0">Notes</dt>
                <dd
                  className="font-semibold text-right truncate"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  {popoverItem.notesLabel}
                </dd>
              </div>
            </dl>

            {popoverItem.record && (
              <div className="pt-2 border-t" style={{ borderColor: 'rgb(229, 231, 235)' }}>
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
        )}
      </div>
    </div>
  );
}
