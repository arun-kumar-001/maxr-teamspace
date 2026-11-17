import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/StateCards';
import type { Holiday, LeaveCalendarEntry } from '../../leave/types';
import { TaskPriorityBadge } from '../../tasks/components/TaskPriorityBadge';
import type { Task } from '../../tasks/types';
import type { PersonalTodo } from '../../todos/types';
import type { MeetingSummary, Rsvp } from '../types';
import { MeetingStatusBadge } from './MeetingStatusBadge';
import { RsvpBadge } from './RsvpBadge';

export interface MeetingAgendaListProps {
  meetings: MeetingSummary[];
  tasks?: Task[];
  todos?: PersonalTodo[];
  holidays?: Holiday[];
  leaves?: LeaveCalendarEntry[];
  loading?: boolean;
  onSelectMeeting: (id: string) => void;
  onRsvp?: (id: string, response: 'accepted' | 'declined' | 'tentative') => Promise<unknown>;
  onToggleTodo?: (id: string) => Promise<void>;
  onScheduleClick?: () => void;
  canSchedule?: boolean;
}

interface AgendaDayItem {
  id: string;
  kind: 'meeting' | 'task' | 'todo' | 'holiday' | 'leave';
  sortTime: number;
  timeLabel: string;
  durationLabel?: string;
  title: string;
  subtitle: string;
  meeting?: MeetingSummary;
  task?: Task;
  todo?: PersonalTodo;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDuration(startsAt: string, endsAt: string): string {
  const mins = Math.max(
    0,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000),
  );
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  return `${Math.round(hrs * 10) / 10} h`;
}

function formatDateMeta(dateKey: string): {
  dayNum: string;
  subMonthDay: string;
  titleLabel: string;
  isToday: boolean;
} {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d)
      return { dayNum: dateKey, subMonthDay: '', titleLabel: dateKey, isToday: false };
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

    const isToday = diffDays === 0;
    const titleLabel =
      diffDays === 0
        ? 'Today'
        : diffDays === 1
          ? 'Tomorrow'
          : date.toLocaleDateString('en-US', { weekday: 'long' });

    const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
    const weekdayShort = date.toLocaleDateString('en-US', { weekday: 'short' });

    return {
      dayNum: String(d),
      subMonthDay: `${monthShort} ${weekdayShort}`,
      titleLabel,
      isToday,
    };
  } catch {
    return { dayNum: dateKey, subMonthDay: '', titleLabel: dateKey, isToday: false };
  }
}

