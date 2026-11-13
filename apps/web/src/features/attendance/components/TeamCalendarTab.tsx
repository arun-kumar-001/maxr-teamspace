import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorState, Modal, Skeleton } from '../../../components/ui';
import { fetchTeamCalendar } from '../api/attendance';
import type { CalendarCategory, TeamCalendarData, TeamCalendarEntry } from '../types';

type CalendarViewMode = 'month' | 'week' | 'day';

const CATEGORY_META: Record<
  CalendarCategory,
  {
    label: string;
    cardBg: string;
    cardBorder: string;
    pillBg: string;
    pillText: string;
    barColor: string;
  }
> = {
  present: {
    label: 'Present',
    cardBg: 'rgba(85, 205, 179, 0.18)',
    cardBorder: 'rgba(85, 205, 179, 0.45)',
    pillBg: 'rgb(85, 205, 179)',
    pillText: 'rgb(8, 11, 12)',
    barColor: 'rgb(85, 205, 179)',
  },
  absent: {
    label: 'Absent',
    cardBg: 'rgba(233, 138, 203, 0.2)',
    cardBorder: 'rgba(233, 138, 203, 0.5)',
    pillBg: 'rgb(233, 138, 203)',
    pillText: 'rgb(8, 11, 12)',
    barColor: 'rgb(233, 138, 203)',
  },
  late: {
    label: 'Late Arrival',
    cardBg: 'rgba(251, 191, 36, 0.2)',
    cardBorder: 'rgba(245, 158, 11, 0.5)',
    pillBg: 'rgb(245, 158, 11)',
    pillText: 'rgb(8, 11, 12)',
    barColor: 'rgb(245, 158, 11)',
  },
  wfh: {
    label: 'Work From Home',
    cardBg: 'rgba(139, 92, 246, 0.18)',
    cardBorder: 'rgba(139, 92, 246, 0.45)',
    pillBg: 'rgb(124, 58, 237)',
    pillText: 'rgb(244, 247, 246)',
    barColor: 'rgb(139, 92, 246)',
  },
  on_leave: {
    label: 'On Leave',
    cardBg: 'rgba(59, 130, 246, 0.18)',
    cardBorder: 'rgba(59, 130, 246, 0.45)',
    pillBg: 'rgb(37, 99, 235)',
    pillText: 'rgb(244, 247, 246)',
    barColor: 'rgb(59, 130, 246)',
  },
  holiday: {
    label: 'Holiday',
    cardBg: 'rgba(148, 163, 184, 0.2)',
    cardBorder: 'rgba(100, 116, 139, 0.4)',
    pillBg: 'rgb(71, 85, 105)',
    pillText: 'rgb(244, 247, 246)',
    barColor: 'rgb(148, 163, 184)',
  },
};

