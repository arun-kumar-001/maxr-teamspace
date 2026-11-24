import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_DISPLAY_NAMES, ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { TimeTrackerCard } from '../../attendance';
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

const WEEKLY_PROGRESS_BARS = [
  { day: 'S', height: 0, active: false },
  { day: 'M', height: 0, active: false },
  { day: 'T', height: 0, active: false },
  { day: 'W', height: 0, active: false },
  { day: 'T', height: 0, active: false },
  { day: 'F', height: 0, active: true },
  { day: 'S', height: 0, active: false },
];

/**
 * Shared My Profile portal view available across Admin, HR Manager, Team Lead, and Staff portals.
 */
export function ProfilePortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [recentPayslips, setRecentPayslips] = useState<PayslipRecord[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [activeTasksCount, setActiveTasksCount] = useState(0);
  const [activeProjectsCount, setActiveProjectsCount] = useState(0);
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0);

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

  const { prevMonth, currentMonth, nextMonth } = useMemo(() => {
    const now = new Date();
    const curr = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = prevDate.toLocaleDateString('en-US', { month: 'long' });
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const next = nextDate.toLocaleDateString('en-US', { month: 'long' });
    return { prevMonth: prev, currentMonth: curr, nextMonth: next };
  }, []);

  const calendarDays = useMemo(() => {
    const list: Array<{ day: string; date: number }> = [];
    const curr = new Date();
    const dayOfWeek = (curr.getDay() + 6) % 7;
    const monday = new Date(curr.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
      list.push({ day: dayNames[i]!, date: d.getDate() });
    }
    return list;
  }, []);

  return (
    <div
      data-testid="profile-portal-page"
      className="w-full rounded-[32px] sm:rounded-[36px] p-4 sm:p-6 lg:p-8 transition-all"
      style={{
        backgroundColor: 'rgb(244, 247, 246)',
        border: '1px solid rgba(8, 11, 12, 0.08)',
        boxShadow: '0 10px 36px rgba(8, 11, 12, 0.04)',
      }}
    >
      {/* Header Display Title + Actions & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div className="flex items-center">
          <h1
            className="text-3xl sm:text-4xl lg:text-[42px] font-display font-light tracking-tight"
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            Welcome in, {firstName}
          </h1>
        </div>

        {/* Right Section: Floating Action Buttons + Stats Counters */}
        <div className="flex flex-col sm:items-end gap-3 self-start lg:self-auto">
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

      {/* Row 1: Four Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-stretch">
        {/* Card 1: Executive Profile Card (Overall Big Size View) */}
        <div
          className="relative rounded-[26px] overflow-hidden shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ease-out h-64 sm:h-72 w-full group cursor-pointer"
          onClick={() => navigate('/profile/details')}
          title="Click to view and edit profile details"
          style={{
            background:
              'linear-gradient(135deg, rgb(14, 40, 38) 0%, rgb(18, 56, 53) 50%, rgb(10, 30, 28) 100%)',
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
            className={`absolute inset-0 flex items-center justify-center font-display font-bold text-5xl text-primary/30 pointer-events-none ${
              user?.avatarUrl || avatarUrl ? 'sr-only' : ''
            }`}
          >
            {initials}
          </div>

          {/* Bottom Gradient Overlay with Name & Role */}
          <div
            className="absolute bottom-0 inset-x-0 p-5 z-20 flex flex-col justify-end"
            style={{
              background:
                'linear-gradient(to top, rgba(10, 26, 24, 0.95) 0%, rgba(10, 26, 24, 0.6) 65%, transparent 100%)',
            }}
          >
            <h2 className="text-lg font-bold font-display text-white leading-tight drop-shadow-md">
              {displayName}
            </h2>
            <p className="text-xs font-medium text-emerald-300 mt-0.5 drop-shadow-sm">
              {displayRole}
            </p>
          </div>
        </div>

        {/* Card 2: Weekly Progress Card */}
        <div
          className="rounded-[26px] p-5 flex flex-col justify-between shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ease-out h-64 sm:h-72"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                Progress
              </span>
              <button
                type="button"
                onClick={() => navigate(attendanceRoute)}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xs"
                style={{
                  backgroundColor: 'rgb(244, 247, 246)',
                  color: 'rgb(8, 11, 12)',
                  border: '1px solid rgba(8, 11, 12, 0.08)',
                }}
                aria-label="View progress details"
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
                    d="M7 17L17 7M17 7H7M17 7V17"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <p
                className="text-2xl sm:text-3xl font-bold font-display"
                style={{ color: 'rgb(8, 11, 12)' }}
              >
                0.0 h
              </p>
              <p className="text-xs" style={{ color: 'rgba(8, 11, 12, 0.6)' }}>
                Work Time this week
              </p>
            </div>
          </div>

          <div className="mt-2">
            <div className="flex justify-end pr-6 mb-1">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs"
                style={{
                  backgroundColor: 'rgba(85, 205, 179, 0.25)',
                  color: 'rgb(8, 11, 12)',
                }}
              >
                Standard: 40h/wk
              </span>
            </div>

            <div className="flex items-end justify-between h-24 px-2 gap-2">
              {WEEKLY_PROGRESS_BARS.map((item, idx) => (
                <div
                  key={`${item.day}-${idx}`}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mb-1 transition-transform group-hover:scale-150"
                    style={{ backgroundColor: 'rgba(8, 11, 12, 0.15)' }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full transition-transform group-hover:scale-150"
                    style={{
                      backgroundColor: item.active ? 'rgb(85, 205, 179)' : 'rgb(8, 11, 12)',
                    }}
                  />
                  <span
                    className="text-[11px] font-medium transition-colors group-hover:text-black"
                    style={{ color: item.active ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.6)' }}
                  >
                    {item.day}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Shared Time Tracker Card */}
        <TimeTrackerCard
          attendanceRoute={attendanceRoute}
          onNavigate={navigate}
          className="h-64 sm:h-72"
        />

        {/* Card 4: Task Completion Process Card */}
        <div
          className="rounded-[26px] p-5 flex flex-col justify-between shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ease-out h-64 sm:h-72"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div className="flex items-start justify-between">
            <span className="text-sm font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
              Task Completion Process
            </span>
            <span
              className="text-3xl font-light font-display"
              style={{ color: 'rgb(8, 11, 12)' }}
              data-testid="task-completion-percentage"
            >
              {completionPercentage}%
            </span>
          </div>

          <div className="my-auto space-y-2">
            <div
              className="flex items-center gap-1.5 text-xs font-medium"
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

            <div
              className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden border"
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

          <div className="text-[11px]" style={{ color: 'rgba(8, 11, 12, 0.5)' }}>
            <span>
              {activeTasksCount > 0
                ? `${activeTasksCount} active team tasks in current cycle`
                : 'Overall completion status'}
            </span>
          </div>
        </div>
      </div>

      {/* Row 2: Three Columns (Payslips, Calendar Timeline, My Tasks Checklist) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Recent Payslips */}
        <div
          className="lg:col-span-4 rounded-[26px] p-5 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <h3
                  className="text-sm sm:text-base font-bold font-display"
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

            <div className="space-y-2.5">
              {recentPayslips.length > 0 ? (
                recentPayslips.map((slip) => (
                  <div
                    key={slip.id}
                    className="rounded-full px-3.5 py-2.5 flex items-center justify-between shadow-xs transition-all hover:scale-[1.01]"
                    style={{
                      backgroundColor: 'rgba(233, 248, 246, 0.65)',
                      border: '1px solid rgba(85, 205, 179, 0.3)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
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

                    <div className="flex items-center gap-3 shrink-0">
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
                  className="rounded-2xl p-6 text-center border border-dashed flex flex-col items-center justify-center gap-2"
                  style={{
                    backgroundColor: 'rgba(244, 247, 246, 0.5)',
                    borderColor: 'rgba(8, 11, 12, 0.1)',
                  }}
                >
                  <p className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.7)' }}>
                    No published payslips found
                  </p>
                  <p className="text-[11px]" style={{ color: 'rgba(8, 11, 12, 0.45)' }}>
                    Payslips will appear here once generated by HR/Admin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Calendar Timeline */}
        <div
          className="lg:col-span-5 rounded-[26px] p-5 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.45)' }}>
              {prevMonth}
            </span>
            <span className="text-xs sm:text-sm font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
              {currentMonth}
            </span>
            <span className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.45)' }}>
              {nextMonth}
            </span>
          </div>

          <div className="grid grid-cols-6 gap-1 text-center mb-4">
            {calendarDays.map((d) => {
              const isSelected = selectedDay === d.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDay(d.date)}
                  className="py-1.5 rounded-xl text-xs flex flex-col items-center transition-all shadow-xs"
                  style={{
                    backgroundColor: isSelected ? 'rgba(85, 205, 179, 0.25)' : 'transparent',
                    color: isSelected ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.65)',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  <span
                    className="text-[10px] uppercase"
                    style={{ color: isSelected ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.45)' }}
                  >
                    {d.day}
                  </span>
                  <span className="text-xs font-semibold">{d.date}</span>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-2xl p-6 text-center border border-dashed flex flex-col items-center justify-center gap-1.5 my-auto"
            style={{
              backgroundColor: 'rgba(244, 247, 246, 0.5)',
              borderColor: 'rgba(8, 11, 12, 0.1)',
            }}
          >
            <p className="text-xs font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
              Work Schedule: 09:00 - 18:00
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(8, 11, 12, 0.55)' }}>
              General Shift active for selected date.
            </p>
          </div>
        </div>

        {/* Right Column: Dark Tasks Checklist */}
        <div
          className="lg:col-span-3 rounded-[26px] p-5 shadow-md hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(8, 11, 12)',
            color: 'rgb(255, 255, 255)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 30px rgba(8, 11, 12, 0.25)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">My Tasks</span>
              <button
                type="button"
                onClick={() => setIsCreateTaskModalOpen(true)}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-colors"
                title="Add Task"
                aria-label="Add Task"
                data-testid="add-my-task-btn"
              >
                +
              </button>
            </div>
            <span
              className="text-xl font-light font-display text-white"
              data-testid="my-tasks-ratio"
            >
              {completedTasksCount}/{totalTasksCount}
            </span>
          </div>

          <div className="space-y-3">
            {myTasks.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-white/50">No tasks assigned yet</p>
                <button
                  type="button"
                  onClick={() => setIsCreateTaskModalOpen(true)}
                  className="text-xs text-[rgb(85,205,179)] hover:underline inline-flex items-center gap-1 font-medium"
                >
                  + Add a task
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
                {myTasks.map((task) => {
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
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'rgb(85, 205, 179)',
                          }}
                        >
                          <TaskItemIcon task={task} />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-medium truncate transition-colors ${
                              isCompleted
                                ? 'text-white/60 line-through'
                                : 'text-stone-300 group-hover:text-white'
                            }`}
                          >
                            {task.title}
                          </p>
                          <p className="text-[10px] text-white/50">{taskDate}</p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCompleted ? (
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs"
                            style={{
                              backgroundColor: 'rgb(85, 205, 179)',
                              color: 'rgb(8, 11, 12)',
                            }}
                          >
                            ✓
                          </div>
                        ) : (
                          <div
                            className="w-4 h-4 rounded-full border transition-colors group-hover:border-white/70"
                            style={{ borderColor: 'rgba(255, 255, 255, 0.35)' }}
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
            className="pt-3 mt-3 border-t text-[10px] flex items-center justify-between"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <span>
              Completed {completedTasksCount} of {totalTasksCount} tasks
            </span>
            <button
              type="button"
              onClick={() => navigate('/tasks')}
              className="hover:text-white transition-colors"
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
