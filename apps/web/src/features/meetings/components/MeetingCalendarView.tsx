import { useMemo } from 'react';
import type { AttendanceRecord } from '../../attendance/types';
import type { Holiday, LeaveCalendarEntry } from '../../leave/types';
import type { Task } from '../../tasks/types';
import type { PersonalTodo } from '../../todos/types';
import type { MeetingSummary } from '../types';

export interface MeetingCalendarViewProps {
  meetings: MeetingSummary[];
  tasks?: Task[];
  todos?: PersonalTodo[];
  holidays?: Holiday[];
  leaves?: LeaveCalendarEntry[];
  attendanceRecords?: AttendanceRecord[];
  currentDate: Date;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onSelectMeeting: (id: string) => void;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayNumber: number;
}

interface CalendarPill {
  id: string;
  kind: 'meeting' | 'holiday' | 'leave' | 'task' | 'todo';
  label: string;
  cancelled?: boolean;
  completed?: boolean;
  overdue?: boolean;
  meetingId?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTimeCompact(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function MeetingCalendarView({
  meetings,
  tasks = [],
  todos = [],
  holidays = [],
  leaves = [],
  attendanceRecords = [],
  currentDate,
  selectedDate,
  onSelectDate,
  onSelectMeeting,
}: MeetingCalendarViewProps) {
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const mondayOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const today = new Date();
    const todayKey = toDateKey(today);
    const startDate = new Date(year, month, 1 - mondayOffset);

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + i,
      );
      const dateKey = toDateKey(cellDate);
      const dayOfWeek = i % 7;
      days.push({
        date: cellDate,
        dateKey,
        isCurrentMonth: cellDate.getMonth() === month,
        isToday: dateKey === todayKey,
        isWeekend: dayOfWeek >= 5,
        dayNumber: cellDate.getDate(),
      });
    }
    return days;
  }, [currentDate]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of attendanceRecords) {
      map.set(rec.workDate, rec);
    }
    return map;
  }, [attendanceRecords]);

  const pillsByDate = useMemo(() => {
    const map = new Map<string, CalendarPill[]>();
    const pushPill = (dateKey: string, pill: CalendarPill) => {
      const list = map.get(dateKey) ?? [];
      list.push(pill);
      map.set(dateKey, list);
    };

    for (const h of holidays) {
      pushPill(h.date, {
        id: `hol-${h.id}`,
        kind: 'holiday',
        label: h.name,
      });
    }

    for (const m of meetings) {
      const key = toDateKey(new Date(m.startsAt));
      pushPill(key, {
        id: `mtg-${m.id}`,
        kind: 'meeting',
        label: `${formatTimeCompact(m.startsAt)} ${m.title}`,
        cancelled: m.status === 'cancelled',
        meetingId: m.id,
      });
    }

    for (const l of leaves) {
      for (const day of calendarDays) {
        if (day.dateKey >= l.startDate && day.dateKey <= l.endDate) {
          pushPill(day.dateKey, {
            id: `leave-${l.requestId}-${day.dateKey}`,
            kind: 'leave',
            label: `${l.employeeName.split(' ')[0]} · ${l.leaveTypeCode}`,
          });
        }
      }
    }

    for (const t of tasks) {
      if (!t.dueDate) continue;
      pushPill(t.dueDate.slice(0, 10), {
        id: `task-${t.id}`,
        kind: 'task',
        label: t.title,
        completed: t.status === 'completed',
        overdue: t.isOverdue,
      });
    }

    for (const td of todos) {
      if (!td.dueDate) continue;
      pushPill(td.dueDate.slice(0, 10), {
        id: `todo-${td.id}`,
        kind: 'todo',
        label: td.title,
        completed: td.isCompleted,
      });
    }

    return map;
  }, [holidays, meetings, leaves, tasks, todos, calendarDays]);

  const pillTone = (pill: CalendarPill): string => {
    if (pill.cancelled) {
      return 'bg-surface-muted text-text-subtle border-border border-l-2 border-l-text-subtle line-through';
    }
    switch (pill.kind) {
      case 'holiday':
        return 'bg-positive-soft text-positive-ink border-positive-ink/20 border-l-2 border-l-positive-ink';
      case 'leave':
        return 'bg-tile-yellow text-warning border-warning/25 border-l-2 border-l-warning';
      case 'task':
        if (pill.completed) {
          return 'bg-surface-muted text-text-subtle border-border border-l-2 border-l-emerald-600 line-through';
        }
        return pill.overdue
          ? 'bg-rose-50 text-danger border-rose-200 border-l-2 border-l-danger'
          : 'bg-sky-50 text-sky-800 border-sky-200 border-l-2 border-l-sky-600';
      case 'todo':
        return pill.completed
          ? 'bg-surface-muted text-text-subtle border-border border-l-2 border-l-purple-400 line-through'
          : 'bg-purple-50 text-purple-800 border-purple-200 border-l-2 border-l-purple-600';
      default:
        return 'bg-primary-soft text-primary-deep border-primary-strong/30 border-l-2 border-l-primary-strong hover:bg-primary/20';
    }
  };

  return (
    <div
      className="bg-surface border border-border rounded-card overflow-hidden shadow-card flex flex-col"
      data-testid="meeting-calendar-view"
    >
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted/80">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`py-2.5 text-center text-xs font-semibold uppercase tracking-wider ${
              idx >= 5 ? 'text-text-subtle' : 'text-text-muted'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* 42-day calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border border-b border-border">
        {calendarDays.map((day) => {
          const dayPills = pillsByDate.get(day.dateKey) ?? [];
          const visiblePills = dayPills.slice(0, 3);
          const hiddenCount = dayPills.length - visiblePills.length;
          const isSelected = selectedDate === day.dateKey;
          const attRec = attendanceByDate.get(day.dateKey);

          return (
            <div
              key={day.dateKey}
              onClick={() => onSelectDate(day.dateKey)}
              className={`min-h-[110px] p-1.5 flex flex-col transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary-soft/25 ring-2 ring-inset ring-primary-strong'
                  : !day.isCurrentMonth
                    ? 'bg-surface-muted/60 text-text-subtle hover:bg-surface-muted'
                    : day.isWeekend
                      ? 'bg-surface-muted/30 hover:bg-surface-muted/50'
                      : 'bg-surface hover:bg-primary-soft/10'
              }`}
              data-testid={`calendar-day-${day.dateKey}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-semibold rounded-full transition-colors ${
                    day.isToday
                      ? 'bg-primary-deep text-surface font-bold shadow-xs'
                      : isSelected
                        ? 'bg-primary-soft text-primary-deep font-bold'
                        : day.isCurrentMonth
                          ? 'text-text'
                          : 'text-text-subtle'
                  }`}
                >
                  {day.dayNumber}
                </span>

                <div className="flex items-center gap-1">
                  {dayPills.length > 0 && (
                    <span className="text-[10px] font-semibold text-text-subtle tabular-nums hidden sm:inline">
                      {dayPills.length}
                    </span>
                  )}
                  {attRec && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        attRec.status === 'late' ? 'bg-warning' : 'bg-positive-ink'
                      }`}
                      title={`Attendance: ${attRec.status}`}
                    />
                  )}
                </div>
              </div>

              {/* Day items */}
              <div className="flex-1 space-y-1 overflow-hidden">
                {visiblePills.map((pill) =>
                  pill.kind === 'meeting' && pill.meetingId ? (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(day.dateKey);
                        onSelectMeeting(pill.meetingId!);
                      }}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight truncate block border transition-colors ${pillTone(
                        pill,
                      )}`}
                      title={pill.label}
                      data-testid={`calendar-event-${pill.meetingId}`}
                    >
                      {pill.label}
                    </button>
                  ) : (
                    <div
                      key={pill.id}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight truncate border ${pillTone(
                        pill,
                      )}`}
                      title={pill.label}
                    >
                      {pill.label}
                    </div>
                  ),
                )}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(day.dateKey);
                    }}
                    className="w-full text-left px-1.5 py-0.5 text-[10px] font-semibold text-primary-ink hover:underline"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Legend */}
      <div className="px-4 py-2.5 bg-surface-muted/50 flex items-center justify-between gap-3 flex-wrap text-[11px] text-text-muted">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary-strong" aria-hidden="true" />
            Meeting
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-600" aria-hidden="true" />
            Task Due
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-600" aria-hidden="true" />
            To-Do
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-positive-ink" aria-hidden="true" />
            Holiday
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm bg-warning" aria-hidden="true" />
            Leave
          </span>
        </div>
        <span className="text-[10px] text-text-subtle">Click any date to inspect day schedule</span>
      </div>
    </div>
  );
}
