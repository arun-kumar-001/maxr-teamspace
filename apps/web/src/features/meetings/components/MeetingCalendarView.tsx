import { useMemo } from 'react';
import type { MeetingSummary } from '../types';

export interface MeetingCalendarViewProps {
  meetings: MeetingSummary[];
  currentDate: Date;
  onSelectMeeting: (id: string) => void;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayNumber: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTimeCompact(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function MeetingCalendarView({
  meetings,
  currentDate,
  onSelectMeeting,
}: MeetingCalendarViewProps) {
  // Build calendar matrix (42 cells: 6 weeks x 7 days)
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun

    const today = new Date();
    const isSameDate = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    const days: CalendarDay[] = [];
    const startDate = new Date(year, month, 1 - startingDayOfWeek);

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + i,
      );
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = isSameDate(cellDate, today);
      const dateKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(
        2,
        '0',
      )}-${String(cellDate.getDate()).padStart(2, '0')}`;

      days.push({
        date: cellDate,
        dateKey,
        isCurrentMonth,
        isToday,
        dayNumber: cellDate.getDate(),
      });
    }

    return days;
  }, [currentDate]);

  // Index meetings by dateKey (YYYY-MM-DD)
  const meetingsByDate = useMemo(() => {
    const map = new Map<string, MeetingSummary[]>();
    for (const m of meetings) {
      const d = new Date(m.startsAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  return (
    <div
      className="bg-surface border border-border rounded-card overflow-hidden shadow-card"
      data-testid="meeting-calendar-view"
    >
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-text-muted uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 42-day calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border border-b border-border">
        {calendarDays.map((day) => {
          const dayMeetings = meetingsByDate.get(day.dateKey) ?? [];
          const visibleMeetings = dayMeetings.slice(0, 3);
          const hiddenCount = dayMeetings.length - visibleMeetings.length;

          return (
            <div
              key={day.dateKey}
              className={`min-h-[105px] p-1.5 flex flex-col transition-colors ${
                day.isCurrentMonth ? 'bg-surface' : 'bg-surface-muted/50 text-text-muted'
              }`}
              data-testid={`calendar-day-${day.dateKey}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full ${
                    day.isToday
                      ? 'bg-primary-deep text-surface font-bold'
                      : day.isCurrentMonth
                        ? 'text-text'
                        : 'text-text-subtle'
                  }`}
                >
                  {day.dayNumber}
                </span>
                {dayMeetings.length > 0 && (
                  <span className="text-[10px] font-medium text-text-subtle hidden sm:inline">
                    {dayMeetings.length} {dayMeetings.length === 1 ? 'mtg' : 'mtgs'}
                  </span>
                )}
              </div>

              {/* Day meetings pills */}
              <div className="flex-1 space-y-1 overflow-y-auto">
                {visibleMeetings.map((m) => {
                  const isCancelled = m.status === 'cancelled';
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectMeeting(m.id)}
                      className={`w-full text-left px-1.5 py-1 rounded text-[11px] leading-tight truncate block border transition-colors ${
                        isCancelled
                          ? 'bg-surface-muted text-text-subtle border-border line-through'
                          : m.myRole === 'organizer'
                            ? 'bg-primary-soft text-primary-deep border-primary-strong/30 hover:bg-primary-soft/80'
                            : 'bg-surface-raised text-text border-border hover:border-primary-strong/50'
                      }`}
                      title={`${formatTimeCompact(m.startsAt)} - ${m.title}`}
                      data-testid={`calendar-event-${m.id}`}
                    >
                      <span className="font-semibold mr-1">{formatTimeCompact(m.startsAt)}</span>
                      <span>{m.title}</span>
                    </button>
                  );
                })}

                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = dayMeetings[0];
                      if (first) onSelectMeeting(first.id);
                    }}
                    className="w-full text-left px-1.5 py-0.5 text-[10px] font-medium text-primary-ink hover:underline"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
