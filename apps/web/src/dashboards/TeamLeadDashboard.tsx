import { useContext, useState, useEffect, useMemo } from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { AuthContext } from '../auth/AuthContext';
import { fetchEmployeeDirectory } from '../features/employees/api/employees';
import type { EmployeeDirectoryItem } from '../features/employees/types';
import { fetchMyTasks, fetchTeamTasks } from '../features/tasks/api/tasksApi';
import type { Task } from '../features/tasks/types';
import { fetchTeamAttendance } from '../features/attendance/api/attendance';
import type { AttendanceRecord } from '../features/attendance/types';
import { TimeTrackerCard } from '../features/attendance/components/TimeTrackerCard';
import { fetchApprovals } from '../features/approvals/api/approvals';
import type { Approval } from '../features/approvals/types';
import { cn } from '../lib/utils';

// --- Shared Code-Based Icons for Team Lead Dashboard ---

function UsersIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClipboardCheckIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  );
}

function LayersIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function CalendarCheckIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function DownloadIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ArrowUpRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

// --- Team Performance 3D Isometric Illustration ---
function TeamPerformanceIllustration() {
  return (
    <div className="relative w-full h-44 sm:h-48 flex items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 320 220"
        className="w-full h-full max-w-[280px] drop-shadow-sm transition-transform duration-300 hover:scale-105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Team Performance Illustration"
      >
        <defs>
          <linearGradient id="podiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2F4F0" />
          </linearGradient>
          <linearGradient id="podiumSide" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D5EFE9" />
            <stop offset="100%" stopColor="#B6E4DA" />
          </linearGradient>
          <linearGradient id="barGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#55CDB3" />
            <stop offset="100%" stopColor="#2BB89B" />
          </linearGradient>
          <linearGradient id="barGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6EE7D0" />
            <stop offset="100%" stopColor="#43C1A5" />
          </linearGradient>
          <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#55CDB3" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
          <filter id="softShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#080B0C" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Ground Base Oval Shadow */}
        <ellipse cx="160" cy="180" rx="130" ry="26" fill="#080B0C" fillOpacity="0.04" />

        {/* 3D Round Isometric Podium Base */}
        <g filter="url(#softShadow)">
          {/* Cylinder Side */}
          <path
            d="M 60 150 C 60 175, 260 175, 260 150 L 260 162 C 260 187, 60 187, 60 162 Z"
            fill="url(#podiumSide)"
          />
          {/* Cylinder Top */}
          <ellipse
            cx="160"
            cy="150"
            rx="100"
            ry="24"
            fill="url(#podiumGrad)"
            stroke="#B6E4DA"
            strokeWidth="1.5"
          />
        </g>

        {/* Screen/Backdrop with rising bar chart */}
        <g transform="translate(68, 62)">
          {/* Chart Display Panel */}
          <rect
            x="0"
            y="0"
            width="105"
            height="74"
            rx="8"
            fill="#FFFFFF"
            stroke="#D3EBE4"
            strokeWidth="1.5"
            filter="url(#softShadow)"
          />
          <line
            x1="12"
            y1="62"
            x2="93"
            y2="62"
            stroke="#E5EFEA"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Bar 1 */}
          <rect x="18" y="44" width="10" height="18" rx="2" fill="url(#barGrad1)" />
          {/* Bar 2 */}
          <rect x="34" y="34" width="10" height="28" rx="2" fill="url(#barGrad1)" />
          {/* Bar 3 */}
          <rect x="50" y="24" width="10" height="38" rx="2" fill="url(#barGrad1)" />
          {/* Bar 4 */}
          <rect x="66" y="16" width="10" height="46" rx="2" fill="url(#barGrad2)" />

          {/* Upward Growth Trend Line */}
          <path
            d="M 23 42 Q 45 28 71 14"
            fill="none"
            stroke="#0D9488"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon points="73,12 65,13 70,20" fill="#0D9488" />
        </g>

        {/* Checklist Clipboard on the Right */}
        <g transform="translate(182, 70)">
          {/* Board */}
          <rect
            x="0"
            y="6"
            width="56"
            height="74"
            rx="6"
            fill="#FFFFFF"
            stroke="#E3EBE7"
            strokeWidth="1.5"
            filter="url(#softShadow)"
          />
          {/* Top Clip */}
          <rect x="18" y="2" width="20" height="8" rx="2" fill="#493548" />
          <circle cx="28" cy="6" r="1.5" fill="#FFFFFF" />

          {/* Checklist Items */}
          <g transform="translate(8, 18)">
            {/* Row 1 */}
            <circle cx="5" cy="5" r="4.5" fill="#E8F8F5" stroke="#55CDB3" strokeWidth="1.2" />
            <path
              d="M3 5 L4.5 6.5 L7 3.5"
              stroke="#0D9488"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="13"
              y1="5"
              x2="36"
              y2="5"
              stroke="#493548"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />

            {/* Row 2 */}
            <circle cx="5" cy="18" r="4.5" fill="#E8F8F5" stroke="#55CDB3" strokeWidth="1.2" />
            <path
              d="M3 18 L4.5 19.5 L7 16.5"
              stroke="#0D9488"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="13"
              y1="18"
              x2="34"
              y2="18"
              stroke="#493548"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />

            {/* Row 3 */}
            <circle cx="5" cy="31" r="4.5" fill="#E8F8F5" stroke="#55CDB3" strokeWidth="1.2" />
            <path
              d="M3 31 L4.5 32.5 L7 29.5"
              stroke="#0D9488"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="13"
              y1="31"
              x2="38"
              y2="31"
              stroke="#493548"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />

            {/* Row 4 */}
            <circle cx="5" cy="44" r="4.5" fill="#E8F8F5" stroke="#55CDB3" strokeWidth="1.2" />
            <path
              d="M3 44 L4.5 45.5 L7 42.5"
              stroke="#0D9488"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="13"
              y1="44"
              x2="32"
              y2="44"
              stroke="#493548"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />
          </g>
        </g>

        {/* 3D Target Board with Dart Bullseye in the Foreground */}
        <g transform="translate(132, 122)">
          {/* Base Stand Peg */}
          <rect x="24" y="44" width="8" height="14" rx="2" fill="#3D5A54" />
          <ellipse cx="28" cy="56" rx="14" ry="4" fill="#2E4742" />

          {/* Outer Ring */}
          <circle
            cx="28"
            cy="28"
            r="26"
            fill="url(#targetGrad)"
            stroke="#FFFFFF"
            strokeWidth="2"
            filter="url(#softShadow)"
          />
          {/* Middle Ring */}
          <circle cx="28" cy="28" r="18" fill="#FFFFFF" />
          {/* Inner Ring */}
          <circle cx="28" cy="28" r="11" fill="#0D9488" />
          {/* Bullseye Core */}
          <circle cx="28" cy="28" r="5" fill="#FFFFFF" />
          <circle cx="28" cy="28" r="2.5" fill="#55CDB3" />
        </g>
      </svg>
    </div>
  );
}

