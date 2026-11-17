import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { AttendanceRecord, TodayAttendanceSummary, WorkMode } from '../../attendance/types';
import type { Holiday, LeaveCalendarEntry } from '../../leave/types';
import { TaskPriorityBadge } from '../../tasks/components/TaskPriorityBadge';
import { TaskStatusPill } from '../../tasks/components/TaskStatusPill';
import type { Task } from '../../tasks/types';
import type { PersonalTodo } from '../../todos/types';
import type { MeetingSummary } from '../types';

export interface CalendarDayPanelProps {
  selectedDate: string;
  todayDateKey: string;
  meetings: MeetingSummary[];
  tasks: Task[];
  todos: PersonalTodo[];
  holidays: Holiday[];
  leaves: LeaveCalendarEntry[];
  todayAttendance: TodayAttendanceSummary | null;
  dayAttendanceRecords: AttendanceRecord[];
  canSchedule: boolean;
  onQuickScheduleClick: () => void;
  onSelectMeeting: (id: string) => void;
  onCheckIn: (workMode: WorkMode, note?: string) => Promise<void>;
  onCheckOut: (note?: string) => Promise<void>;
  onAddTodo: (title: string, dueDate: string) => Promise<void>;
  onToggleTodo: (id: string) => Promise<void>;
  onDeleteTodo: (id: string) => Promise<void>;
}