export function MeetingAgendaList({
  meetings,
  tasks = [],
  todos = [],
  holidays = [],
  leaves = [],
  loading = false,
  onSelectMeeting,
  onRsvp,
  onToggleTodo,
  onScheduleClick,
  canSchedule = false,
}: MeetingAgendaListProps) {
  const byDate = new Map<string, AgendaDayItem[]>();
  const addItem = (dateKey: string, item: AgendaDayItem) => {
    const list = byDate.get(dateKey) ?? [];
    list.push(item);
    byDate.set(dateKey, list);
  };

  for (const h of holidays) {
    addItem(h.date, {
      id: `hol-${h.id}`,
      kind: 'holiday',
      sortTime: 0,
      timeLabel: 'All day',
      title: h.name,
      subtitle: 'Company Holiday',
    });
  }

  for (const m of meetings) {
    const d = new Date(m.startsAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    addItem(dateKey, {
      id: `mtg-${m.id}`,
      kind: 'meeting',
      sortTime: d.getTime(),
      timeLabel: formatTime(m.startsAt),
      durationLabel: formatDuration(m.startsAt, m.endsAt),
      title: m.title,
      subtitle: `Host: ${m.organizerName}${m.myRole === 'organizer' ? ' (You)' : ''} · ${m.attendeeCount} attendees`,
      meeting: m,
    });
  }

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const dateKey = t.dueDate.slice(0, 10);
    addItem(dateKey, {
      id: `task-${t.id}`,
      kind: 'task',
      sortTime: 90_000_000_000_000,
      timeLabel: 'Due',
      durationLabel: t.isOverdue ? 'Overdue' : undefined,
      title: t.title,
      subtitle: `${t.projectName ?? 'Standalone'} · ${t.assigneeName}`,
      task: t,
    });
  }

  for (const td of todos) {
    if (!td.dueDate) continue;
    const dateKey = td.dueDate.slice(0, 10);
    addItem(dateKey, {
      id: `todo-${td.id}`,
      kind: 'todo',
      sortTime: 91_000_000_000_000,
      timeLabel: 'To-Do',
      title: td.title,
      subtitle: td.isCompleted ? 'Completed' : 'Personal checklist',
      todo: td,
    });
  }

  for (const l of leaves) {
    addItem(l.startDate, {
      id: `leave-${l.requestId}`,
      kind: 'leave',
      sortTime: 1,
      timeLabel: 'Leave',
      title: `${l.employeeName} · ${l.leaveTypeName}`,
      subtitle: `${l.startDate} to ${l.endDate} (${l.status})`,
    });
  }

  const sortedDateKeys = Array.from(byDate.keys()).sort();

  if (!loading && sortedDateKeys.length === 0) {
    return (
      <EmptyState
        title="No calendar events found"
        description="Nothing scheduled in this date range. Click Book time or adjust your filters."
        actionLabel={canSchedule ? 'Book time' : undefined}
        onAction={canSchedule ? onScheduleClick : undefined}
      />
    );
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');

  const accentBorderByKind: Record<AgendaDayItem['kind'], string> = {
    meeting: 'border-l-primary-strong',
    task: 'border-l-sky-600',
    todo: 'border-l-purple-600',
    holiday: 'border-l-positive-ink',
    leave: 'border-l-warning',
  };

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start"
      data-testid="meeting-agenda-list"
    >
      {sortedDateKeys.map((dateKey) => {
        const items = (byDate.get(dateKey) ?? []).sort((a, b) => a.sortTime - b.sortTime);
        const meta = formatDateMeta(dateKey);

        return (
          <div
            key={dateKey}
            className={`rounded-card bg-surface border shadow-card overflow-hidden ${
              meta.isToday ? 'border-primary-strong ring-1 ring-primary/30' : 'border-border'
            }`}
          >
            {/* Day Card Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between gap-3 bg-surface-muted/40">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-tile flex flex-col items-center justify-center leading-none shrink-0 ${
                    meta.isToday ? 'bg-primary-deep text-surface' : 'bg-sidebar text-sidebar-strong'
                  }`}
                >
                  <span className="text-base font-display font-bold tabular-nums">
                    {meta.dayNum}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider opacity-85 mt-0.5">
                    {meta.subMonthDay}
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-text">{meta.titleLabel}</h3>
                  <p className="text-[11px] text-text-muted">{dateKey}</p>
                </div>
              </div>

              <span className="w-6 h-6 rounded-full bg-surface-muted border border-border text-xs font-semibold text-text-muted flex items-center justify-center tabular-nums">
                {items.length}
              </span>
            </div>

            {/* Day Schedule Rows */}
            <div className="divide-y divide-border">
              {items.map((item) => {
                if (item.kind === 'meeting' && item.meeting) {
                  const meeting = item.meeting;
                  const isCancelled = meeting.status === 'cancelled';
                  const isInvitee = meeting.myRole === 'invitee';

                  return (
                    <div
                      key={item.id}
                      data-testid={`meeting-card-${meeting.id}`}
                      className={`p-3.5 transition-colors ${
                        isCancelled ? 'opacity-65 bg-surface-muted/40' : 'hover:bg-surface-muted/30'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-16 shrink-0 text-xs pt-0.5">
                          <span className="font-semibold text-text block tabular-nums">
                            {item.timeLabel}
                          </span>
                          {item.durationLabel && (
                            <span className="text-[11px] text-text-subtle">
                              {item.durationLabel}
                            </span>
                          )}
                        </div>

                        <div
                          className={`flex-1 min-w-0 pl-3 border-l-2 ${accentBorderByKind.meeting} space-y-1.5`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[11px] font-semibold text-primary-ink block">
                                Meeting
                              </span>
                              <button
                                type="button"
                                onClick={() => onSelectMeeting(meeting.id)}
                                className="text-sm font-bold text-text hover:text-primary-ink text-left truncate block max-w-full"
                              >
                                {meeting.title}
                              </button>
                              <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <MeetingStatusBadge status={meeting.status} />
                              {meeting.myRsvp && <RsvpBadge rsvp={meeting.myRsvp} />}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onSelectMeeting(meeting.id)}
                              >
                                Details
                              </Button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                            <div className="flex items-center gap-1">
                              <span className="w-6 h-6 rounded-full bg-primary-soft text-primary-deep text-[10px] font-semibold flex items-center justify-center border border-border">
                                {getInitials(meeting.organizerName)}
                              </span>
                              {meeting.attendeeCount > 1 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-surface-muted text-[10px] text-text-muted font-medium">
                                  +{meeting.attendeeCount - 1}
                                </span>
                              )}
                            </div>

                            {!isCancelled && isInvitee && onRsvp && (
                              <div className="flex items-center gap-1.5">
                                {(['accepted', 'tentative', 'declined'] as const).map((r) => {
                                  const isCurrent = meeting.myRsvp === r;
                                  const labels: Record<Rsvp, string> = {
                                    accepted: 'Accept',
                                    tentative: 'Tentative',
                                    declined: 'Decline',
                                    pending: 'Pending',
                                  };
                                  return (
                                    <button
                                      key={r}
                                      type="button"
                                      onClick={() => void onRsvp(meeting.id, r)}
                                      className={`px-2.5 py-1 text-[11px] font-medium rounded-pill transition-colors ${
                                        isCurrent
                                          ? 'bg-primary-deep text-surface font-semibold'
                                          : 'bg-surface-muted text-text-muted hover:text-text hover:bg-border/50'
                                      }`}
                                      data-testid={`quick-rsvp-${meeting.id}-${r}`}
                                    >
                                      {labels[r]}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="p-3.5 hover:bg-surface-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-16 shrink-0 text-xs pt-0.5">
                        <span className="font-semibold text-text block">{item.timeLabel}</span>
                        {item.durationLabel && (
                          <span className="text-[11px] text-danger font-medium">
                            {item.durationLabel}
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex-1 min-w-0 pl-3 border-l-2 ${accentBorderByKind[item.kind]} flex items-start justify-between gap-2`}
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-text-subtle capitalize block">
                            {item.kind === 'todo' ? 'Personal To-Do' : item.kind}
                          </span>
                          <p
                            className={`text-sm font-semibold truncate ${
                              item.todo?.isCompleted ? 'line-through text-text-subtle' : 'text-text'
                            }`}
                          >
                            {item.title}
                          </p>
                          <p className="text-xs text-text-muted truncate">{item.subtitle}</p>
                        </div>

                        {item.kind === 'task' && item.task && (
                          <TaskPriorityBadge priority={item.task.priority} />
                        )}
                        {item.kind === 'todo' && item.todo && onToggleTodo && (
                          <input
                            type="checkbox"
                            checked={item.todo.isCompleted}
                            onChange={() => void onToggleTodo(item.todo!.id)}
                            aria-label={`Toggle ${item.title}`}
                            className="mt-1 rounded border-border text-primary-strong focus:ring-primary"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