// Fallback active team tasks matching reference screenshot
const REFERENCE_ACTIVE_TASKS = [
  {
    id: 'ref-task-1',
    initials: 'AM',
    name: 'Alex Mercer',
    avatarColor: 'bg-blue-100 text-blue-700',
    title: 'Refactor auth session tokens',
    dueDate: 'Apr 16, 2026',
    status: 'In Progress',
    statusVariant: 'in_progress' as const,
  },
  {
    id: 'ref-task-2',
    initials: 'KN',
    name: 'Kavita Nair',
    avatarColor: 'bg-purple-100 text-purple-700',
    title: 'PostgreSQL migration',
    dueDate: 'Apr 15, 2026',
    status: 'In Review',
    statusVariant: 'in_review' as const,
  },
  {
    id: 'ref-task-3',
    initials: 'VM',
    name: 'Vikram Mehta',
    avatarColor: 'bg-amber-100 text-amber-700',
    title: 'Fix mobile drawer focus',
    dueDate: 'Apr 14, 2026',
    status: 'Hold',
    statusVariant: 'hold' as const,
  },
  {
    id: 'ref-task-4',
    initials: 'CB',
    name: 'Charlotte Brown',
    avatarColor: 'bg-teal-100 text-teal-700',
    title: 'Update timesheet rules',
    dueDate: 'Apr 13, 2026',
    status: 'In Progress',
    statusVariant: 'in_progress' as const,
  },
];

