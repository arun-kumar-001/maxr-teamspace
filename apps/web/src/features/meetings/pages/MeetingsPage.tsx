import { useCallback, useEffect, useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Select } from '../../../components/ui/Select';
import { ErrorState } from '../../../components/ui/StateCards';
import {
  checkIn,
  checkOut,
  fetchMyAttendanceHistory,
  fetchTodayAttendance,
} from '../../attendance/api/attendance';
import type { AttendanceRecord, TodayAttendanceSummary, WorkMode } from '../../attendance/types';
import { fetchHolidays, fetchLeaveCalendar } from '../../leave/api/leave';
import type { Holiday, LeaveCalendarEntry } from '../../leave/types';
import { fetchMyTasks, fetchTeamTasks } from '../../tasks/api/tasksApi';
import type { Task } from '../../tasks/types';
import { createTodo, deleteTodo, fetchTodos, toggleTodo } from '../../todos/api/todosApi';
import type { PersonalTodo } from '../../todos/types';
import { CalendarDayPanel } from '../components/CalendarDayPanel';
import { MeetingAgendaList } from '../components/MeetingAgendaList';
import { MeetingCalendarView } from '../components/MeetingCalendarView';
import { MeetingDetailModal } from '../components/MeetingDetailModal';
import { MeetingFormModal } from '../components/MeetingFormModal';
import { useMeetings } from '../hooks/useMeetings';
import type { Meeting, MeetingStatus, Rsvp } from '../types';

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function MeetingsPage() {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;
  const currentEmployeeId = user?.employeeId;

  const canSchedule =
    effectiveRole === ROLES.ADMIN ||
    effectiveRole === ROLES.HR_MANAGER ||
    effectiveRole === ROLES.TEAM_LEAD;

  const todayDateKey = useMemo(() => toLocalDateKey(new Date()), []);
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [selectedDate, setSelectedDate] = useState<string>(todayDateKey);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);

  // Unified calendar datasets (Attendance, Tasks, To-Dos, Holidays, Leaves)
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendanceSummary | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [leaves, setLeaves] = useState<LeaveCalendarEntry[]>([]);

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

  const loadUnifiedCalendarContext = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = toLocalDateKey(new Date(year, month, 1));
    const monthEnd = toLocalDateKey(new Date(year, month + 1, 0));

    const tasksLoader = canSchedule
      ? fetchTeamTasks({ pageSize: 100 })
      : fetchMyTasks({ pageSize: 100 });

    void Promise.allSettled([
      fetchTodayAttendance(),
      fetchMyAttendanceHistory({ startDate: monthStart, endDate: monthEnd, pageSize: 60 }),
      fetchTodos({ limit: 100 }),
      tasksLoader,
      fetchHolidays(year),
      fetchLeaveCalendar(monthStart, monthEnd),
    ]).then(([todayRes, histRes, todosRes, tasksRes, holRes, leaveRes]) => {
      if (todayRes.status === 'fulfilled') setTodayAttendance(todayRes.value);
      if (histRes.status === 'fulfilled') setAttendanceHistory(histRes.value.data || []);
      if (todosRes.status === 'fulfilled') setTodos(todosRes.value.data || []);
      if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value.data || []);
      if (holRes.status === 'fulfilled') setHolidays(holRes.value || []);
      if (leaveRes.status === 'fulfilled') setLeaves(leaveRes.value || []);
    });
  }, [currentDate, canSchedule]);

  useEffect(() => {
    loadUnifiedCalendarContext();
  }, [loadUnifiedCalendarContext]);

  const handleGoToToday = () => {
    goToToday();
    setSelectedDate(todayDateKey);
  };

  const handleCalendarCheckIn = async (workMode: WorkMode, notes?: string) => {
    await checkIn({ location: { workMode }, notes });
    loadUnifiedCalendarContext();
  };

  const handleCalendarCheckOut = async (notes?: string) => {
    await checkOut({ notes });
    loadUnifiedCalendarContext();
  };

  const handleAddTodo = async (title: string, dueDate: string) => {
    const created = await createTodo({ title, dueDate });
    setTodos((prev) => [created, ...prev]);
  };

  const handleToggleTodo = async (id: string) => {
    const updated = await toggleTodo(id);
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  const handleDeleteTodo = async (id: string) => {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  // Compute summary counts
  const metrics = useMemo(() => {
    let totalActive = 0;
    let pendingRsvpCount = 0;

    for (const m of allMeetings) {
      if (m.status === 'scheduled') totalActive++;
      if (m.myRole === 'invitee' && m.myRsvp === 'pending' && m.status === 'scheduled') {
        pendingRsvpCount++;
      }
    }

    const openTasks = tasks.filter((t) => t.status !== 'completed').length;
    const openTodos = todos.filter((td) => !td.isCompleted).length;

    return {
      totalActive,
      pendingRsvpCount,
      openTasks,
      openTodos,
    };
  }, [allMeetings, tasks, todos]);

  const monthYearLabel = currentDate.toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });

  const selectedDayAttendance = useMemo(
    () => attendanceHistory.filter((r) => r.workDate === selectedDate),
    [attendanceHistory, selectedDate],
  );

  return (
    <div className="space-y-4 pb-12" data-testid="meetings-page">
      {/* Compact Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text">Calendar</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-text">{metrics.totalActive}</span>
              <span>Scheduled Meetings</span>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-text">{metrics.openTasks}</span>
              <span>open tasks</span>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-text">{metrics.openTodos}</span>
              <span>to-dos</span>
            </span>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-text">{metrics.pendingRsvpCount}</span>
              <span>Pending Your RSVP</span>
            </span>
          </p>
        </div>

        {canSchedule && (
          <Button
            variant="primary"
            onClick={() => setIsScheduleOpen(true)}
            className="self-start sm:self-auto min-h-[42px]"
            data-testid="schedule-meeting-button"
          >
            + Book time
          </Button>
        )}
      </div>

      {/* Slim Controls Bar (Month nav, Search, Filter toggle, Calendar/Agenda switcher) */}
      <div className="p-3 sm:p-4 bg-surface border border-border rounded-card shadow-card space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              aria-label="Previous month"
              className="min-h-[38px]"
            >
              &larr; Prev
            </Button>
            <Button variant="outline" size="sm" onClick={handleGoToToday} className="min-h-[38px]">
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="min-h-[38px]"
            >
              Next &rarr;
            </Button>
            <span
              className="ml-2 font-display text-base sm:text-lg font-bold text-text"
              data-testid="current-month-heading"
            >
              {monthYearLabel}
            </span>
          </div>

          {/* Search, Optional Filter Toggle & View Mode Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-full sm:w-56">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or organizer..."
                aria-label="Search meetings"
                data-testid="meeting-search-input"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className="min-h-[38px]"
            >
              {showAdvancedFilters ? 'Hide Filters' : 'Filters'}
            </Button>

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

        {/* Collapsible Meeting Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border">
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
        )}
      </div>

      {/* Content Area */}
      {error ? (
        <ErrorState message={error} onRetry={() => void refetch()} />
      ) : viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8">
            <MeetingCalendarView
              meetings={meetings}
              tasks={tasks}
              todos={todos}
              holidays={holidays}
              leaves={leaves}
              attendanceRecords={attendanceHistory}
              currentDate={currentDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onSelectMeeting={(id) => setSelectedMeetingId(id)}
            />
          </div>
          <div className="lg:col-span-4">
            <CalendarDayPanel
              selectedDate={selectedDate}
              todayDateKey={todayDateKey}
              meetings={meetings}
              tasks={tasks}
              todos={todos}
              holidays={holidays}
              leaves={leaves}
              todayAttendance={todayAttendance}
              dayAttendanceRecords={selectedDayAttendance}
              canSchedule={canSchedule}
              onQuickScheduleClick={() => setIsScheduleOpen(true)}
              onSelectMeeting={(id) => setSelectedMeetingId(id)}
              onCheckIn={handleCalendarCheckIn}
              onCheckOut={handleCalendarCheckOut}
              onAddTodo={handleAddTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
            />
          </div>
        </div>
      ) : (
        <MeetingAgendaList
          meetings={chronologicalMeetings}
          tasks={tasks}
          todos={todos}
          holidays={holidays}
          leaves={leaves}
          loading={loading}
          onSelectMeeting={(id) => setSelectedMeetingId(id)}
          onRsvp={rsvp}
          onToggleTodo={handleToggleTodo}
          onScheduleClick={() => setIsScheduleOpen(true)}
          canSchedule={canSchedule}
        />
      )}

      {/* Book Time / Schedule Modal */}
      <MeetingFormModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        mode="create"
        defaultDate={selectedDate}
        onSubmitCreate={schedule}
      />

      {/* Edit Event Modal */}
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
