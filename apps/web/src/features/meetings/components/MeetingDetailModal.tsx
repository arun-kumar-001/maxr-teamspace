import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { fetchMeetingById } from '../api/meetingsApi';
import { MAX_MINUTES_CHARS, type Meeting, type Rsvp } from '../types';
import { MeetingStatusBadge } from './MeetingStatusBadge';
import { RsvpBadge } from './RsvpBadge';

export interface MeetingDetailModalProps {
  meetingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRsvp: (id: string, response: 'accepted' | 'declined' | 'tentative') => Promise<unknown>;
  onCancelMeeting?: (id: string) => Promise<unknown>;
  onUpdateMinutes?: (id: string, minutes: string, version: number) => Promise<unknown>;
  onEditMeeting?: (meeting: Meeting) => void;
  currentEmployeeId?: string;
}

export function MeetingDetailModal({
  meetingId,
  isOpen,
  onClose,
  onRsvp,
  onCancelMeeting,
  onUpdateMinutes,
  onEditMeeting,
  currentEmployeeId,
}: MeetingDetailModalProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Minutes editing state
  const [isEditingMinutes, setIsEditingMinutes] = useState(false);
  const [minutesText, setMinutesText] = useState('');
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [respondingRsvp, setRespondingRsvp] = useState(false);

  useEffect(() => {
    if (!isOpen || !meetingId) {
      setMeeting(null);
      setIsEditingMinutes(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsEditingMinutes(false);

    void fetchMeetingById(meetingId)
      .then((data) => {
        setMeeting(data);
        setMinutesText(data.minutes ?? '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load meeting details.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, meetingId]);

  if (!isOpen) return null;

  const isOrganizer = meeting?.organizerEmployeeId === currentEmployeeId;
  const isCancelled = meeting?.status === 'cancelled';
  const myAttendee = meeting?.attendees.find((a) => a.employeeId === currentEmployeeId);
  const isInvitee = !isOrganizer && !!myAttendee;

  const handleSaveMinutes = async () => {
    if (!meeting || !onUpdateMinutes) return;
    setSavingMinutes(true);
    try {
      await onUpdateMinutes(meeting.id, minutesText, meeting.version);
      setMeeting((prev) =>
        prev ? { ...prev, minutes: minutesText, version: prev.version + 1 } : null,
      );
      setIsEditingMinutes(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save minutes.');
    } finally {
      setSavingMinutes(false);
    }
  };

  const handleCancelMeetingClick = async () => {
    if (!meeting || !onCancelMeeting) return;
    if (
      !window.confirm('Are you sure you want to cancel this meeting? This action cannot be undone.')
    ) {
      return;
    }
    setCancelling(true);
    try {
      await onCancelMeeting(meeting.id);
      setMeeting((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to cancel meeting.');
    } finally {
      setCancelling(false);
    }
  };

  const handleRsvpClick = async (response: 'accepted' | 'declined' | 'tentative') => {
    if (!meeting) return;
    setRespondingRsvp(true);
    try {
      await onRsvp(meeting.id, response);
      // Update local state
      setMeeting((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attendees: prev.attendees.map((a) =>
            a.employeeId === currentEmployeeId
              ? { ...a, rsvp: response, respondedAt: new Date().toISOString() }
              : a,
          ),
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update RSVP.');
    } finally {
      setRespondingRsvp(false);
    }
  };

  // Compute attendee statistics
  const attendeeCounts = (meeting?.attendees ?? []).reduce<Record<Rsvp, number>>(
    (acc, a) => {
      acc[a.rsvp] = (acc[a.rsvp] || 0) + 1;
      return acc;
    },
    { accepted: 0, tentative: 0, declined: 0, pending: 0 },
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={meeting?.title || 'Meeting Details'}
      maxWidth="lg"
    >
      <div className="space-y-5" data-testid="meeting-detail-modal">
        {loading && (
          <div className="py-12 text-center text-sm text-text-muted">
            Loading meeting details...
          </div>
        )}

        {error && (
          <div className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-tile">
            {error}
          </div>
        )}

        {!loading && meeting && (
          <>
            {/* Header info strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-surface-muted rounded-tile border border-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted uppercase">Status:</span>
                  <MeetingStatusBadge status={meeting.status} />
                </div>
                <div className="text-xs text-text-muted">
                  Organizer:{' '}
                  <span className="font-medium text-text">
                    {meeting.organizerName} {isOrganizer ? '(You)' : ''}
                  </span>
                </div>
              </div>

              <div className="text-xs text-right space-y-0.5 text-text-muted">
                <div>
                  <span className="font-semibold text-text">
                    {new Date(meeting.startsAt).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  {new Date(meeting.startsAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  –{' '}
                  {new Date(meeting.endsAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>

            {/* Agenda section */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-text uppercase tracking-wider">Agenda</h4>
              <div
                className="p-3 bg-surface border border-border rounded-tile text-sm text-text whitespace-pre-wrap min-h-[60px]"
                data-testid="meeting-agenda-text"
              >
                {meeting.agenda || (
                  <span className="text-text-muted italic">No agenda provided.</span>
                )}
              </div>
            </div>

            {/* Minutes of Meeting (MoM) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                  Minutes of Meeting (MoM)
                </h4>
                {isOrganizer && !isCancelled && !isEditingMinutes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMinutesText(meeting.minutes ?? '');
                      setIsEditingMinutes(true);
                    }}
                    className="min-h-[36px] text-xs"
                    data-testid="edit-minutes-btn"
                  >
                    {meeting.minutes ? 'Edit Minutes' : 'Add Minutes'}
                  </Button>
                )}
              </div>

              {isEditingMinutes ? (
                <div className="space-y-2">
                  <textarea
                    value={minutesText}
                    onChange={(e) => setMinutesText(e.target.value)}
                    placeholder="Enter discussion notes, decisions, and action items..."
                    rows={6}
                    maxLength={MAX_MINUTES_CHARS}
                    className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-tile focus:outline-none focus:border-primary-strong"
                    data-testid="minutes-textarea"
                  />
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>
                      {minutesText.length} / {MAX_MINUTES_CHARS} characters
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingMinutes(false)}
                        disabled={savingMinutes}
                        className="min-h-[36px]"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleSaveMinutes()}
                        isLoading={savingMinutes}
                        disabled={savingMinutes}
                        className="min-h-[36px]"
                        data-testid="save-minutes-btn"
                      >
                        Save Minutes
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="p-3 bg-surface border border-border rounded-tile text-sm text-text whitespace-pre-wrap min-h-[60px]"
                  data-testid="meeting-minutes-text"
                >
                  {meeting.minutes || (
                    <span className="text-text-muted italic">No minutes recorded yet.</span>
                  )}
                </div>
              )}
            </div>

            {/* Attendees & RSVP list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                  Attendees ({meeting.attendees.length})
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <span className="text-positive-ink font-medium">
                    {attendeeCounts.accepted} Accepted
                  </span>
                  <span>·</span>
                  <span className="text-warning font-medium">
                    {attendeeCounts.tentative} Tentative
                  </span>
                  <span>·</span>
                  <span className="text-danger font-medium">
                    {attendeeCounts.declined} Declined
                  </span>
                  <span>·</span>
                  <span>{attendeeCounts.pending} Pending</span>
                </div>
              </div>

              <div className="border border-border rounded-tile max-h-48 overflow-y-auto bg-surface divide-y divide-border">
                {meeting.attendees.map((a) => (
                  <div
                    key={a.employeeId}
                    className="px-3 py-2 flex items-center justify-between text-xs"
                    data-testid={`attendee-row-${a.employeeId}`}
                  >
                    <div>
                      <span className="font-medium text-text">{a.name}</span>
                      {a.employeeId === currentEmployeeId && (
                        <span className="text-primary-ink font-medium ml-1">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <RsvpBadge rsvp={a.rsvp} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RSVP Response bar for invitees */}
            {isInvitee && !isCancelled && (
              <div className="p-3 bg-surface-muted rounded-tile border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-semibold text-text">Your Response: </span>
                  <span className="text-text-muted">
                    {myAttendee?.rsvp ? myAttendee.rsvp.toUpperCase() : 'PENDING'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(['accepted', 'tentative', 'declined'] as const).map((r) => {
                    const isSelected = myAttendee?.rsvp === r;
                    return (
                      <Button
                        key={r}
                        type="button"
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        disabled={respondingRsvp}
                        onClick={() => void handleRsvpClick(r)}
                        className="min-h-[44px] capitalize"
                        data-testid={`detail-rsvp-${r}`}
                      >
                        {r}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal footer controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <div>
                {isOrganizer && !isCancelled && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleCancelMeetingClick()}
                    isLoading={cancelling}
                    disabled={cancelling}
                    className="min-h-[44px]"
                    data-testid="cancel-meeting-btn"
                  >
                    Cancel Meeting
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isOrganizer && !isCancelled && onEditMeeting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onEditMeeting(meeting);
                    }}
                    className="min-h-[44px]"
                    data-testid="edit-meeting-btn"
                  >
                    Edit Details
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px]">
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