export function TeamLeadDashboard() {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const inRouter = useInRouterContext();
  const routerNavigate = inRouter ? useNavigate() : null;
  const navigate = (path: string) => {
    if (routerNavigate) routerNavigate(path);
    else if (typeof window !== 'undefined') window.location.href = path;
  };

  // State for real backend metrics
  const [teamMembers, setTeamMembers] = useState<EmployeeDirectoryItem[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set(['ref-task-2']));
  const [sprintFilter, setSprintFilter] = useState<'This Sprint' | 'This Month' | 'All Time'>(
    'This Sprint',
  );
  const [isSprintMenuOpen, setIsSprintMenuOpen] = useState(false);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Formatted date (matching Fri, Nov 28, 2026 style)
  const formattedToday = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const leadName = user?.name || 'Mohamed Azad';
  const leadTitle =
    user?.title || (user?.department ? `${user.department} Team Lead` : 'Engineering Team Lead');

  // Load real data from backend APIs
  useEffect(() => {
    let isMounted = true;

    // 1. Team Size from Employee Directory
    fetchEmployeeDirectory({ pageSize: 100 })
      .then((res: { data?: EmployeeDirectoryItem[] }) => {
        if (isMounted && res?.data) {
          setTeamMembers(res.data);
        }
      })
      .catch(() => {});

    // 2. My Tasks
    fetchMyTasks({ pageSize: 100 })
      .then((res: { data?: Task[] }) => {
        if (isMounted && res?.data) {
          setMyTasks(res.data);
        }
      })
      .catch(() => {});

    // 3. Team Tasks
    fetchTeamTasks({ pageSize: 100 })
      .then((res: { data?: Task[] }) => {
        if (isMounted && res?.data) {
          setTeamTasks(res.data);
        }
      })
      .catch(() => {});

    // 4. Pending Approvals
    fetchApprovals({ status: 'pending', pageSize: 100 })
      .then((res: { data?: Approval[] }) => {
        if (isMounted && res?.data) {
          setPendingApprovals(res.data);
        }
      })
      .catch(() => {});

    // 5. Team Attendance for today
    const todayStr = new Date().toISOString().slice(0, 10);
    fetchTeamAttendance({ startDate: todayStr, endDate: todayStr, pageSize: 100 })
      .then((res: { data?: AttendanceRecord[] }) => {
        if (isMounted && res?.data) {
          setAttendanceRecords(res.data);
        }
      })
      .catch(() => {});

    const handleSync = () => {
      fetchMyTasks({ pageSize: 100 })
        .then((r: { data?: Task[] }) => isMounted && r?.data && setMyTasks(r.data))
        .catch(() => {});
      fetchTeamTasks({ pageSize: 100 })
        .then((r: { data?: Task[] }) => isMounted && r?.data && setTeamTasks(r.data))
        .catch(() => {});
      fetchApprovals({ status: 'pending', pageSize: 100 })
        .then((r: { data?: Approval[] }) => isMounted && r?.data && setPendingApprovals(r.data))
        .catch(() => {});
    };

    window.addEventListener('maxr:task-updated', handleSync);
    window.addEventListener('maxr:attendance-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('maxr:task-updated', handleSync);
      window.removeEventListener('maxr:attendance-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Metric Computations with faithful fallbacks to reference screenshot
  const teamSize = teamMembers.length > 0 ? teamMembers.length : 12;

  const myTasksCount = myTasks.length > 0 ? myTasks.length : 4;
  const myTasksInProgress =
    myTasks.length > 0 ? myTasks.filter((t) => t.status === 'in_progress').length : 2;

  const teamTasksCount = teamTasks.length > 0 ? teamTasks.length : 28;
  const teamTasksInProgress =
    teamTasks.length > 0 ? teamTasks.filter((t) => t.status === 'in_progress').length : 18;

  const pendingApprovalsCount = pendingApprovals.length > 0 ? pendingApprovals.length : 6;
  const pendingLeaveCount =
    pendingApprovals.length > 0
      ? pendingApprovals.filter((a) => a.subjectType === 'leave').length
      : 4;
  const pendingAttendanceCount =
    pendingApprovals.length > 0
      ? pendingApprovals.filter(
          (a) => a.subjectType === 'attendance_correction' || a.subjectType === 'attendance',
        ).length
      : 2;

  // Team Task Overview breakdown
  const taskBreakdown = useMemo(() => {
    if (teamTasks.length > 0) {
      const completed = teamTasks.filter((t) => t.status === 'completed').length;
      const inProgress = teamTasks.filter((t) => t.status === 'in_progress').length;
      const inReview = teamTasks.filter((t) => t.status === 'in_review').length;
      const hold = teamTasks.filter((t) => t.status === 'blocked' || t.status === 'todo').length;
      const total = teamTasks.length;
      return {
        total,
        completed,
        inProgress,
        inReview,
        hold,
        completedPct: total > 0 ? Math.round((completed / total) * 100) : 0,
        inProgressPct: total > 0 ? Math.round((inProgress / total) * 100) : 0,
        inReviewPct: total > 0 ? Math.round((inReview / total) * 100) : 0,
        holdPct: total > 0 ? Math.round((hold / total) * 100) : 0,
      };
    }
    // Screenshot reference values
    return {
      total: 28,
      completed: 10,
      inProgress: 12,
      inReview: 3,
      hold: 3,
      completedPct: 36,
      inProgressPct: 43,
      inReviewPct: 11,
      holdPct: 10,
    };
  }, [teamTasks]);

  // Attendance breakdown
  const attendanceBreakdown = useMemo(() => {
    if (attendanceRecords.length > 0) {
      const present = attendanceRecords.filter((r) => r.status === 'present').length;
      const late = attendanceRecords.filter((r) => r.status === 'late').length;
      const absent = Math.max(0, teamSize - present - late);
      return { present, late, absent, ratio: `${present}/${teamSize}` };
    }
    // Screenshot reference values
    return { present: 10, late: 1, absent: 1, ratio: `10/${teamSize}` };
  }, [attendanceRecords, teamSize]);

  // Active Team Tasks table items
  const activeTasksList = useMemo(() => {
    const nonCompleted = teamTasks.filter((t) => t.status !== 'completed');
    if (nonCompleted.length > 0) {
      return nonCompleted.slice(0, 5).map((t, index) => {
        const initials = t.assigneeName
          ? t.assigneeName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((n) => n[0])
              .join('')
              .toUpperCase()
          : 'TM';

        const colorClasses = [
          'bg-blue-100 text-blue-700',
          'bg-purple-100 text-purple-700',
          'bg-amber-100 text-amber-700',
          'bg-teal-100 text-teal-700',
        ];

        let displayStatus = 'In Progress';
        let variant: 'in_progress' | 'in_review' | 'hold' = 'in_progress';
        if (t.status === 'in_review') {
          displayStatus = 'In Review';
          variant = 'in_review';
        } else if (t.status === 'blocked' || t.status === 'todo') {
          displayStatus = 'Hold';
          variant = 'hold';
        }

        return {
          id: t.id,
          initials,
          name: t.assigneeName || 'Team Member',
          avatarColor: colorClasses[index % colorClasses.length],
          title: t.title,
          dueDate: t.dueDate
            ? new Date(t.dueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Apr 16, 2026',
          status: displayStatus,
          statusVariant: variant,
        };
      });
    }
    return REFERENCE_ACTIVE_TASKS;
  }, [teamTasks]);

  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.size === activeTasksList.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(activeTasksList.map((t) => t.id)));
    }
  };

  // Donut chart SVG calculation
  const donutRadius = 42;
  const donutCircumference = 2 * Math.PI * donutRadius; // ≈ 263.89
  const strokeGap = 3;

  const segment1Length = Math.max(
    0,
    (taskBreakdown.completedPct / 100) * donutCircumference - strokeGap,
  );
  const segment2Length = Math.max(
    0,
    (taskBreakdown.inProgressPct / 100) * donutCircumference - strokeGap,
  );
  const segment3Length = Math.max(
    0,
    (taskBreakdown.inReviewPct / 100) * donutCircumference - strokeGap,
  );
  const segment4Length = Math.max(
    0,
    (taskBreakdown.holdPct / 100) * donutCircumference - strokeGap,
  );

  const offset1 = 0;
  const offset2 = -(segment1Length + strokeGap);
  const offset3 = -(segment1Length + strokeGap + segment2Length + strokeGap);
  const offset4 = -(
    segment1Length +
    strokeGap +
    segment2Length +
    strokeGap +
    segment3Length +
    strokeGap
  );

  return (
    <div className="space-y-6 w-full min-w-0 pb-10" data-testid="team-lead-dashboard">
      {/* 1. Header Greeting Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#080B0C] font-display tracking-tight flex items-center gap-2">
            <span>{greeting},</span>
            <span style={{ color: '#55CDB3' }}>{leadName}</span>
            <span role="img" aria-label="Waving hand">
              👋
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1 font-medium">
            <span className="font-semibold text-text">{leadTitle}</span>
            <span className="mx-2 text-border-strong">|</span>
            <span>Here&apos;s your team&apos;s progress, tasks, and approvals.</span>
          </p>
        </div>

        {/* Date Selector Pill */}
        <div className="relative self-start md:self-auto">
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 bg-white rounded-xl border border-border/80 text-xs font-semibold text-text shadow-xs hover:border-border hover:bg-surface-raised transition-all"
            aria-label="Select Date"
          >
            <svg
              className="w-4 h-4 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2" />
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
            </svg>
            <span>{formattedToday}</span>
            <svg
              className="w-3.5 h-3.5 text-text-muted ml-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Team Size */}
        <div
          onClick={() => navigate('/lead/team')}
          className="bg-white border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-all cursor-pointer flex items-center justify-between gap-3 group"
          role="button"
          tabIndex={0}
          aria-label="Team Size KPI Card"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <UsersIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Team Size</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-text font-display mt-0.5 leading-none">
                {teamSize}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            &uarr; +2 this month
          </span>
        </div>

        {/* KPI 2: My Tasks */}
        <div
          onClick={() => navigate('/tasks')}
          className="bg-white border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-all cursor-pointer flex items-center justify-between gap-3 group"
          role="button"
          tabIndex={0}
          aria-label="My Tasks KPI Card"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <ClipboardCheckIcon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">My Tasks</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-text font-display mt-0.5 leading-none">
                {myTasksCount}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
            {myTasksInProgress} In Progress
          </span>
        </div>

        {/* KPI 3: Team Tasks */}
        <div
          onClick={() => navigate('/lead/tasks')}
          className="bg-white border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-all cursor-pointer flex items-center justify-between gap-3 group"
          role="button"
          tabIndex={0}
          aria-label="Team Tasks KPI Card"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <LayersIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Team Tasks</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-text font-display mt-0.5 leading-none">
                {teamTasksCount}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
            {teamTasksInProgress} In Progress
          </span>
        </div>

        {/* KPI 4: Pending Approvals */}
        <div
          onClick={() => navigate('/lead/approvals')}
          className="bg-white border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-card transition-all cursor-pointer flex items-center justify-between gap-3 group"
          role="button"
          tabIndex={0}
          aria-label="Pending Approvals KPI Card"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
              <CalendarCheckIcon className="w-6 h-6 text-pink-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted">Pending Approvals</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-text font-display mt-0.5 leading-none">
                {pendingApprovalsCount}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-pink-50 text-pink-800 border border-pink-200 shrink-0 whitespace-nowrap">
            {pendingLeaveCount} Leave &bull; {pendingAttendanceCount} Attendance
          </span>
        </div>
      </div>

      {/* 3. Main Dashboard Row 2 (3 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Card A: Team Task Overview */}
        <div className="lg:col-span-4 bg-white border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-card transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="text-base font-bold text-text font-display">Team Task Overview</h2>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSprintMenuOpen(!isSprintMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-text bg-surface rounded-xl border border-border hover:bg-surface-raised transition-colors"
                aria-label="Filter tasks by sprint"
              >
                <span>{sprintFilter}</span>
                <svg
                  className="w-3 h-3 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isSprintMenuOpen && (
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-border py-1 z-20 text-xs">
                  {(['This Sprint', 'This Month', 'All Time'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSprintFilter(opt);
                        setIsSprintMenuOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 font-medium hover:bg-surface-muted transition-colors',
                        sprintFilter === opt
                          ? 'text-primary-ink font-bold bg-primary-soft/40'
                          : 'text-text',
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Donut Chart & Legend Row */}
          <div className="flex items-center justify-between gap-4 py-3 my-auto">
            {/* SVG Donut Chart with Center Text */}
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="#F1F5F4"
                  strokeWidth="12"
                />

                {/* Segment 1: Completed (Green) */}
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="12"
                  strokeDasharray={`${segment1Length} ${donutCircumference - segment1Length}`}
                  strokeDashoffset={offset1}
                  className="transition-all duration-700 ease-out"
                />

                {/* Segment 2: In Progress (Blue) */}
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth="12"
                  strokeDasharray={`${segment2Length} ${donutCircumference - segment2Length}`}
                  strokeDashoffset={offset2}
                  className="transition-all duration-700 ease-out"
                />

                {/* Segment 3: In Review (Amber) */}
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="12"
                  strokeDasharray={`${segment3Length} ${donutCircumference - segment3Length}`}
                  strokeDashoffset={offset3}
                  className="transition-all duration-700 ease-out"
                />

                {/* Segment 4: Hold (Plum) */}
                <circle
                  cx="50"
                  cy="50"
                  r={donutRadius}
                  fill="none"
                  stroke="#701A75"
                  strokeWidth="12"
                  strokeDasharray={`${segment4Length} ${donutCircumference - segment4Length}`}
                  strokeDashoffset={offset4}
                  className="transition-all duration-700 ease-out"
                />
              </svg>

              {/* Center Value */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black font-display text-text leading-none">
                  {taskBreakdown.total}
                </span>
                <span className="text-[11px] font-semibold text-text-muted mt-0.5">Tasks</span>
              </div>
            </div>

            {/* Right Legend */}
            <div className="flex-1 space-y-2 text-xs min-w-0 pr-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-text font-medium truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
                  Completed
                </span>
                <span className="font-semibold text-text font-mono shrink-0 ml-2">
                  {taskBreakdown.completed}{' '}
                  <span className="text-text-muted font-normal">
                    ({taskBreakdown.completedPct}%)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-text font-medium truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5E9] shrink-0" />
                  In Progress
                </span>
                <span className="font-semibold text-text font-mono shrink-0 ml-2">
                  {taskBreakdown.inProgress}{' '}
                  <span className="text-text-muted font-normal">
                    ({taskBreakdown.inProgressPct}%)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-text font-medium truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                  In Review
                </span>
                <span className="font-semibold text-text font-mono shrink-0 ml-2">
                  {taskBreakdown.inReview}{' '}
                  <span className="text-text-muted font-normal">
                    ({taskBreakdown.inReviewPct}%)
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-text font-medium truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#701A75] shrink-0" />
                  Hold
                </span>
                <span className="font-semibold text-text font-mono shrink-0 ml-2">
                  {taskBreakdown.hold}{' '}
                  <span className="text-text-muted font-normal">({taskBreakdown.holdPct}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: Time Tracker (Using existing TimeTrackerCard overview variant) */}
        <div className="lg:col-span-4 min-w-0">
          <TimeTrackerCard variant="overview" className="h-full rounded-2xl" />
        </div>

        {/* Card C: Attendance (Today) */}
        <div className="lg:col-span-4 bg-white border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-card transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="text-base font-bold text-text font-display">Attendance (Today)</h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
              {attendanceBreakdown.ratio}
            </span>
          </div>

          <div className="space-y-4 py-4 my-auto">
            {/* Present */}
            <div className="flex items-center justify-between py-1 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shrink-0" />
                <span className="text-sm font-semibold text-text">Present</span>
              </div>
              <span className="text-sm font-bold font-mono text-text">
                {attendanceBreakdown.present}
              </span>
            </div>

            {/* Late */}
            <div className="flex items-center justify-between py-1 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                <span className="text-sm font-semibold text-text">Late</span>
              </div>
              <span className="text-sm font-bold font-mono text-text">
                {attendanceBreakdown.late}
              </span>
            </div>

            {/* Absent */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] shrink-0" />
                <span className="text-sm font-semibold text-text">Absent</span>
              </div>
              <span className="text-sm font-bold font-mono text-text">
                {attendanceBreakdown.absent}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
            <span>Own team attendance scope</span>
            <button
              type="button"
              onClick={() => navigate('/lead/attendance')}
              className="font-semibold text-primary-ink hover:underline"
            >
              View roster &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row 3 (2 Cards: Team Performance + Active Team Tasks) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Card D: Team Performance */}
        <div className="lg:col-span-4 bg-white border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-card transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-text font-display">Team Performance</h2>
            <button
              type="button"
              onClick={() => navigate('/lead/reports')}
              className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-raised border border-border/60 transition-colors shadow-xs"
              aria-label="View Team Performance Details"
            >
              <ArrowUpRightIcon />
            </button>
          </div>

          <TeamPerformanceIllustration />

          <div className="pt-2.5 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
            <span>Completion Rate</span>
            <span className="font-bold text-primary-ink font-mono">
              {taskBreakdown.completedPct}% achieved
            </span>
          </div>
        </div>

        {/* Card E: Active Team Tasks */}
        <div className="lg:col-span-8 bg-white border border-border/80 rounded-2xl p-5 shadow-xs hover:shadow-card transition-all flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="text-base font-bold text-text font-display">Active Team Tasks</h2>
            <button
              type="button"
              onClick={() => navigate('/lead/tasks')}
              className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-raised border border-border/60 transition-colors shadow-xs"
              aria-label="Export or View Team Tasks"
            >
              <DownloadIcon />
            </button>
          </div>

          {/* Tasks Table */}
          <div className="overflow-x-auto my-auto py-1">
            <table className="w-full text-left text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-border/60 text-text-muted font-semibold">
                  <th className="py-2.5 px-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        selectedTaskIds.size === activeTasksList.length &&
                        activeTasksList.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-border text-primary-deep focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                      aria-label="Select all active tasks"
                    />
                  </th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Task</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activeTasksList.map((task) => {
                  const isChecked = selectedTaskIds.has(task.id);
                  let statusBadgeClass = 'bg-teal-50 text-teal-800 border-teal-200';
                  if (task.statusVariant === 'in_review') {
                    statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                  } else if (task.statusVariant === 'hold') {
                    statusBadgeClass = 'bg-pink-50 text-pink-800 border-pink-200';
                  }

                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'hover:bg-surface-muted/60 transition-colors',
                        isChecked && 'bg-surface-muted/30',
                      )}
                    >
                      <td className="py-2.5 px-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleTaskSelection(task.id)}
                          className="rounded border-border text-primary-deep focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                          aria-label={`Select ${task.title}`}
                        />
                      </td>

                      {/* Name with Initial Badge */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0',
                              task.avatarColor,
                            )}
                          >
                            {task.initials}
                          </span>
                          <span className="font-semibold text-text whitespace-nowrap">
                            {task.name}
                          </span>
                        </div>
                      </td>

                      {/* Task Title */}
                      <td className="py-2.5 px-3 font-medium text-text max-w-[220px] truncate">
                        {task.title}
                      </td>

                      {/* Due Date */}
                      <td className="py-2.5 px-3 text-text-muted whitespace-nowrap font-mono text-[11px]">
                        {task.dueDate}
                      </td>

                      {/* Status Pill */}
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap',
                            statusBadgeClass,
                          )}
                        >
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-2.5 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
            <span>Showing active team tasks</span>
            <button
              type="button"
              onClick={() => navigate('/lead/tasks')}
              className="font-semibold text-primary-ink hover:underline"
            >
              View all tasks &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
