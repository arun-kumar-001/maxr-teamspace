import { useContext, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_DISPLAY_NAMES, ROLES } from '@maxr/shared';
import { AuthContext, useAuth } from '../../../auth/AuthContext';
import { DonutChart, type DonutChartSegment } from '../../../components/ui';
import { TimeTrackerCard } from '../../attendance';
import { downloadPayslipPdf, fetchMyPayslips } from '../../payslips/api/payslips';
import type { PayslipRecord } from '../../payslips/types';
import { isPayslipEnabledForStaff } from '../../../shell/navigation';
import {
  getSidebarTodos,
  getSidebarTodoStats,
  isTodoCompletedToday,
  toggleSidebarTodo,
  type TodoItemData,
  TODOS_UPDATED_EVENT,
} from '../../tasks/utils/todoStats';

function getTaskIcon(frequency: 'daily' | 'once', index: number) {
  if (frequency === 'daily') {
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
  if (index % 2 === 0) {
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

const WEEKLY_PROGRESS_BARS = [
  { day: 'S', height: 0, active: false },
  { day: 'M', height: 60, active: false },
  { day: 'T', height: 42, active: false },
  { day: 'W', height: 72, active: false },
  { day: 'T', height: 85, active: false },
  { day: 'F', height: 100, active: true },
  { day: 'S', height: 0, active: false },
];

export function ProfilePortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recentPayslips, setRecentPayslips] = useState<PayslipRecord[]>([]);
  const [todosList, setTodosList] = useState<TodoItemData[]>(() => getSidebarTodos());
  const [todoStats, setTodoStats] = useState(() => getSidebarTodoStats());
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMyPayslips({ pageSize: 3 })
      .then((res) => {
        if (active && res.data.length > 0) {
          setRecentPayslips(res.data.slice(0, 3));
        }
      })
      .catch(() => {
        // Offline/test fallback preserves static preview cards
      });
    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.name ?? 'Lora Piterson';
  const firstName = displayName.split(' ')[0] || 'Nixtio';
  const displayRole = user?.role ? ROLE_DISPLAY_NAMES[user.role] : 'Staff Member';
  const leaveRoute = user?.role === ROLES.STAFF ? '/staff/leave' : '/leave';
  const attendanceRoute = user?.role === ROLES.STAFF ? '/staff/attendance' : '/attendance';

  const auth = useContext(AuthContext);
  const updateUserAvatar = auth?.updateUserAvatar;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const payslipEnabled = user?.role === ROLES.STAFF ? isPayslipEnabledForStaff() : true;

  const handleChoosePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateUserAvatar?.(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  useEffect(() => {
    const handleUpdate = () => {
      setTodoStats(getSidebarTodoStats());
      setTodosList(getSidebarTodos());
    };
    window.addEventListener(TODOS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, handleUpdate);
  }, []);

  const toggleTask = (id: string) => {
    toggleSidebarTodo(id);
    setTodosList(getSidebarTodos());
    setTodoStats(getSidebarTodoStats());
  };

  const totalCompleted = todoStats.completed;
  const totalPending = todoStats.pending;
  const totalOverdue = 0;
  const combinedTotal = todoStats.total;
  const combinedPct = combinedTotal > 0 ? Math.round((totalCompleted / combinedTotal) * 100) : 0;
  const activeTasksCount = totalPending;

  const taskChartData: DonutChartSegment[] = [
    {
      label: 'Completed',
      value: totalCompleted,
      color: 'var(--primary-strong)',
      inkColor: 'var(--primary-ink)',
      pct: combinedPct,
      pillClass: 'bg-primary-soft text-primary-deep',
    },
    {
      label: 'In Progress',
      value: totalPending,
      color: 'var(--chart-5)',
      inkColor: 'var(--chart-ink-5)',
      pct: combinedTotal > 0 ? Math.round((totalPending / combinedTotal) * 100) : 0,
      pillClass: 'bg-amber-50 text-amber-800',
    },
    {
      label: 'Overdue',
      value: totalOverdue,
      color: 'var(--chart-7)',
      inkColor: 'var(--chart-ink-7)',
      pct: 0,
      pillClass: 'bg-rose-50 text-rose-800',
    },
  ];
  const activeTask = taskChartData.find((s) => s.label === hoveredTask);

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
                  1
                </p>
                <p className="text-[11px] leading-tight" style={{ color: 'rgba(8, 11, 12, 0.65)' }}>
                  Total Projects
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header Metrics Badges Row */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-5 mb-6 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.7)' }}>
            Attendance
          </span>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-xs"
            style={{
              backgroundColor: 'rgb(8, 11, 12)',
              color: 'rgb(255, 255, 255)',
            }}
          >
            15%
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium" style={{ color: 'rgba(8, 11, 12, 0.7)' }}>
            Leave
          </span>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full shadow-xs"
            style={{
              backgroundColor: 'rgb(85, 205, 179)',
              color: 'rgb(8, 11, 12)',
            }}
          >
            15%
          </span>
        </div>
      </div>

      {/* Row 1: Four Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-stretch">
        {/* Card 1: Portrait Profile Card */}
        <div
          onClick={handleChoosePhoto}
          className="relative rounded-[26px] overflow-hidden shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ease-out h-64 sm:h-72 w-full group cursor-pointer"
          style={{
            backgroundColor: 'rgb(244, 247, 246)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
          title="Click to upload or update profile photo"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload profile photo"
          />

          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${displayName} - ${displayRole}`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ objectPosition: 'center 20%' }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary-soft via-surface to-primary-soft/40 text-center">
              <div className="w-20 h-20 rounded-full bg-primary-soft border-2 border-primary-strong/30 flex items-center justify-center font-display font-bold text-2xl text-primary-ink shadow-sm mb-3">
                {user?.avatarInitials || displayName.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface border border-border shadow-xs text-text flex items-center gap-1.5 group-hover:bg-primary-soft group-hover:text-primary-deep transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Upload Photo
              </span>
            </div>
          )}

          <div
            className="absolute bottom-0 inset-x-0 p-4 flex items-end justify-between z-10"
            style={{
              background:
                'linear-gradient(to top, rgba(8, 11, 12, 0.92) 0%, rgba(8, 11, 12, 0.45) 60%, transparent 100%)',
            }}
          >
            <div>
              <h2 className="text-base font-bold font-display text-white leading-tight drop-shadow-sm">
                {displayName}
              </h2>
              <p className="text-xs text-white/80 drop-shadow-sm">{displayRole}</p>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-white/20 backdrop-blur-xs text-white" title="Change photo">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
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
            <div className="flex items-end justify-between h-24 px-2 gap-2">
              {WEEKLY_PROGRESS_BARS.map((item, idx) => (
                <div
                  key={`${item.day}-${idx}`}
                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group cursor-pointer"
                >
                  {item.height > 0 ? (
                    <div
                      className="w-2 sm:w-2.5 rounded-full transition-all group-hover:scale-y-110 origin-bottom duration-200"
                      style={{
                        height: `${item.height}%`,
                        backgroundColor: item.active ? 'rgb(85, 205, 179)' : 'rgb(8, 11, 12)',
                      }}
                    />
                  ) : (
                    <div
                      className="w-1.5 h-1.5 rounded-full mb-1 transition-transform group-hover:scale-150"
                      style={{ backgroundColor: 'rgba(8, 11, 12, 0.15)' }}
                    />
                  )}
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

        {/* Card 4: Task Completion Progress (Matching Admin Dashboard Task Overview Card) */}
        <div
          onClick={() => navigate(user?.role === ROLES.STAFF ? '/staff/tasks' : '/tasks')}
          className="rounded-[26px] p-5 bg-white border border-border/80 shadow-xs hover:shadow-card hover:-translate-y-0.5 flex flex-col justify-between h-64 sm:h-72 min-w-0 transition-all duration-200 cursor-pointer group active:scale-[0.99]"
          data-testid="task-overview-card"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-text truncate">Task Completion Progress</h2>
            </div>
            <svg
              className="w-4 h-4 text-text-muted transition-transform duration-200 group-hover:translate-x-1 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Interactive Segmented Donut Chart & Matched Legend */}
          <div className="flex items-center justify-between gap-3 my-auto py-1 min-w-0">
            <DonutChart
              data={taskChartData}
              size={112}
              strokeWidth={8}
              segmentGap={4}
              showInnerRing={true}
              animationDuration={0.8}
              highlightOnHover={true}
              hoveredLabel={hoveredTask}
              onSegmentHover={(seg) => setHoveredTask(seg?.label ?? null)}
              centerContent={
                <div className="flex flex-col items-center justify-center text-center leading-none">
                  <span className="font-display text-lg sm:text-xl font-extrabold text-text tracking-tight">
                    {activeTask ? `${activeTask.pct}%` : `${taskChartData[0]?.pct ?? 0}%`}
                  </span>
                  <span
                    className="text-[10px] mt-1 font-bold truncate max-w-[68px]"
                    style={{ color: activeTask ? activeTask.inkColor : 'var(--primary-ink)' }}
                  >
                    {activeTask ? activeTask.label : 'Completed'}
                  </span>
                </div>
              }
              aria-label="Task completion breakdown"
              className="shrink-0"
            />

            {/* Matched Legend Stats */}
            <div className="flex-1 min-w-0 space-y-1 text-xs">
              {taskChartData.map((segment) => {
                const isHovered = hoveredTask === segment.label;
                return (
                  <div
                    key={segment.label}
                    onMouseEnter={() => setHoveredTask(segment.label)}
                    onMouseLeave={() => setHoveredTask(null)}
                    className={`flex items-center justify-between gap-1 px-2 py-0.5 rounded-lg transition-all min-w-0 ${
                      isHovered ? segment.pillClass : 'hover:bg-surface-muted'
                    }`}
                  >
                    <span
                      className="flex items-center gap-1.5 font-semibold truncate text-[11px] transition-colors"
                      style={{ color: segment.inkColor }}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: segment.color }}
                      />
                      {segment.label}
                    </span>
                    <span
                      className="font-bold font-mono text-[11px] whitespace-nowrap shrink-0"
                      style={{ color: isHovered ? segment.inkColor : 'var(--text)' }}
                    >
                      {segment.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Progress Bar */}
          <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${taskChartData[0]?.pct ?? 0}%` }}
              />
            </div>
            <span className="font-semibold text-text font-mono shrink-0 whitespace-nowrap text-[11px]">
              {totalCompleted} / {combinedTotal} Tasks
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
              {!payslipEnabled ? (
                <div className="py-6 text-center text-xs text-text-muted">
                  Payslips navigation is currently disabled by Administrator.
                </div>
              ) : recentPayslips.length > 0 ? (
                recentPayslips.map((slip) => (
                  <div
                    key={slip.periodLabel}
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
                <div className="py-6 text-center text-xs text-text-muted">
                  No published payslips yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Column: Daily Routine Checklist Summary (No fake calendar or meetings) */}
        <div
          className="lg:col-span-5 rounded-[26px] p-5 shadow-xs hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ease-out flex flex-col justify-between"
          style={{
            backgroundColor: 'rgb(255, 255, 255)',
            border: '1px solid rgba(8, 11, 12, 0.08)',
          }}
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-deep animate-pulse" />
                <h3
                  className="text-sm sm:text-base font-bold font-display"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  Daily Work Plan & Routine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate(user?.role === ROLES.STAFF ? '/staff/tasks' : '/tasks')}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-soft text-primary-deep hover:bg-primary-soft/80 transition-colors"
              >
                Open Matrix →
              </button>
            </div>

            <p className="text-xs text-text-muted mb-4">
              Track your daily routine consistency and personal tasks. Complete routine items on your daily matrix.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-surface-muted border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-text">Morning Attendance Check-in</p>
                    <p className="text-[10px] text-text-muted">Register daily attendance in Time Tracker</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text border border-border">
                  Daily
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-muted border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-text">Daily Standup & Work Plan</p>
                    <p className="text-[10px] text-text-muted">Review today's to-dos and project milestones</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text border border-border">
                  Routine
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-surface-muted border border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-text">Evening Attendance Check-out</p>
                    <p className="text-[10px] text-text-muted">Finalize daily log and clock out</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-text border border-border">
                  Routine
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-muted">
            <span>Work hours: 09:00 AM – 06:00 PM</span>
            <span className="font-semibold text-text">Active Shift</span>
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
            <span className="text-sm font-semibold text-white">My Tasks</span>
            <span className="text-xl font-light font-display text-white">
              {todoStats.completed}/{todoStats.total}
            </span>
          </div>

          <div className="space-y-3">
            {todosList.length === 0 ? (
              <div className="py-8 text-center text-white/50 text-xs">
                <p>No tasks yet.</p>
                <p className="text-[11px] mt-1 text-white/40">
                  Add tasks in My Tasks to track your progress here.
                </p>
              </div>
            ) : (
              todosList.map((task, index) => {
                const isCompleted = isTodoCompletedToday(task);
                const subtitle =
                  task.frequency === 'daily'
                    ? 'Daily routine'
                    : 'One-time task';

                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className="w-full flex items-center justify-between gap-2 text-xs text-left select-none group transition-transform active:scale-95 duration-150"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'rgb(85, 205, 179)',
                        }}
                      >
                        {getTaskIcon(task.frequency, index)}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-medium truncate transition-colors ${
                            isCompleted ? 'text-white' : 'text-stone-300 group-hover:text-white'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[10px] text-white/50">{subtitle}</p>
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
              })
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
              Completed {todoStats.completed} of {todoStats.total} tasks
            </span>
            <button
              type="button"
              onClick={() => navigate(user?.role === ROLES.STAFF ? '/staff/tasks' : '/tasks')}
              className="text-primary hover:underline font-semibold"
            >
              Open Tasks →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