function formatTimeShort(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

export function CalendarDayPanel({
  selectedDate,
  todayDateKey,
  meetings,
  tasks,
  todos,
  holidays,
  leaves,
  todayAttendance,
  dayAttendanceRecords,
  canSchedule,
  onQuickScheduleClick,
  onSelectMeeting,
  onCheckIn,
  onCheckOut,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
}: CalendarDayPanelProps) {
  const [workMode, setWorkMode] = useState<WorkMode>('office');
  const [attendanceNote, setAttendanceNote] = useState('');
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendanceFeedback, setAttendanceFeedback] = useState<string | null>(null);

  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [todoSubmitting, setTodoSubmitting] = useState(false);

  const isToday = selectedDate === todayDateKey;

  const formattedDayTitle = (() => {
    try {
      const dt = new Date(`${selectedDate}T00:00:00`);
      return dt.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  })();

  const dayMeetings = meetings
    .filter((m) => {
      const d = new Date(m.startsAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      return key === selectedDate;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const dayTasks = tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === selectedDate);
  const dayHolidays = holidays.filter((h) => h.date === selectedDate);
  const dayLeaves = leaves.filter((l) => selectedDate >= l.startDate && selectedDate <= l.endDate);

  const dayTodos = todos.filter((td) => td.dueDate && td.dueDate.slice(0, 10) === selectedDate);
  const unscheduledTodos = isToday ? todos.filter((td) => !td.dueDate && !td.isCompleted) : [];

  const activeSession = todayAttendance?.activeSession ?? null;

  const handleAttendanceAction = async (type: 'in' | 'out') => {
    setAttendanceSubmitting(true);
    setAttendanceFeedback(null);
    try {
      const trimmed = attendanceNote.trim() || undefined;
      if (type === 'in') {
        await onCheckIn(workMode, trimmed);
        setAttendanceFeedback('Checked in successfully');
      } else {
        await onCheckOut(trimmed);
        setAttendanceFeedback('Checked out successfully');
      }
      setAttendanceNote('');
    } catch (err: unknown) {
      setAttendanceFeedback(
        err instanceof Error ? err.message : 'Unable to update attendance right now.',
      );
    } finally {
      setAttendanceSubmitting(false);
    }
  };

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodoTitle.trim();
    if (!title) return;
    setTodoSubmitting(true);
    try {
      await onAddTodo(title, selectedDate);
      setNewTodoTitle('');
    } finally {
      setTodoSubmitting(false);
    }
  };

  return (
    <aside
      className="bg-surface border border-border rounded-card shadow-card p-5 flex flex-col gap-4 h-fit"
      data-testid="calendar-day-panel"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-text">
              {isToday ? 'Today' : 'Selected Day'}
            </h2>
            {isToday && (
              <span className="px-2 py-0.5 rounded-full bg-primary-soft text-primary-ink text-[10px] font-bold uppercase">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">{formattedDayTitle}</p>
        </div>

        {canSchedule && (
          <button
            type="button"
            onClick={onQuickScheduleClick}
            title="Schedule meeting on this date"
            aria-label="Schedule meeting on this date"
            className="w-8 h-8 rounded-full border border-border bg-surface-muted hover:bg-primary-soft hover:text-primary-ink flex items-center justify-center text-sm font-bold transition-colors shrink-0"
          >
            +
          </button>
        )}
      </div>

      {/* 1. Check-In / Check-Out & Attendance Note */}
      <div className="p-3.5 rounded-card bg-surface-muted/60 border border-border space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            Attendance &amp; Note
          </span>
          {isToday && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeSession
                  ? 'bg-positive-soft text-positive-ink'
                  : 'bg-surface text-text-muted border border-border'
              }`}
            >
              {activeSession
                ? `Active · ${formatTimeShort(activeSession.checkInTime)}`
                : todayAttendance && todayAttendance.sessionsCount > 0
                  ? `Logged ${Math.round((todayAttendance.totalDurationMinutes / 60) * 10) / 10}h`
                  : 'Not Checked In'}
            </span>
          )}
        </div>

        {isToday ? (
          <div className="space-y-2">
            {!activeSession && (
              <div className="flex items-center gap-1.5">
                {(['office', 'remote'] as WorkMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWorkMode(mode)}
                    className={`flex-1 py-1 text-xs font-semibold rounded-input border capitalize transition-colors ${
                      workMode === mode
                        ? 'bg-sidebar text-sidebar-strong border-sidebar'
                        : 'bg-surface text-text-muted border-border hover:text-text'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            <Input
              value={attendanceNote}
              onChange={(e) => setAttendanceNote(e.target.value)}
              placeholder={
                activeSession ? 'Add check-out note...' : 'Add check-in note (optional)...'
              }
              aria-label="Attendance check-in or check-out note"
            />

            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={attendanceSubmitting}
              onClick={() => void handleAttendanceAction(activeSession ? 'out' : 'in')}
              className="w-full"
              data-testid="calendar-attendance-action-btn"
            >
              {attendanceSubmitting
                ? 'Saving...'
                : activeSession
                  ? 'Check Out Now'
                  : 'Check In Now'}
            </Button>

            {attendanceFeedback && (
              <p className="text-[11px] text-primary-ink font-medium">{attendanceFeedback}</p>
            )}
          </div>
        ) : dayAttendanceRecords.length === 0 ? (
          <p className="text-xs text-text-muted">No attendance session recorded for this date.</p>
        ) : (
          <div className="space-y-1.5">
            {dayAttendanceRecords.map((rec) => (
              <div key={rec.id} className="text-xs text-text space-y-0.5">
                <div className="flex items-center justify-between font-medium">
                  <span>
                    {formatTimeShort(rec.checkInTime)} –{' '}
                    {rec.checkOutTime ? formatTimeShort(rec.checkOutTime) : 'Active'}
                  </span>
                  <span className="capitalize text-text-muted">
                    {rec.location?.workMode ?? 'office'}
                  </span>
                </div>
                {rec.notes && <p className="text-[11px] text-text-muted italic">“{rec.notes}”</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Holidays & Leaves */}
      {(dayHolidays.length > 0 || dayLeaves.length > 0) && (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
            Holidays &amp; Leave
          </span>
          {dayHolidays.map((h) => (
            <div
              key={h.id}
              className="px-3 py-2 rounded-control bg-positive-soft border border-positive-ink/20 text-xs font-semibold text-positive-ink"
            >
              Holiday: {h.name}
            </div>
          ))}
          {dayLeaves.map((l) => (
            <div
              key={l.requestId}
              className="px-3 py-2 rounded-control bg-tile-yellow border border-warning/20 text-xs text-warning flex items-center justify-between gap-2"
            >
              <span className="font-semibold truncate">{l.employeeName}</span>
              <span className="text-[11px] font-medium shrink-0">
                {l.leaveTypeName} ({l.status})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Meetings & Task Deadlines */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
            Meetings &amp; Tasks ({dayMeetings.length + dayTasks.length})
          </span>
        </div>

        {dayMeetings.length === 0 && dayTasks.length === 0 ? (
          <p className="text-xs text-text-muted py-2">
            No meetings or task deadlines scheduled for this date.
          </p>
        ) : (
          <div className="space-y-2">
            {dayMeetings.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMeeting(m.id)}
                className="w-full text-left p-2.5 rounded-control border border-border bg-surface hover:border-primary-strong/50 hover:bg-surface-muted/40 transition-colors flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-primary-ink">
                    {formatTimeShort(m.startsAt)} – {formatTimeShort(m.endsAt)}
                  </p>
                  <p className="text-xs font-bold text-text truncate mt-0.5">{m.title}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    Host: {m.organizerName} · {m.attendeeCount} attendees
                  </p>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-primary-soft text-primary-deep text-[10px] font-semibold shrink-0">
                  Meeting
                </span>
              </button>
            ))}

            {dayTasks.map((t) => (
              <div
                key={t.id}
                className="p-2.5 rounded-control border border-border bg-surface flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-bold text-text truncate">{t.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TaskPriorityBadge priority={t.priority} />
                    <TaskStatusPill status={t.status} size="sm" />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-text-subtle shrink-0">Due</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Personal To-Do List */}
      <div className="space-y-2.5 pt-2 border-t border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle block">
          Personal To-Do List ({dayTodos.length + unscheduledTodos.length})
        </span>

        <form onSubmit={handleCreateTodo} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="Add to-do for this date..."
              aria-label="Add to-do for selected date"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={todoSubmitting}>
            Add
          </Button>
        </form>

        {dayTodos.length === 0 && unscheduledTodos.length === 0 ? (
          <p className="text-xs text-text-muted">No to-dos for this day.</p>
        ) : (
          <ul className="space-y-1.5">
            {[...dayTodos, ...unscheduledTodos].map((todo) => (
              <li
                key={todo.id}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-control bg-surface-muted/50 border border-border text-xs"
              >
                <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={todo.isCompleted}
                    onChange={() => void onToggleTodo(todo.id)}
                    className="rounded border-border text-primary-strong focus:ring-primary"
                  />
                  <span
                    className={`truncate ${
                      todo.isCompleted ? 'line-through text-text-subtle' : 'text-text font-medium'
                    }`}
                  >
                    {todo.title}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void onDeleteTodo(todo.id)}
                  aria-label={`Delete to-do ${todo.title}`}
                  className="text-text-subtle hover:text-danger text-xs px-1 shrink-0"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
