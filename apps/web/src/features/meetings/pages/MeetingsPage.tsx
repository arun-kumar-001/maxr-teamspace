import { useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { StatCard } from '../../../components/ui/StatCard';
import { ErrorState } from '../../../components/ui/StateCards';
import { MeetingAgendaList } from '../components/MeetingAgendaList';
import { MeetingCalendarView } from '../components/MeetingCalendarView';
import { MeetingDetailModal } from '../components/MeetingDetailModal';
import { MeetingFormModal } from '../components/MeetingFormModal';
import { useMeetings } from '../hooks/useMeetings';
import type { Meeting, MeetingStatus, Rsvp } from '../types';

export function MeetingsPage() {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const currentEmployeeId = user?.employeeId;

  const canSchedule =
    effectiveRole === ROLES.ADMIN ||
    effectiveRole === ROLES.HR_MANAGER ||
    effectiveRole === ROLES.TEAM_LEAD;

  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  const {
    meetings,
    allMeetings,
    chronologicalMeetings,
    loading,
    error,
    currentDate,
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
    refetch,
    schedule,
    update,
    cancel,
    rsvp,
  } = useMeetings({ autoFetch: true });

  // Compute metrics from allMeetings in current window
  const metrics = useMemo(() => {
    const today = new Date();
    const isSameDate = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();

    let totalActive = 0;
    let todayCount = 0;
    let pendingRsvpCount = 0;
    let organizedCount = 0;

    for (const m of allMeetings) {
      if (m.status === 'scheduled') totalActive++;
      if (isSameDate(new Date(m.startsAt), today)) todayCount++;
      if (m.myRole === 'invitee' && m.myRsvp === 'pending' && m.status === 'scheduled') {
        pendingRsvpCount++;
      }
      if (m.myRole === 'organizer') organizedCount++;
    }

    return {
      totalActive,
      todayCount,
      pendingRsvpCount,
      organizedCount,
    };
  }, [allMeetings]);

  const monthYearLabel = currentDate.toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 pb-12" data-testid="meetings-page">
      {/* Top Greeting & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text">
            Meetings & Calendar
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Coordinate team agendas, schedule sessions, and track minutes of meeting.
          </p>
        </div>

        {canSchedule && (
          <Button
            variant="primary"
            onClick={() => setIsScheduleOpen(true)}
            className="self-start sm:self-auto min-h-[44px]"
            data-testid="schedule-meeting-button"
          >
            <span className="mr-1.5 text-base leading-none">+</span> Schedule Meeting
          </Button>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Scheduled Meetings"
          value={metrics.totalActive}
          caption="In current view window"
          isLoading={loading && allMeetings.length === 0}
        />
        <StatCard
          label="Today's Meetings"
          value={metrics.todayCount}
          caption={new Date().toLocaleDateString([], { month: 'short', day: 'numeric' })}
          isLoading={loading && allMeetings.length === 0}
        />
        <StatCard
          label="Pending Your RSVP"
          value={metrics.pendingRsvpCount}
          caption="Awaiting your response"
          isLoading={loading && allMeetings.length === 0}
        />
        <StatCard
          label="Organized by You"
          value={metrics.organizedCount}
          caption="You are host"
          isLoading={loading && allMeetings.length === 0}
        />
      </div>

      {/* View Switcher, Month Navigation & Filter Controls */}
      <div className="p-4 bg-surface border border-border rounded-card shadow-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              aria-label="Previous month"
              className="min-h-[44px]"
            >
              &larr; Prev
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday} className="min-h-[44px]">
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="min-h-[44px]"
            >
              Next &rarr;
            </Button>
            <span
              className="ml-2 font-display text-lg font-semibold text-text"
              data-testid="current-month-heading"
            >
              {monthYearLabel}
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <SegmentedControl
              ariaLabel="View mode"
              options={[
                { value: 'calendar', label: 'Calendar' },
                { value: 'agenda', label: 'Agenda List' },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as 'calendar' | 'agenda')}
            />
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-border">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or organizer..."
            aria-label="Search meetings"
            data-testid="meeting-search-input"
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MeetingStatus | '')}
            aria-label="Filter by status"
            data-testid="meeting-status-filter"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | 'organizer' | 'invitee')}
            aria-label="Filter by role"
            data-testid="meeting-role-filter"
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'organizer', label: 'Organized by Me' },
              { value: 'invitee', label: 'Invited' },
            ]}
          />

          <Select
            value={rsvpFilter}
            onChange={(e) => setRsvpFilter(e.target.value as Rsvp | '')}
            aria-label="Filter by RSVP"
            data-testid="meeting-rsvp-filter"
            options={[
              { value: '', label: 'All Responses' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'tentative', label: 'Tentative' },
              { value: 'declined', label: 'Declined' },
              { value: 'pending', label: 'Pending' },
            ]}
          />
        </div>
      </div>

      {/* Content Area */}
      {error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : viewMode === 'calendar' ? (
        <div className="space-y-4">
          <MeetingCalendarView
            meetings={meetings}
            currentDate={currentDate}
            onSelectMeeting={(id) => setSelectedMeetingId(id)}
          />
          <div className="block sm:hidden text-center text-xs text-text-muted">
            Tip: Switch to agenda view for mobile-optimized layout.
          </div>
        </div>
      ) : (
        <MeetingAgendaList
          meetings={chronologicalMeetings}
          loading={loading}
          onSelectMeeting={(id) => setSelectedMeetingId(id)}
          onRsvp={rsvp}
          onScheduleClick={() => setIsScheduleOpen(true)}
          canSchedule={canSchedule}
        />
      )}

      {/* Schedule Meeting Modal */}
      <MeetingFormModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        mode="create"
        onSubmitCreate={schedule}
      />

      {/* Edit Meeting Modal */}
      <MeetingFormModal
        isOpen={Boolean(editingMeeting)}
        onClose={() => setEditingMeeting(null)}
        mode="edit"
        initialMeeting={editingMeeting}
        onSubmitEdit={update}
      />

      {/* Meeting Detail Modal */}
      <MeetingDetailModal
        meetingId={selectedMeetingId}
        isOpen={Boolean(selectedMeetingId)}
        onClose={() => setSelectedMeetingId(null)}
        onRsvp={rsvp}
        onCancelMeeting={cancel}
        onUpdateMinutes={async (id, minutesText, version) => {
          await update(id, { minutes: minutesText, version });
        }}
        onEditMeeting={(m) => setEditingMeeting(m)}
        currentEmployeeId={currentEmployeeId}
      />
    </div>
  );
}