const CATEGORY_ORDER: CalendarCategory[] = [
  'present',
  'wfh',
  'late',
  'on_leave',
  'absent',
  'holiday',
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

function formatShortTime(iso: string | null): string {
  if (!iso) return '--:--';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '\u2014';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function TeamCalendarTab() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => toIsoDate(new Date()));

  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<CalendarCategory | ''>('');
  const [enabledCategories, setEnabledCategories] = useState<Record<CalendarCategory, boolean>>({
    present: true,
    absent: true,
    late: true,
    wfh: true,
    on_leave: true,
    holiday: true,
  });

  const [calendarData, setCalendarData] = useState<TeamCalendarData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<TeamCalendarEntry | null>(null);

  const dateRange = useMemo(() => {
    const base = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
    if (viewMode === 'month') {
      const firstOfMonth = new Date(base.getFullYear(), base.getMonth(), 1);
      const gridStart = new Date(firstOfMonth);
      gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
      const lastOfMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      const gridEnd = new Date(lastOfMonth);
      gridEnd.setDate(lastOfMonth.getDate() + (6 - lastOfMonth.getDay()));
      return {
        startDate: toIsoDate(gridStart),
        endDate: toIsoDate(gridEnd),
        gridStart,
        gridEnd,
      };
    }
    if (viewMode === 'week') {
      const weekStart = new Date(base);
      weekStart.setDate(base.getDate() - base.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        startDate: toIsoDate(weekStart),
        endDate: toIsoDate(weekEnd),
        gridStart: weekStart,
        gridEnd: weekEnd,
      };
    }
    return {
      startDate: toIsoDate(base),
      endDate: toIsoDate(base),
      gridStart: base,
      gridEnd: base,
    };
  }, [anchorDate, viewMode]);

  const loadCalendar = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTeamCalendar({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        departmentId: departmentFilter || undefined,
        employeeId: employeeFilter || undefined,
      });
      setCalendarData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team attendance calendar');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, departmentFilter, employeeFilter]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const navigate = (direction: -1 | 1) => {
    const next = new Date(anchorDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + direction);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + direction * 7);
    } else {
      next.setDate(next.getDate() + direction);
    }
    setAnchorDate(next);
    setSelectedDateStr(toIsoDate(next));
  };

  const goToday = () => {
    const now = new Date();
    setAnchorDate(now);
    setSelectedDateStr(toIsoDate(now));
  };

  const filteredEntries = useMemo(() => {
    const list = calendarData?.entries ?? [];
    return list.filter((item) => {
      if (!enabledCategories[item.category]) return false;
      if (statusFilter && item.category !== statusFilter) return false;
      return true;
    });
  }, [calendarData, enabledCategories, statusFilter]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TeamCalendarEntry[]>();
    for (const item of filteredEntries) {
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [filteredEntries]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CalendarCategory, number> = {
      present: 0,
      absent: 0,
      late: 0,
      wfh: 0,
      on_leave: 0,
      holiday: 0,
    };
    for (const item of calendarData?.entries ?? []) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [calendarData]);

  const totalEntriesCount = Math.max(1, (calendarData?.entries ?? []).length);

  const visibleDays = useMemo(() => {
    const days: Date[] = [];
    const cur = new Date(dateRange.gridStart);
    while (cur <= dateRange.gridEnd) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [dateRange.gridStart, dateRange.gridEnd]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'day') {
      return anchorDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    return anchorDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [anchorDate, viewMode]);

  const resetAllFilters = () => {
    setDepartmentFilter('');
    setEmployeeFilter('');
    setStatusFilter('');
    setEnabledCategories({
      present: true,
      absent: true,
      late: true,
      wfh: true,
      on_leave: true,
      holiday: true,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 rounded-2xl" data-testid="team-calendar-tab">
      {/* Left Sidebar: Categories & Filters */}
      <aside className="w-full lg:w-64 shrink-0 p-4 rounded-card border border-border/80 bg-white shadow-xs space-y-5 text-text">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary-strong">
              Attendance Legend
            </h3>
            <span className="text-[11px] text-text-muted">
              Toggle
            </span>
          </div>
          <div className="space-y-2.5">
            {CATEGORY_ORDER.map((cat) => {
              const meta = CATEGORY_META[cat];
              const count = categoryCounts[cat];
              const pct = Math.round((count / totalEntriesCount) * 100);
              return (
                <label key={cat} className="flex flex-col gap-1 cursor-pointer select-none group">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enabledCategories[cat]}
                        onChange={() =>
                          setEnabledCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
                        }
                        className="rounded border-border accent-teal-600"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: meta.barColor }}
                      />
                      <span className="text-text font-medium">{meta.label}</span>
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-text-muted">
                      {count}
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden bg-surface-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(count > 0 ? 12 : 0, pct)}%`,
                        backgroundColor: meta.barColor,
                      }}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-border/80 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary-strong">
            Filters
          </h3>

          <div className="space-y-1">
            <label
              htmlFor="calendar-department-filter"
              className="text-[11px] block text-text-muted font-medium"
            >
              Department
            </label>
            <select
              id="calendar-department-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-border/80 bg-white text-text min-h-[38px] shadow-xs"
              data-testid="calendar-department-filter"
            >
              <option value="">All Departments</option>
              {(calendarData?.departments ?? []).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="calendar-employee-filter"
              className="text-[11px] block text-text-muted font-medium"
            >
              Employee
            </label>
            <select
              id="calendar-employee-filter"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-border/80 bg-white text-text min-h-[38px] shadow-xs"
              data-testid="calendar-employee-filter"
            >
              <option value="">All Team Members</option>
              {(calendarData?.employees ?? []).map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.employeeName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="calendar-status-filter"
              className="text-[11px] block text-text-muted font-medium"
            >
              Attendance Status
            </label>
            <select
              id="calendar-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CalendarCategory | '')}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-border/80 bg-white text-text min-h-[38px] shadow-xs"
              data-testid="calendar-status-filter"
            >
              <option value="">All Statuses</option>
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={resetAllFilters}
            className="w-full text-xs font-semibold py-2 rounded-lg border border-border/80 bg-surface-muted/60 hover:bg-surface-muted text-text min-h-[38px] cursor-pointer shadow-xs transition-colors"
          >
            Reset Filters
          </button>
        </div>
      </aside>

      {/* Main Luminous Calendar Stage */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 rounded-card border border-border/80 bg-white shadow-xs space-y-5 text-text">
        {/* Top Controls: Month Title, Month/Week/Day Segmented Switch, < Today > */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h2
            className="text-xl sm:text-2xl font-bold font-display"
            style={{ color: 'rgb(17, 24, 25)' }}
          >
            {headerTitle}
          </h2>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div
              className="inline-flex p-1 rounded-xl border"
              style={{
                backgroundColor: 'rgb(232, 237, 236)',
                borderColor: 'rgb(211, 220, 217)',
              }}
              role="group"
              aria-label="Calendar view mode"
            >
              {(['month', 'week', 'day'] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer min-h-[34px]"
                    style={
                      active
                        ? {
                            backgroundColor: 'rgb(85, 205, 179)',
                            color: 'rgb(8, 11, 12)',
                            boxShadow: '0 2px 10px rgba(0, 220, 203, 0.3)',
                          }
                        : { color: 'rgb(79, 92, 90)' }
                    }
                    data-testid={`calendar-view-${mode}-btn`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>

            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-xl border inline-flex items-center justify-center font-bold cursor-pointer"
                style={{
                  backgroundColor: 'rgb(232, 237, 236)',
                  borderColor: 'rgb(211, 220, 217)',
                  color: 'rgb(17, 24, 25)',
                }}
                aria-label="Previous period"
                data-testid="calendar-prev-btn"
              >
                &lsaquo;
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-3.5 h-9 rounded-xl border text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'rgb(232, 237, 236)',
                  borderColor: 'rgb(211, 220, 217)',
                  color: 'rgb(17, 24, 25)',
                }}
                data-testid="calendar-today-btn"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => navigate(1)}
                className="w-9 h-9 rounded-xl border inline-flex items-center justify-center font-bold cursor-pointer"
                style={{
                  backgroundColor: 'rgb(232, 237, 236)',
                  borderColor: 'rgb(211, 220, 217)',
                  color: 'rgb(17, 24, 25)',
                }}
                aria-label="Next period"
                data-testid="calendar-next-btn"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3" data-testid="team-calendar-loading">
            <Skeleton variant="rectangular" height={56} />
            <Skeleton variant="rectangular" height={240} />
          </div>
        ) : error ? (
          <ErrorState title="Could not load team calendar" message={error} onRetry={loadCalendar} />
        ) : viewMode === 'month' ? (
          <div className="space-y-2" data-testid="team-calendar-month-grid">
            <div
              className="grid grid-cols-7 gap-2 text-center text-xs font-semibold pb-1"
              style={{ color: 'rgb(79, 92, 90)' }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {visibleDays.map((dayObj) => {
                const iso = toIsoDate(dayObj);
                const isCurrentMonth = dayObj.getMonth() === anchorDate.getMonth();
                const isSelected = iso === selectedDateStr;
                const dayEntries = entriesByDate.get(iso) ?? [];

                return (
                  <div
                    key={iso}
                    onClick={() => setSelectedDateStr(iso)}
                    className="min-h-[112px] p-2 rounded-2xl border transition-all flex flex-col gap-1.5 cursor-pointer"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(85, 205, 179, 0.12)'
                        : isCurrentMonth
                          ? 'rgb(255, 255, 255)'
                          : 'rgba(232, 237, 236, 0.5)',
                      borderColor: isSelected ? 'rgb(85, 205, 179)' : 'rgb(227, 233, 231)',
                      opacity: isCurrentMonth ? 1 : 0.65,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-lg"
                        style={
                          isSelected
                            ? { backgroundColor: 'rgb(17, 24, 25)', color: 'rgb(244, 247, 246)' }
                            : { color: 'rgb(17, 24, 25)' }
                        }
                      >
                        {dayObj.getDate()}
                      </span>
                      {dayEntries.length > 0 && (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: 'rgb(79, 92, 90)' }}
                        >
                          {dayEntries.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-hidden">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const style = CATEGORY_META[entry.category];
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntry(entry);
                            }}
                            className="w-full text-left px-2 py-1 rounded-lg border text-[11px] font-medium truncate cursor-pointer"
                            style={{
                              backgroundColor: style.cardBg,
                              borderColor: style.cardBorder,
                              color: 'rgb(17, 24, 25)',
                            }}
                          >
                            {entry.category === 'holiday'
                              ? (entry.holidayName ?? entry.statusLabel)
                              : `${entry.employeeName.split(' ')[0]} \u00B7 ${style.label}`}
                          </button>
                        );
                      })}
                      {dayEntries.length > 3 && (
                        <p
                          className="text-[10px] font-semibold px-1"
                          style={{ color: 'rgb(15, 118, 110)' }}
                        >
                          +{dayEntries.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          <div className="space-y-4 overflow-x-auto" data-testid="team-calendar-week-grid">
            {/* Day Strip matching reference */}
            <div className="grid grid-cols-7 gap-2 min-w-[720px]">
              {visibleDays.map((dayObj) => {
                const iso = toIsoDate(dayObj);
                const isSelected = iso === selectedDateStr;
                const weekdayLabel = dayObj.toLocaleDateString(undefined, { weekday: 'long' });
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDateStr(iso)}
                    className="p-3 rounded-2xl text-center transition-all cursor-pointer border"
                    style={
                      isSelected
                        ? {
                            backgroundColor: 'rgb(17, 24, 25)',
                            borderColor: 'rgb(17, 24, 25)',
                            color: 'rgb(244, 247, 246)',
                            boxShadow: '0 8px 20px rgba(8, 11, 12, 0.25)',
                          }
                        : {
                            backgroundColor: 'rgb(232, 237, 236)',
                            borderColor: 'rgb(227, 233, 231)',
                            color: 'rgb(17, 24, 25)',
                          }
                    }
                  >
                    <p
                      className="text-[11px] font-medium"
                      style={{
                        color: isSelected ? 'rgba(244, 247, 246, 0.72)' : 'rgb(79, 92, 90)',
                      }}
                    >
                      {weekdayLabel}
                    </p>
                    <p className="text-xl font-bold font-display mt-0.5">{dayObj.getDate()}</p>
                  </button>
                );
              })}
            </div>

            {/* Event Columns per Day */}
            <div className="grid grid-cols-7 gap-2.5 min-w-[720px]">
              {visibleDays.map((dayObj) => {
                const iso = toIsoDate(dayObj);
                const dayEntries = entriesByDate.get(iso) ?? [];
                return (
                  <div
                    key={iso}
                    className="min-h-[260px] p-2 rounded-2xl border space-y-2.5"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.78)',
                      borderColor: 'rgb(227, 233, 231)',
                    }}
                  >
                    {dayEntries.length === 0 ? (
                      <p
                        className="text-[11px] text-center py-6"
                        style={{ color: 'rgb(95, 108, 106)' }}
                      >
                        No records
                      </p>
                    ) : (
                      dayEntries.map((entry) => {
                        const style = CATEGORY_META[entry.category];
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setSelectedEntry(entry)}
                            className="w-full text-left p-2.5 rounded-2xl border space-y-2 transition-transform hover:-translate-y-0.5 cursor-pointer"
                            style={{
                              backgroundColor: style.cardBg,
                              borderColor: style.cardBorder,
                            }}
                            data-testid={`calendar-entry-card-${entry.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold shrink-0"
                                style={{
                                  backgroundColor: 'rgb(17, 24, 25)',
                                  color: 'rgb(244, 247, 246)',
                                }}
                              >
                                {entry.category === 'holiday'
                                  ? 'H'
                                  : getInitials(entry.employeeName)}
                              </span>
                              <div className="min-w-0">
                                <p
                                  className="text-xs font-bold truncate"
                                  style={{ color: 'rgb(17, 24, 25)' }}
                                >
                                  {entry.category === 'holiday'
                                    ? (entry.holidayName ?? 'Holiday')
                                    : entry.employeeName}
                                </p>
                                <p className="text-[10px]" style={{ color: 'rgb(79, 92, 90)' }}>
                                  {entry.checkInTime
                                    ? `${formatShortTime(entry.checkInTime)} \u2013 ${formatShortTime(entry.checkOutTime)}`
                                    : (entry.departmentName ?? 'Company-wide')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: style.pillBg,
                                  color: style.pillText,
                                }}
                              >
                                {style.label}
                              </span>
                              {entry.durationMinutes !== null && (
                                <span
                                  className="text-[10px] font-semibold"
                                  style={{ color: 'rgb(17, 24, 25)' }}
                                >
                                  {formatMinutes(entry.durationMinutes)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Day View */
          <div className="space-y-3" data-testid="team-calendar-day-view">
            {(entriesByDate.get(toIsoDate(anchorDate)) ?? []).length === 0 ? (
              <div className="p-8 rounded-2xl border border-border bg-white text-center text-sm text-text-muted">
                No team attendance events scheduled for this day matching your active filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(entriesByDate.get(toIsoDate(anchorDate)) ?? []).map((entry) => {
                  const style = CATEGORY_META[entry.category];
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setSelectedEntry(entry)}
                      className="text-left p-4 rounded-2xl border space-y-3 cursor-pointer"
                      style={{
                        backgroundColor: style.cardBg,
                        borderColor: style.cardBorder,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: 'rgb(17, 24, 25)',
                              color: 'rgb(244, 247, 246)',
                            }}
                          >
                            {entry.category === 'holiday' ? 'H' : getInitials(entry.employeeName)}
                          </span>
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'rgb(17, 24, 25)' }}>
                              {entry.category === 'holiday'
                                ? (entry.holidayName ?? 'Holiday')
                                : entry.employeeName}
                            </p>
                            <p className="text-xs" style={{ color: 'rgb(79, 92, 90)' }}>
                              {entry.designation ?? entry.departmentName ?? 'Staff'}
                            </p>
                          </div>
                        </div>
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: style.pillBg, color: style.pillText }}
                        >
                          {style.label}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-between text-xs"
                        style={{ color: 'rgb(17, 24, 25)' }}
                      >
                        <span>
                          In: {formatShortTime(entry.checkInTime)} &middot; Out:{' '}
                          {formatShortTime(entry.checkOutTime)}
                        </span>
                        <span className="font-semibold">
                          {formatMinutes(entry.durationMinutes)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Attendance Popup Modal */}
      <Modal
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title="Attendance Details"
      >
        {selectedEntry && (
          <div className="space-y-4 text-sm" data-testid="calendar-detail-modal">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <span
                  className="w-10 h-10 rounded-full inline-flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: 'rgb(17, 24, 25)', color: 'rgb(244, 247, 246)' }}
                >
                  {selectedEntry.category === 'holiday'
                    ? 'H'
                    : getInitials(selectedEntry.employeeName)}
                </span>
                <div>
                  <p className="font-bold text-text">
                    {selectedEntry.category === 'holiday'
                      ? (selectedEntry.holidayName ?? 'Public Holiday')
                      : selectedEntry.employeeName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {selectedEntry.employeeCode}
                    {selectedEntry.departmentName ? ` \u00B7 ${selectedEntry.departmentName}` : ''}
                  </p>
                </div>
              </div>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  backgroundColor: CATEGORY_META[selectedEntry.category].pillBg,
                  color: CATEGORY_META[selectedEntry.category].pillText,
                }}
              >
                {CATEGORY_META[selectedEntry.category].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Date</p>
                <p className="font-semibold text-text mt-0.5">{selectedEntry.date}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Work Mode</p>
                <p className="font-semibold text-text capitalize mt-0.5">
                  {selectedEntry.workMode ?? '\u2014'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Check-In</p>
                <p className="font-semibold text-text mt-0.5">
                  {formatShortTime(selectedEntry.checkInTime)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Check-Out</p>
                <p className="font-semibold text-text mt-0.5">
                  {formatShortTime(selectedEntry.checkOutTime)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Worked Duration</p>
                <p className="font-semibold text-text mt-0.5">
                  {formatMinutes(selectedEntry.durationMinutes)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface-muted border border-border">
                <p className="text-text-muted text-xs">Summary</p>
                <p className="font-semibold text-text mt-0.5">
                  {selectedEntry.leaveTypeName ?? selectedEntry.statusLabel}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
