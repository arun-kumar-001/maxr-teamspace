import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/StateCards';
import type { MeetingSummary, Rsvp } from '../types';
import { MeetingStatusBadge } from './MeetingStatusBadge';
import { RsvpBadge } from './RsvpBadge';

export interface MeetingAgendaListProps {
  meetings: MeetingSummary[];
  loading?: boolean;
  onSelectMeeting: (id: string) => void;
  onRsvp?: (id: string, response: 'accepted' | 'declined' | 'tentative') => Promise<unknown>;
  onScheduleClick?: () => void;
  canSchedule?: boolean;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDateHeader(dateKey: string): { label: string; isToday: boolean } {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    if (!y || !m || !d) return { label: dateKey, isToday: false };
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const isToday =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    const label = date.toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return { label, isToday };
  } catch {
    return { label: dateKey, isToday: false };
  }
}

export function MeetingAgendaList({
  meetings,
  loading = false,
  onSelectMeeting,
  onRsvp,
  onScheduleClick,
  canSchedule = false,
}: MeetingAgendaListProps) {
  if (!loading && meetings.length === 0) {
    return (
      <EmptyState
        title="No meetings found"
        description="There are no scheduled meetings in this date range. Schedule one or adjust your filters."
        actionLabel={canSchedule ? 'Schedule Meeting' : undefined}
        onAction={canSchedule ? onScheduleClick : undefined}
      />
    );
  }

  // Group meetings by date (YYYY-MM-DD based on local date of startsAt)
  const grouped = meetings.reduce<Record<string, MeetingSummary[]>>((acc, meeting) => {
    const d = new Date(meeting.startsAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(meeting);
    return acc;
  }, {});

  const sortedDateKeys = Object.keys(grouped).sort();

  return (
    <div className="space-y-6" data-testid="meeting-agenda-list">
      {sortedDateKeys.map((dateKey) => {
        const items = grouped[dateKey] ?? [];
        const { label, isToday } = formatDateHeader(dateKey);

        return (
          <div key={dateKey} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text uppercase tracking-wider">{label}</h3>
              {isToday && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-soft text-primary-deep border border-border">
                  Today
                </span>
              )}
            </div>

            <div className="space-y-3">
              {items.map((meeting) => {
                const isCancelled = meeting.status === 'cancelled';
                const isInvitee = meeting.myRole === 'invitee';

                return (
                  <div
                    key={meeting.id}
                    className={`p-4 sm:p-5 rounded-tile border transition-all duration-150 ${
                      isCancelled
                        ? 'bg-surface-muted border-border opacity-75'
                        : 'bg-surface border-border hover:border-primary-strong/40 hover:shadow-card'
                    }`}
                    data-testid={`meeting-card-${meeting.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectMeeting(meeting.id)}
                            className="text-base font-semibold text-text hover:text-primary-ink text-left focus:outline-none focus:underline"
                          >
                            {meeting.title}
                          </button>
                          <MeetingStatusBadge status={meeting.status} />
                          {meeting.myRsvp && <RsvpBadge rsvp={meeting.myRsvp} />}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                          <span className="font-medium text-text">
                            {formatTime(meeting.startsAt)} – {formatTime(meeting.endsAt)}
                          </span>
                          <span>
                            Organizer:{' '}
                            <span className="text-text font-medium">
                              {meeting.organizerName}
                              {meeting.myRole === 'organizer' ? ' (You)' : ''}
                            </span>
                          </span>
                          <span>
                            Attendees:{' '}
                            <span className="text-text font-medium">{meeting.attendeeCount}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectMeeting(meeting.id)}
                          className="min-h-[44px]"
                        >
                          Details
                        </Button>
                      </div>
                    </div>

                    {/* Quick RSVP for invitees on active meetings */}
                    {!isCancelled && isInvitee && onRsvp && (
                      <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-text-muted mr-1">Your RSVP:</span>
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
                              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-pill transition-colors ${
                                isCurrent
                                  ? 'bg-primary-deep text-surface font-semibold shadow-sm'
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
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
