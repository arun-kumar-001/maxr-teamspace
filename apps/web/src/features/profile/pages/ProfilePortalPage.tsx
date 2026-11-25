import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_DISPLAY_NAMES, ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { TimeTrackerCard } from '../../attendance';
import { fetchMyAttendanceHistory } from '../../attendance/api/attendance';
import { leaveFractionsFor, plannedFor } from '../../attendance/lib/timesheet-plan';
import { fetchHolidays, fetchLeaveCalendar } from '../../leave/api/leave';
import { fetchAttendancePolicy } from '../../shifts/api/shifts';
import { downloadPayslipPdf, fetchMyPayslips } from '../../payslips/api/payslips';
import { changeTaskStatus, createTask, fetchMyTasks } from '../../tasks/api/tasksApi';
import {
  applyTaskOverrides,
  onTaskCreated,
  onTaskStatusChanged,
  saveTaskStatusOverride,
} from '../../tasks/task-sync';
import { TaskFormModal } from '../../tasks/components/TaskFormModal';
import type { Task } from '../../tasks/types';
import { fetchProjects } from '../../projects/api/projectsApi';
import type { PayslipRecord } from '../../payslips/types';
import { fetchEmployeeShiftAssignments, fetchShifts } from '../../shifts/api/shifts';

function TaskItemIcon({ task }: { task: Task }) {
  if (task.priority === 'urgent' || task.priority === 'high') {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  if (task.dueDate) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    );
  }
  if (task.projectId) {
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The seven dates of this week, Sunday first, with whether each is today. */
function thisWeek(now: Date): Array<{ iso: string; initial: string; isToday: boolean }> {
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  return DAY_INITIALS.map((initial, i) => {
    const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    return { iso: localIso(d), initial, isToday: localIso(d) === localIso(now) };
  });
}

/**
 * Shared My Profile portal view available across Admin, HR Manager, Team Lead, and Staff portals.
 */
export function ProfilePortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // This week's hours and days worked, and what was planned so far, from the server
  const week = useMemo(() => thisWeek(new Date()), []);
  const [weekProgress, setWeekProgress] = useState<{
    workedHours: number;
    workedDates: Set<string>;
    plannedHours: number | null;
  }>({ workedHours: 0, workedDates: new Set(), plannedHours: null });
  const employeeId = user?.employeeId;
  useEffect(() => {
    let active = true;
    const first = week[0]?.iso ?? '';
    const last = week[6]?.iso ?? '';
    const todayIso = localIso(new Date());
    void Promise.allSettled([
      fetchMyAttendanceHistory({ startDate: first, endDate: last, pageSize: 50 }),
      fetchAttendancePolicy(),
      fetchHolidays(Number(todayIso.slice(0, 4))),
      fetchLeaveCalendar(first, last),
    ]).then(([attendance, policy, holidays, leaves]) => {
      if (!active || attendance.status !== 'fulfilled') return;
      const records = attendance.value.data;
      const minutes = records.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
      const planned =
        policy.status === 'fulfilled' && employeeId
          ? plannedFor({
              weekDates: week.map((d) => d.iso),
              today: todayIso,
              workDays: policy.value.workWeek.days,
              holidays: new Set(
                holidays.status === 'fulfilled' ? holidays.value.map((h) => h.date) : [],
              ),
              leaveFractions: leaveFractionsFor(
                leaves.status === 'fulfilled' ? leaves.value : [],
                employeeId,
                week.map((d) => d.iso),
              ),
              fullDayMinutes: policy.value.fullDayMinutes,
            }).plannedHours
          : null;
      setWeekProgress({
        workedHours: Math.round((minutes / 60) * 10) / 10,
        workedDates: new Set(records.filter((r) => r.checkInTime).map((r) => r.workDate)),
        plannedHours: planned,
      });
    });
    return () => {
      active = false;
    };
  }, [week, employeeId]);

  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [shiftSchedule, setShiftSchedule] = useState({
    name: 'General Shift',
    startTime: '09:00',
    endTime: '18:00',
  });
  const [selectedAttendanceStatus, setSelectedAttendanceStatus] = useState<string | null>(null);
  const [recentPayslips, setRecentPayslips] = useState<PayslipRecord[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0);

  const canCreateTask = Boolean(
    user?.role === ROLES.ADMIN ||
    user?.role === ROLES.TEAM_LEAD ||
    user?.role === ROLES.STAFF ||
    user?.role === ROLES.HR_MANAGER,
  );

  const completedTasksCount = myTasks.filter((t) => t.status === 'completed').length;
  const totalTasksCount = myTasks.length;
  const completionPercentage =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const totalProjectsCount = activeProjectsCount + completedProjectsCount;

  const loadTasks = useCallback(() => {
    return fetchMyTasks({ pageSize: 50 })
      .then((res) => {
        if (res && res.data) {
          const withOverrides = applyTaskOverrides(res.data);
          setMyTasks(withOverrides);
          const activeCount = withOverrides.filter((t) => t.status !== 'completed').length;
          setActiveTasksCount(activeCount);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMyPayslips({ pageSize: 3 })
      .then((res) => {
        if (active && res.data.length > 0) {
          setRecentPayslips(res.data.slice(0, 3));
        }
      })
      .catch(() => {});

    void loadTasks();

    void fetchProjects({ pageSize: 50 })
      .then((res) => {
        if (active && res.data) {
          const activeProj = res.data.filter(
            (p) =>
              (p.status as string) !== 'delivered' &&
              (p.status as string) !== 'completed' &&
              (p as unknown as { workflowStatus?: string }).workflowStatus !== 'completed',
          ).length;
          const doneProj = res.data.filter(
            (p) =>
              (p.status as string) === 'delivered' ||
              (p.status as string) === 'completed' ||
              (p as unknown as { workflowStatus?: string }).workflowStatus === 'completed',
          ).length;
          setActiveProjectsCount(activeProj);
          setCompletedProjectsCount(doneProj);
        }
      })
      .catch(() => {});

    const unsubStatus = onTaskStatusChanged(({ id, status }) => {
      setMyTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    });

    const unsubCreated = onTaskCreated((newTask) => {
      if (!user?.employeeId || newTask.assigneeEmployeeId === user.employeeId) {
        setMyTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) return prev;
          return [newTask, ...prev];
        });
        setActiveTasksCount((prev) => prev + 1);
      }
    });

    const handleWindowFocus = () => {
      void loadTasks();
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      active = false;
      unsubStatus();
      unsubCreated();
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadTasks, user?.employeeId]);

  useEffect(() => {
    let active = true;
    if (user?.employeeId) {
      Promise.all([
        fetchEmployeeShiftAssignments(user.employeeId).catch(() => []),
        fetchShifts().catch(() => []),
      ])
        .then(([assignments, allShifts]) => {
          if (!active) return;
          if (assignments.length > 0 && allShifts.length > 0) {
            const assigned = allShifts.find((s) => s.id === assignments[0]?.shiftId);
            if (assigned) {
              setShiftSchedule({
                name: assigned.name,
                startTime: assigned.startTime ? assigned.startTime.slice(0, 5) : '09:00',
                endTime: assigned.endTime ? assigned.endTime.slice(0, 5) : '18:00',
              });
            }
          } else if (allShifts.length > 0) {
            const defaultShift = allShifts.find((s) => s.isDefault) || allShifts[0];
            if (defaultShift) {
              setShiftSchedule({
                name: defaultShift.name,
                startTime: defaultShift.startTime ? defaultShift.startTime.slice(0, 5) : '09:00',
                endTime: defaultShift.endTime ? defaultShift.endTime.slice(0, 5) : '18:00',
              });
            }
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [user?.employeeId]);

  useEffect(() => {
    let active = true;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    fetchMyAttendanceHistory({ startDate: dateStr, endDate: dateStr })
      .then((res) => {
        if (!active) return;
        const record = res.data?.[0];
        if (record) {
          setSelectedAttendanceStatus(record.status || 'present');
        } else {
          setSelectedAttendanceStatus(null);
        }
      })
      .catch(() => {
        if (active) setSelectedAttendanceStatus(null);
      });

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const avatarUrl =
    user?.avatarUrl ||
    (user?.id ? localStorage.getItem(`maxr_avatar_${user.id}`) : null) ||
    (user?.email ? localStorage.getItem(`maxr_avatar_${user.email.toLowerCase()}`) : null) ||
    (user?.role ? localStorage.getItem(`maxr_avatar_${user.role}`) : null);

  const toggleTask = async (taskId: string) => {
    const currentTask = myTasks.find((t) => t.id === taskId);
    if (!currentTask) return;
    const nextStatus = currentTask.status === 'completed' ? 'in_progress' : 'completed';
    saveTaskStatusOverride(taskId, nextStatus);
    setMyTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus, version: t.version + 1 } : t)),
    );
    try {
      const updated = await changeTaskStatus(taskId, nextStatus);
      setMyTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      // Rollback if failure
      saveTaskStatusOverride(taskId, currentTask.status);
      setMyTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: currentTask.status, version: currentTask.version } : t,
        ),
      );
    }
  };

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : '') || 'User';
  const firstPart = displayName.split(' ')[0];
  const firstName = firstPart || 'User';
  const displayRole = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Staff Member';
  const leaveRoute = user?.role === ROLES.STAFF ? '/staff/leave' : '/leave';
  const attendanceRoute = user?.role === ROLES.STAFF ? '/staff/attendance' : '/attendance';

  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
      const p1 = parts[0];
      const p2 = parts[parts.length - 1];
      if (p1 && p2 && p1[0] && p2[0]) {
        return (p1[0] + p2[0]).toUpperCase();
      }
    }
    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const monthLabel = useMemo(() => {
    return calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const calendarDays = useMemo(() => {
    const isSelectedInViewMonth =
      selectedDate.getFullYear() === calendarMonth.getFullYear() &&
      selectedDate.getMonth() === calendarMonth.getMonth();

    const anchorDate = isSelectedInViewMonth
      ? selectedDate
      : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);

    const dayOfWeek = (anchorDate.getDay() + 6) % 7;
    const monday = new Date(
      anchorDate.getFullYear(),
      anchorDate.getMonth(),
      anchorDate.getDate() - dayOfWeek,
    );

    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const days: Array<{ day: string; date: number; fullDate: Date; isSelected: boolean }> = [];

    for (let i = 0; i < 6; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const isSelected =
        d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
      days.push({
        day: dayNames[i]!,
        date: d.getDate(),
        fullDate: d,
        isSelected,
      });
    }
    return days;
  }, [calendarMonth, selectedDate]);

  const handleSelectDay = (fullDate: Date) => {
    setSelectedDate(fullDate);
    if (fullDate.getMonth() !== calendarMonth.getMonth()) {
      setCalendarMonth(new Date(fullDate.getFullYear(), fullDate.getMonth(), 1));
    }
  };

  return (
    <div
      data-testid="profile-portal-page"
      className="w-full rounded-[24px] sm:rounded-[32px] lg:rounded-[36px] p-3 xs:p-4 sm:p-6 lg:p-8 transition-all pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-8"
      style={{
        backgroundColor: 'rgb(244, 247, 246)',
        border: '1px solid rgba(8, 11, 12, 0.08)',
        boxShadow: '0 10px 36px rgba(8, 11, 12, 0.04)',
      }}
    >
      {/* Header Display Title + Actions & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
        <div className="flex items-center">
          <h1
            className="text-2xl xs:text-3xl sm:text-4xl lg:text-[42px] font-display font-light tracking-tight"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            Welcome in, {firstName}
          </h1>
        </div>

        {/* Mobile Action Buttons (visible on < lg) */}
        <div className="grid grid-cols-2 gap-2.5 xs:gap-3 lg:hidden w-full">
          <button
            type="button"
            onClick={() => navigate('/profile/details')}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xs flex items-center justify-center transition-all active:scale-98"
            style={{
              backgroundColor: 'rgb(255, 255, 255)',
              color: 'rgb(8, 11, 12)',
              border: '1px solid rgba(8, 11, 12, 0.12)',
            }}
          >
            Profile Details
          </button>
          <button
            type="button"
            onClick={() => navigate(leaveRoute)}
            className="min-h-[44px] px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xs flex items-center justify-center transition-all active:scale-98"
            style={{
              backgroundColor: 'rgb(85, 205, 179)',
              color: 'rgb(8, 11, 12)',
            }}
          >
            Apply for Leave
          </button>
        </div>

        {/* Right Section: Floating Action Buttons + Stats Counters (Desktop only) */}
        <div className="hidden lg:flex flex-col items-end gap-3 self-auto">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/profile/details')}
              className="px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs hover:opacity-90 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200"
              style={{
                backgroundColor: 'rgb(255, 255, 255)',
                color: 'rgb(8, 11, 12)',
                border: '1px solid rgba(8, 11, 12, 0.12)',
              }}
            >
              Profile Details
            </button>
            <button
              type="button"
              onClick={() => navigate(leaveRoute)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold shadow-xs hover:opacity-95 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-200"
              style={{
                backgroundColor: 'rgb(85, 205, 179)',
                color: 'rgb(8, 11, 12)',
              }}
            >
              Apply for Leave
            </button>
          </div>

          <div className="flex items-center gap-6 sm:gap-8">
            <div className="flex items-center gap-2 group hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 cursor-default">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: 'rgba(85, 205, 179, 0.2)',
                  color: 'rgb(8, 11, 12)',
                }}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-2xl sm:text-3xl font-light font-display leading-none"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  {activeTasksCount}
                </p>
                <p className="text-[11px] leading-tight" style={{ color: 'rgba(8, 11, 12, 0.65)' }}>
                  Active Tasks
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 group hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 cursor-default">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: 'rgba(85, 205, 179, 0.2)',
                  color: 'rgb(8, 11, 12)',
                }}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-2xl sm:text-3xl font-light font-display leading-none"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  {totalProjectsCount}
                </p>
                <p className="text-[11px] leading-tight" style={{ color: 'rgba(8, 11, 12, 0.65)' }}>
                  Total Projects
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unified 12-Column Responsive Grid */}
      <div className="grid grid-cols-12 gap-2.5 xs:gap-3 sm:gap-4 items-stretch">
        {/* Card 1: Executive Profile Card */}
        <div
          className="col-span-6 lg:col-span-3 aspect-square lg:aspect-auto lg:h-64 sm:lg:h-72 relative rounded-2xl sm:rounded-[26px] overflow-hidden shadow-xs hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ease-out w-full group cursor-pointer"
          onClick={() => navigate('/profile/details')}
          title="Click to view and edit profile details"
          style={{
            background:
              'linear-gradient(135deg, rgb(10, 36, 32) 0%, rgb(13, 48, 44) 60%, rgb(8, 26, 24) 100%)',
            border: '1px solid rgba(85, 205, 179, 0.25)',
          }}
        >
          {user?.avatarUrl || avatarUrl ? (
            <img
              src={user?.avatarUrl || avatarUrl || ''}
              alt={displayName}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ objectPosition: 'center 20%' }}
              data-testid="portal-avatar-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}

          {/* Fallback initials if image fails or no avatar */}
          <div
            className={`absolute inset-0 flex items-center justify-center font-display font-semibold text-4xl xs:text-5xl text-[#55CDB3] pointer-events-none tracking-wider ${
              user?.avatarUrl || avatarUrl ? 'sr-only' : ''
            }`}
          >
            {initials}
          </div>

          {/* Bottom Gradient Overlay with Name & Role */}
          <div
            className="absolute bottom-0 inset-x-0 p-3 xs:p-4 sm:p-5 z-20 flex flex-col justify-end"
            style={{
              background:
                'linear-gradient(to top, rgba(10, 26, 24, 0.95) 0%, rgba(10, 26, 24, 0.6) 65%, transparent 100%)',
            }}
          >
            <h2 className="text-sm xs:text-base sm:text-lg font-bold font-display text-white leading-tight drop-shadow-md truncate">
              {displayName}
            </h2>
            <p className="text-[11px] xs:text-xs font-normal text-emerald-300 mt-0.5 drop-shadow-sm truncate">
              {displayRole}
            </p>
          </div>
        </div>

        {/* Card 1b: Stacked Stats on Mobile (< lg) */}
        <div className="col-span-6 lg:hidden flex flex-col justify-between gap-2.5 xs:gap-3 sm:gap-4 h-full">
          <div
            onClick={() => navigate('/tasks')}
            className="flex-1 rounded-2xl p-2.5 xs:p-3 sm:p-3.5 flex items-center justify-between cursor-pointer active:scale-98 transition-all shadow-xs"
            style={{
              backgroundColor: 'rgb(233, 248, 246)',
              border: '1px solid rgba(85, 205, 179, 0.35)',
            }}
          >
            <div
              className="w-8 h-8 xs:w-9 xs:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: 'rgb(13, 148, 136)',
                border: '1px solid rgba(85, 205, 179, 0.25)',
              }}
            >
              <svg
                className="w-4 h-4 xs:w-4.5 xs:h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div className="text-right">
              <p
                className="text-2xl xs:text-3xl font-display font-light leading-none"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                {activeTasksCount}
              </p>
              <p
                className="text-[10px] xs:text-[11px] font-medium mt-0.5"
                style={{ color: 'rgba(8, 11, 12, 0.7)' }}
              >
                Active Tasks
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate('/profile/details')}
            className="flex-1 rounded-2xl p-2.5 xs:p-3 sm:p-3.5 flex items-center justify-between cursor-pointer active:scale-98 transition-all shadow-xs"
            style={{
              backgroundColor: 'rgb(233, 248, 246)',
              border: '1px solid rgba(85, 205, 179, 0.35)',
            }}
          >
            <div
              className="w-8 h-8 xs:w-9 xs:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                color: 'rgb(13, 148, 136)',
                border: '1px solid rgba(85, 205, 179, 0.25)',
              }}
            >
              <svg
                className="w-4 h-4 xs:w-4.5 xs:h-4.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <div className="text-right">
              <p
                className="text-2xl xs:text-3xl font-display font-light leading-none"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                {recentPayslips.length || 1}
              </p>
              <p
                className="text-[10px] xs:text-[11px] font-medium mt-0.5"
                style={{ color: 'rgba(8, 11, 12, 0.7)' }}
              >
                Total Payslips
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Weekly Progress Card */}
        <div
          className="col-span-6 lg:col-span-3 min-h-[190px] xs:min-h-[200px] sm:min-h-[220px] lg:h-64 sm:lg:h-72 rounded-2xl sm:rounded-[26px] p-3 xs:p-3.5 sm:p-5 flex flex-col justify-between shadow-xs hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ease-out"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5 xs:mb-2">
              <span
                className="text-xs xs:text-sm font-semibold"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                Progress
              </span>
              <button
                type="button"
                onClick={() => navigate(attendanceRoute)}
                className="w-6 h-6 xs:w-7 xs:h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xs"
                style={{
                  backgroundColor: 'rgb(244, 247, 246)',
                  color: 'rgb(8, 11, 12)',
                  border: '1px solid rgba(8, 11, 12, 0.08)',
                }}
                aria-label="View progress details"
              >
                <svg
                  className="w-3 h-3 xs:w-3.5 xs:h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 17L17 7M17 7H7M17 7V17"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-0.5 min-w-0">
              <p
                className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-bold font-display leading-none whitespace-nowrap"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                {weekProgress.workedHours.toFixed(1)}&nbsp;h
              </p>
              <p
                className="text-[10px] xs:text-[11px] font-medium leading-tight text-[#080B0C]/60 truncate mt-1 whitespace-nowrap"
                title="Work Time this week"
              >
                Work Time this week
              </p>
            </div>
          </div>

          <div className="mt-1 xs:mt-2">
            <div className="flex justify-end pr-2 mb-1">
              <span
                className="text-[9px] xs:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs"
                style={{
                  backgroundColor: 'rgba(85, 205, 179, 0.25)',
                  color: 'rgb(8, 11, 12)',
                }}
              >
                {weekProgress.plannedHours === null
                  ? 'This week'
                  : `Planned so far: ${weekProgress.plannedHours}h`}
              </span>
            </div>

            <div className="flex items-end justify-between h-14 xs:h-18 sm:h-20 px-1 xs:px-2 gap-1 xs:gap-2">
              {week.map((item) => (
                <div
                  key={item.iso}
                  className="flex-1 flex flex-col items-center gap-1 xs:gap-1.5 h-full justify-end group cursor-pointer"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mb-0.5 transition-transform group-hover:scale-150"
                    style={{ backgroundColor: 'rgba(8, 11, 12, 0.15)' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150"
                    style={{
                      backgroundColor: weekProgress.workedDates.has(item.iso)
                        ? 'rgb(85, 205, 179)'
                        : 'rgb(8, 11, 12)',
                    }}
                  />
                  <span
                    className="text-[10px] xs:text-[11px] font-medium transition-colors group-hover:text-black"
                    style={{ color: item.isToday ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.6)' }}
                  >
                    {item.initial}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-2">
              <span
                className="text-[9px] xs:text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs text-center"
                style={{
                  backgroundColor: 'rgba(85, 205, 179, 0.25)',
                  color: 'rgb(8, 11, 12)',
                }}
              >
                Standard: 40h/week
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Shared Time Tracker Card */}
        <div className="col-span-6 lg:col-span-3 min-h-[190px] xs:min-h-[200px] sm:min-h-[220px] lg:h-64 sm:lg:h-72">
          <TimeTrackerCard
            variant="profile"
            attendanceRoute={attendanceRoute}
            onNavigate={navigate}
            className="h-full"
          />
        </div>

        {/* Card 4: Task Completion Process Card */}
        <div
          className="col-span-12 md:col-span-6 lg:col-span-3 min-h-[100px] sm:min-h-[120px] lg:h-64 sm:lg:h-72 rounded-2xl sm:rounded-[26px] p-3.5 xs:p-4 sm:p-5 flex flex-col justify-between shadow-xs hover:-translate-y-1 hover:shadow-xl transition-all duration-300 ease-out"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <span
                className="text-xs xs:text-sm font-semibold block"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                Task Completion Process
              </span>
              <div
                className="flex items-center gap-1.5 text-[11px] xs:text-xs font-medium mt-1"
                style={{ color: 'rgba(8, 11, 12, 0.65)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: 'rgb(85, 205, 179)' }}
                />
                <span>
                  {completedTasksCount} of {totalTasksCount} tasks completed
                </span>
              </div>
            </div>
            <span
              className="text-2xl xs:text-3xl font-light font-display"
              style={{ color: 'rgb(8, 11, 12)' }}
              data-testid="task-completion-percentage"
            >
              {completionPercentage}%
            </span>
          </div>

          <div className="my-2 xs:my-3">
            <div
              className="w-full bg-slate-100 rounded-full h-2.5 xs:h-3 overflow-hidden border"
              style={{ borderColor: 'rgba(8, 11, 12, 0.08)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${completionPercentage}%`,
                  backgroundColor: 'rgb(85, 205, 179)',
                }}
              />
            </div>
          </div>

          <div className="text-[10px] xs:text-[11px]" style={{ color: 'rgba(8, 11, 12, 0.5)' }}>
            <span>
              {activeTasksCount > 0
                ? `${activeTasksCount} active team tasks in current cycle`
                : 'Overall completion status'}
            </span>
          </div>
        </div>

        {/* Card 5: Recent Payslips */}
        <div
          className="col-span-12 md:col-span-6 lg:col-span-4 rounded-2xl sm:rounded-[26px] p-3.5 xs:p-4 sm:p-5 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-3 xs:mb-4">
              <div className="flex items-center gap-1.5">
                <h3
                  className="text-xs xs:text-sm sm:text-base font-bold font-display"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  Recent Payslips
                </h3>
                <span className="sr-only">Recent Payslips (Read-Only)</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/profile/details')}
                className="p-1 hover:opacity-75 transition-opacity"
                style={{ color: 'rgb(8, 11, 12)' }}
                aria-label="Open profile details"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="space-y-2 xs:space-y-2.5">
              {recentPayslips.length > 0 ? (
                recentPayslips.map((slip) => (
                  <div
                    key={slip.id}
                    className="rounded-2xl px-3 xs:px-3.5 py-2 xs:py-2.5 flex items-center justify-between shadow-xs transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: 'rgba(233, 248, 246, 0.65)',
                      border: '1px solid rgba(85, 205, 179, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2 xs:gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'rgba(85, 205, 179, 0.35)',
                          color: 'rgb(13, 148, 136)',
                        }}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        {slip.periodLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 xs:gap-3 shrink-0">
                      <span
                        className="text-xs font-semibold font-display tabular-nums"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        ₹ {slip.netPay.toLocaleString('en-IN')}
                      </span>
                      <button
                        type="button"
                        onClick={() => void downloadPayslipPdf(slip)}
                        className="p-1 hover:opacity-80 transition-opacity"
                        style={{ color: 'rgb(8, 11, 12)' }}
                        title={`Download ${slip.periodLabel} payslip`}
                        aria-label={`Download ${slip.periodLabel} payslip`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="rounded-2xl px-3.5 py-2.5 flex items-center justify-between shadow-xs"
                  style={{
                    backgroundColor: 'rgba(233, 248, 246, 0.65)',
                    border: '1px solid rgba(85, 205, 179, 0.3)',
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: 'rgba(85, 205, 179, 0.35)',
                        color: 'rgb(13, 148, 136)',
                      }}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <span
                      className="text-xs font-semibold truncate"
                      style={{ color: 'rgb(8, 11, 12)' }}
                    >
                      October 2026
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="text-xs font-semibold font-display tabular-nums"
                      style={{ color: 'rgb(8, 11, 12)' }}
                    >
                      ₹ 82,200
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetchMyPayslips({ pageSize: 1 });
                          if (res.data.length > 0) {
                            await downloadPayslipPdf(res.data[0]!);
                          } else {
                            navigate('/profile/details');
                          }
                        } catch {
                          navigate('/profile/details');
                        }
                      }}
                      className="p-1 hover:opacity-80 transition-opacity"
                      style={{ color: 'rgb(8, 11, 12)' }}
                      title="Download October 2026 payslip"
                      aria-label="Download October 2026 payslip"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 6: Calendar Timeline */}
        <div
          className="col-span-12 md:col-span-6 lg:col-span-5 rounded-2xl sm:rounded-[26px] p-3.5 xs:p-4 sm:p-5 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3 xs:mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-full hover:bg-black/5 transition-colors text-[#080B0C]/70"
              aria-label="Previous month"
              title="Previous month"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span
              className="text-xs sm:text-sm font-semibold font-display"
              style={{ color: 'rgb(8, 11, 12)' }}
            >
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-full hover:bg-black/5 transition-colors text-[#080B0C]/70"
              aria-label="Next month"
              title="Next month"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-6 gap-1 xs:gap-1.5 text-center mb-3">
            {calendarDays.map((d) => {
              return (
                <button
                  key={`${d.day}-${d.date}`}
                  type="button"
                  onClick={() => handleSelectDay(d.fullDate)}
                  className="py-1.5 rounded-xl text-xs flex flex-col items-center transition-all shadow-xs"
                  style={{
                    backgroundColor: d.isSelected ? 'rgba(85, 205, 179, 0.35)' : 'transparent',
                    color: d.isSelected ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.65)',
                    fontWeight: d.isSelected ? 700 : 500,
                  }}
                  data-testid={`calendar-day-${d.date}`}
                >
                  <span
                    className="text-[9px] xs:text-[10px] uppercase tracking-wide"
                    style={{ color: d.isSelected ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.45)' }}
                  >
                    {d.day}
                  </span>
                  <span className="text-xs font-semibold">{d.date}</span>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-2xl p-3 xs:p-4 text-center border border-dashed flex flex-col items-center justify-center gap-1 my-auto"
            style={{
              backgroundColor: 'rgba(244, 247, 246, 0.5)',
              borderColor: 'rgba(8, 11, 12, 0.1)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5 text-[#0F766E]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-xs font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                Work Schedule: {shiftSchedule.startTime} – {shiftSchedule.endTime}
              </p>
            </div>
            <p className="text-[10px] xs:text-[11px]" style={{ color: 'rgba(8, 11, 12, 0.55)' }}>
              {selectedAttendanceStatus
                ? `Attendance: ${selectedAttendanceStatus.charAt(0).toUpperCase() + selectedAttendanceStatus.slice(1)} for selected date.`
                : `${shiftSchedule.name} active for selected date.`}
            </p>
          </div>
        </div>

        {/* Card 7: My Tasks Checklist */}
        <div
          className="col-span-12 md:col-span-6 lg:col-span-3 rounded-2xl sm:rounded-[26px] p-3.5 xs:p-4 sm:p-5 shadow-xs hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3 xs:mb-4">
            <div className="flex items-center gap-2">
              <h3
                className="text-xs xs:text-sm font-semibold font-display"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                My Tasks
              </h3>
              {canCreateTask && (
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-xs"
                  style={{
                    backgroundColor: 'rgba(8, 11, 12, 0.08)',
                    color: 'rgb(8, 11, 12)',
                  }}
                  title="Add Task"
                  aria-label="Add Task"
                  data-testid="add-my-task-btn"
                >
                  +
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="flex items-center gap-1.5 cursor-pointer select-none group text-left hover:opacity-80 transition-opacity"
              aria-label="View all tasks"
            >
              <span
                className="text-sm xs:text-base font-semibold font-display leading-none"
                style={{ color: 'rgb(8, 11, 12)' }}
                data-testid="my-tasks-ratio"
              >
                {completedTasksCount}/{totalTasksCount}
              </span>
              <svg
                className="w-3.5 h-3.5 text-[#080B0C]/60 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="space-y-2.5">
            {myTasks.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <p className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.5)' }}>
                  No tasks assigned yet
                </p>
                {canCreateTask && (
                  <button
                    type="button"
                    onClick={() => setIsCreateTaskModalOpen(true)}
                    className="text-xs text-[#0F766E] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    + Add a task
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
                {myTasks.slice(0, 5).map((task) => {
                  const isCompleted = task.status === 'completed';
                  const taskDate = task.dueDate ? `Due: ${task.dueDate}` : 'No due date';
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => void toggleTask(task.id)}
                      className="w-full flex items-center justify-between gap-2 text-xs text-left select-none group transition-transform active:scale-95 duration-150"
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className="flex items-center gap-2 xs:gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center transition-colors shrink-0"
                          style={{
                            backgroundColor: 'rgb(233, 248, 246)',
                            color: 'rgb(13, 148, 136)',
                            border: '1px solid rgba(85, 205, 179, 0.25)',
                          }}
                        >
                          <TaskItemIcon task={task} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold truncate transition-colors ${
                              isCompleted
                                ? 'text-stone-400 line-through'
                                : 'text-[#080B0C] group-hover:text-emerald-700'
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[10px]" style={{ color: 'rgba(8, 11, 12, 0.5)' }}>
                            {taskDate}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCompleted ? (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shadow-xs"
                            style={{
                              backgroundColor: 'rgb(85, 205, 179)',
                              color: 'rgb(255, 255, 255)',
                            }}
                          >
                            ✓
                          </div>
                        ) : (
                          <div
                            className="w-5 h-5 rounded-full border-2 transition-colors group-hover:border-emerald-500"
                            style={{ borderColor: 'rgba(8, 11, 12, 0.25)' }}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div
            className="pt-2.5 mt-2.5 border-t text-[10px] flex items-center justify-between"
            style={{
              borderColor: 'rgba(8, 11, 12, 0.08)',
              color: 'rgba(8, 11, 12, 0.55)',
            }}
          >
            <span>
              Completed {completedTasksCount} of {totalTasksCount} tasks
            </span>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="font-semibold transition-colors hover:text-[#0F766E]"
              style={{ color: 'rgb(8, 11, 12)' }}
            >
              View all →
            </button>
          </div>
        </div>
      </div>

      {/* Quick Task Creation Modal */}
      <TaskFormModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        mode="create"
        onSubmitCreate={async (input) => {
          const created = await createTask(input);
          setMyTasks((prev) => [created, ...prev]);
          setActiveTasksCount((prev) => prev + 1);
        }}
      />
    </div>
  );
}
