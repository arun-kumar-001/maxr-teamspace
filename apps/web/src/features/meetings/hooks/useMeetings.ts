import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelMeeting,
  fetchMeetings,
  respondMeetingRsvp,
  scheduleMeeting,
  updateMeeting,
} from '../api/meetingsApi';
import type {
  MeetingStatus,
  MeetingSummary,
  MeetingWithOverlaps,
  Rsvp,
  ScheduleMeetingInput,
  UpdateMeetingInput,
} from '../types';

export interface UseMeetingsOptions {
  initialDate?: Date;
  autoFetch?: boolean;
}

export function useMeetings(options: UseMeetingsOptions = {}) {
  const { initialDate = new Date(), autoFetch = true } = options;

  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [meetings, setMeetings] = useState<MeetingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('');
  const [rsvpFilter, setRsvpFilter] = useState<Rsvp | ''>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizer' | 'invitee'>('all');

  // Compute 35-day window for the currently viewed month
  const dateWindow = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    // 7 days before month start to cover partial week
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    start.setUTCDate(start.getUTCDate() - 7);
    // 35 days forward
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    end.setUTCDate(end.getUTCDate() + 7);
    return {
      from: start.toISOString(),
      to: end.toISOString(),
    };
  }, [currentDate]);

  const loadMeetings = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMeetings(
          {
            from: dateWindow.from,
            to: dateWindow.to,
            pageSize: 100,
          },
          signal,
        );
        setMeetings(res.data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load meetings.');
      } finally {
        setLoading(false);
      }
    },
    [dateWindow],
  );

  useEffect(() => {
    if (!autoFetch) return;
    const controller = new AbortController();
    void loadMeetings(controller.signal);
    return () => controller.abort();
  }, [loadMeetings, autoFetch]);

  // Client side filtering for title, organizer, status, rsvp, role
  const filteredMeetings = useMemo(() => {
    return meetings.filter((m) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesOrganizer = m.organizerName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesOrganizer) return false;
      }
      if (statusFilter && m.status !== statusFilter) return false;
      if (rsvpFilter && m.myRsvp !== rsvpFilter) return false;
      if (roleFilter !== 'all' && m.myRole !== roleFilter) return false;
      return true;
    });
  }, [meetings, search, statusFilter, rsvpFilter, roleFilter]);

  // Chronological sort for agenda list
  const chronologicalMeetings = useMemo(() => {
    return [...filteredMeetings].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.endsAt).getTime(),
    );
  }, [filteredMeetings]);

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleSchedule = async (input: ScheduleMeetingInput): Promise<MeetingWithOverlaps> => {
    const result = await scheduleMeeting(input);
    await loadMeetings();
    return result;
  };

  const handleUpdate = async (
    id: string,
    input: UpdateMeetingInput,
  ): Promise<MeetingWithOverlaps> => {
    const result = await updateMeeting(id, input);
    await loadMeetings();
    return result;
  };

  const handleCancel = async (id: string) => {
    const result = await cancelMeeting(id);
    await loadMeetings();
    return result;
  };

  const handleRsvp = async (id: string, response: 'accepted' | 'declined' | 'tentative') => {
    const result = await respondMeetingRsvp(id, response);
    // Optimistically update
    setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, myRsvp: result.rsvp } : m)));
    return result;
  };

  return {
    meetings: filteredMeetings,
    allMeetings: meetings,
    chronologicalMeetings,
    loading,
    error,
    currentDate,
    setCurrentDate,
    dateWindow,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    rsvpFilter,
    setRsvpFilter,
    roleFilter,
    setRoleFilter,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    refetch: loadMeetings,
    schedule: handleSchedule,
    update: handleUpdate,
    cancel: handleCancel,
    rsvp: handleRsvp,
  };
}
