import { useContext, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { AuthContext } from '../auth/AuthContext';
import { TimeTrackerCard } from '../features/attendance/components/TimeTrackerCard';
import { EmployeeAvatar } from '../features/employees/components/EmployeeAvatar';
import { getAvatarTone } from '../features/employees/components/hiringUtils';
import { TASK_STATUSES, type Task, type TaskStatus } from '../features/tasks/types';
import {
  TASK_STATUS_LABELS,
  formatDueDate,
  pickActiveTasks,
  summarizeApprovals,
  summarizeAttendance,
  summarizeTasks,
  type TaskBreakdown,
} from './team-lead-metrics';
import { useTeamLeadDashboardData, type Counted, type Resource } from './useTeamLeadDashboardData';

// --- Icons (decorative: the text next to each one says what it is) ---

function Icon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const UsersIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Icon className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

const ClipboardCheckIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Icon className={className}>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </Icon>
);

const LayersIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Icon className={className}>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </Icon>
);

const CalendarCheckIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Icon className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="m9 16 2 2 4-4" />
  </Icon>
);

const CalendarIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Icon className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Icon>
);

const ArrowUpRightIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <Icon className={className}>
    <line x1="7" y1="17" x2="17" y2="7" />
    <polyline points="7 7 17 7 17 17" />
  </Icon>
);

// --- Team performance illustration (flat, drawn only with design tokens) ---

function TeamPerformanceIllustration() {
  return (
    <div className="relative flex h-44 w-full items-center justify-center overflow-hidden sm:h-48">
      <svg
        viewBox="0 0 320 220"
        role="img"
        aria-label="Team Performance Illustration"
        className="h-full w-full max-w-[280px] drop-shadow-sm"
        fill="none"
      >
        <ellipse cx="160" cy="180" rx="130" ry="26" className="fill-text opacity-5" />

        {/* Round podium */}
        <path
          d="M 60 150 C 60 175, 260 175, 260 150 L 260 162 C 260 187, 60 187, 60 162 Z"
          className="fill-primary-soft-border"
        />
        <ellipse
          cx="160"
          cy="150"
          rx="100"
          ry="24"
          className="fill-primary-soft stroke-primary-soft-border"
          strokeWidth="1.5"
        />

        {/* Chart panel with rising bars */}
        <g transform="translate(68, 62)">
          <rect
            width="105"
            height="74"
            rx="8"
            className="fill-surface-raised stroke-border"
            strokeWidth="1.5"
          />
          <line
            x1="12"
            y1="62"
            x2="93"
            y2="62"
            className="stroke-border"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect x="18" y="44" width="10" height="18" rx="2" className="fill-primary" />
          <rect x="34" y="34" width="10" height="28" rx="2" className="fill-primary" />
          <rect x="50" y="24" width="10" height="38" rx="2" className="fill-primary" />
          <rect x="66" y="16" width="10" height="46" rx="2" className="fill-primary-strong" />
          <path
            d="M 23 42 Q 45 28 71 14"
            className="stroke-primary-deep"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon points="73,12 65,13 70,20" className="fill-primary-deep" />
        </g>

        {/* Checklist clipboard */}
        <g transform="translate(182, 70)">
          <rect
            y="6"
            width="56"
            height="74"
            rx="6"
            className="fill-surface-raised stroke-border"
            strokeWidth="1.5"
          />
          <rect x="18" y="2" width="20" height="8" rx="2" className="fill-sidebar" />
          <circle cx="28" cy="6" r="1.5" className="fill-surface-raised" />
          <g transform="translate(8, 18)">
            {[5, 18, 31, 44].map((y, i) => (
              <g key={y}>
                <circle
                  cx="5"
                  cy={y}
                  r="4.5"
                  className="fill-primary-soft stroke-primary"
                  strokeWidth="1.2"
                />
                <path
                  d={`M3 ${y} L4.5 ${y + 1.5} L7 ${y - 1.5}`}
                  className="stroke-primary-strong"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="13"
                  y1={y}
                  x2={[36, 34, 38, 32][i]}
                  y2={y}
                  className="stroke-text-muted"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </g>
            ))}
          </g>
        </g>

        {/* Target board */}
        <g transform="translate(132, 122)">
          <rect x="24" y="44" width="8" height="14" rx="2" className="fill-sidebar-raised" />
          <ellipse cx="28" cy="56" rx="14" ry="4" className="fill-sidebar" />
          <circle
            cx="28"
            cy="28"
            r="26"
            className="fill-primary-strong stroke-surface-raised"
            strokeWidth="2"
          />
          <circle cx="28" cy="28" r="18" className="fill-surface-raised" />
          <circle cx="28" cy="28" r="11" className="fill-primary-deep" />
          <circle cx="28" cy="28" r="5" className="fill-surface-raised" />
          <circle cx="28" cy="28" r="2.5" className="fill-primary" />
        </g>
      </svg>
    </div>
  );
}

// --- Small building blocks ---

const CARD = 'min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-card';

/** What a card shows when its data could not be loaded. */
function CardMessage({ forbidden, onRetry }: { forbidden: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span>
        {forbidden ? 'You do not have access to this information.' : 'Could not load this.'}
      </span>
      {!forbidden && (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold text-primary-ink hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  ariaLabel: string;
  onOpen: () => void;
  icon: ReactNode;
  iconClass: string;
  value: ReactNode;
  badge: ReactNode;
}

function KpiCard({ label, ariaLabel, onOpen, icon, iconClass, value, badge }: KpiCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong sm:p-5"
    >
      <span className="flex min-w-0 items-center gap-3.5">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-text transition-transform group-hover:scale-105 ${iconClass}`}
        >
          {icon}
        </span>
        <span>
          <span className="block text-xs font-semibold text-text-muted">{label}</span>
          <span className="mt-0.5 block font-display text-2xl font-extrabold leading-none text-text sm:text-3xl">
            {value}
          </span>
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface-raised px-2.5 py-1 text-[11px] font-bold text-text">
        {badge}
      </span>
    </button>
  );
}

/** A KPI number: a placeholder while loading, a dash if it failed, the value once it is there. */
function metric<T>(resource: Resource<T>, pick: (data: T) => ReactNode): ReactNode {
  if (resource.status === 'loading') return <Skeleton className="h-8 w-12" aria-label="Loading" />;
  if (resource.status === 'error') return <span title="Could not load">&mdash;</span>;
  return pick(resource.data);
}

// Ring colours per task status. Status is also written out in the legend, never colour alone.
const RING: Record<TaskStatus, { stroke: string; dot: string }> = {
  completed: { stroke: 'stroke-success', dot: 'bg-success' },
  in_progress: { stroke: 'stroke-info', dot: 'bg-info' },
  in_review: { stroke: 'stroke-warning', dot: 'bg-warning' },
  todo: { stroke: 'stroke-border-strong', dot: 'bg-border-strong' },
  blocked: { stroke: 'stroke-danger', dot: 'bg-danger' },
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'border-border bg-surface-muted text-text-muted',
  in_progress: 'border-primary-soft-border bg-primary-soft text-primary-ink',
  in_review: 'border-border bg-tile-yellow text-text',
  completed: 'border-border bg-positive-soft text-positive-ink',
  blocked: 'border-border bg-negative-soft text-negative-ink',
};

const DONUT_RADIUS = 42;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const DONUT_GAP = 3;

function TaskDonut({ tasks }: { tasks: TaskBreakdown }) {
  let used = 0;
  const arcs = TASK_STATUSES.map((status) => {
    const share = tasks.total > 0 ? tasks.counts[status] / tasks.total : 0;
    const full = share * DONUT_CIRCUMFERENCE;
    const length = Math.max(0, full - DONUT_GAP);
    const arc = { status, length, offset: -used };
    used += full;
    return arc;
  });

  return (
    <div className="my-auto flex items-center justify-between gap-4 py-3">
      <div className="relative flex h-32 w-32 shrink-0 items-center justify-center sm:h-36 sm:w-36">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={DONUT_RADIUS}
            fill="none"
            className="stroke-surface-muted"
            strokeWidth="12"
          />
          {arcs
            .filter((arc) => arc.length > 0)
            .map((arc) => (
              <circle
                key={arc.status}
                cx="50"
                cy="50"
                r={DONUT_RADIUS}
                fill="none"
                className={`${RING[arc.status].stroke} transition-all duration-700 ease-out`}
                strokeWidth="12"
                strokeDasharray={`${arc.length} ${DONUT_CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={arc.offset}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-2xl font-black leading-none text-text">
            {tasks.total}
          </span>
          <span className="mt-0.5 text-[11px] font-semibold text-text-muted">Tasks</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2 pr-1 text-xs">
        {TASK_STATUSES.map((status) => (
          <li key={status} className="flex items-center justify-between">
            <span className="flex items-center gap-2 truncate font-medium text-text">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${RING[status].dot}`}
                aria-hidden="true"
              />
              {TASK_STATUS_LABELS[status]}
            </span>
            <span className="ml-2 shrink-0 font-mono font-semibold text-text">
              {tasks.counts[status]}{' '}
              <span className="font-normal text-text-muted">({tasks.percents[status]}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamLeadDashboard() {
  const user = useContext(AuthContext)?.user;
  const navigate = useNavigate();
  const { team, myTasks, teamTasks, approvals, attendance, retry } = useTeamLeadDashboardData();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const formattedToday = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  const leadName = user?.name;
  const leadTitle =
    user?.title || (user?.department ? `${user.department} Team Lead` : 'Team Lead');

  const teamTaskSummary = useMemo(
    () => (teamTasks.status === 'ready' ? summarizeTasks(teamTasks.data.items) : null),
    [teamTasks],
  );
  const activeTasks = useMemo(
    () => (teamTasks.status === 'ready' ? pickActiveTasks(teamTasks.data.items) : []),
    [teamTasks],
  );
  const attendanceSummary = useMemo(
    () =>
      attendance.status === 'ready' && team.status === 'ready'
        ? summarizeAttendance(attendance.data.items, team.data.total)
        : null,
    [attendance, team],
  );

  const inProgress = (resource: Resource<Counted<Task>>) =>
    metric(
      resource,
      (d) => `${d.items.filter((t) => t.status === 'in_progress').length} In Progress`,
    );

  return (
    <div className="w-full min-w-0 space-y-6 pb-10" data-testid="team-lead-dashboard">
      {/* 1. Greeting */}
      <div className="flex flex-col justify-between gap-4 pt-1 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
            <span>
              {greeting}
              {leadName ? ',' : ''}
            </span>
            {leadName && <span className="text-primary-ink">{leadName}</span>}
            <span role="img" aria-label="Waving hand">
              👋
            </span>
          </h1>
          <p className="mt-1 text-xs font-medium text-text-muted sm:text-sm">
            <span className="font-semibold text-text">{leadTitle}</span>
            <span className="mx-2 text-border-strong">|</span>
            <span>Here&apos;s your team&apos;s progress, tasks, and approvals.</span>
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-text shadow-card md:self-auto">
          <CalendarIcon className="h-4 w-4 text-text-muted" />
          <span>{formattedToday}</span>
        </div>
      </div>

      {/* 2. KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Team Size"
          ariaLabel="Team Size KPI Card"
          onOpen={() => navigate('/lead/team')}
          icon={<UsersIcon />}
          iconClass="bg-primary-soft"
          value={metric(team, (d) => d.total)}
          badge={metric(
            team,
            (d) => `${d.items.filter((e) => e.status === 'active').length} active`,
          )}
        />
        <KpiCard
          label="My Tasks"
          ariaLabel="My Tasks KPI Card"
          onOpen={() => navigate('/tasks')}
          icon={<ClipboardCheckIcon />}
          iconClass="bg-tile-yellow"
          value={metric(myTasks, (d) => d.total)}
          badge={inProgress(myTasks)}
        />
        <KpiCard
          label="Team Tasks"
          ariaLabel="Team Tasks KPI Card"
          onOpen={() => navigate('/lead/tasks')}
          icon={<LayersIcon />}
          iconClass="bg-tile-blue"
          value={metric(teamTasks, (d) => d.total)}
          badge={inProgress(teamTasks)}
        />
        <KpiCard
          label="Pending Approvals"
          ariaLabel="Pending Approvals KPI Card"
          onOpen={() => navigate('/lead/approvals')}
          icon={<CalendarCheckIcon />}
          iconClass="bg-tile-peach"
          value={metric(approvals, (d) => d.total)}
          badge={metric(approvals, (d) => {
            const s = summarizeApprovals(d.items);
            return `${s.leave} Leave • ${s.attendance} Attendance`;
          })}
        />
      </div>

      {/* 3. Task overview, time tracker, attendance */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <section className={`${CARD} flex flex-col justify-between lg:col-span-4`}>
          <h2 className="pb-2 font-display text-base font-bold text-text">Team Task Overview</h2>
          {teamTasks.status === 'loading' && <CardSkeleton rows={4} />}
          {teamTasks.status === 'error' && (
            <CardMessage forbidden={teamTasks.forbidden} onRetry={() => retry('teamTasks')} />
          )}
          {teamTaskSummary && (
            <>
              <TaskDonut tasks={teamTaskSummary} />
              {teamTaskSummary.total === 0 && (
                <p className="text-xs text-text-muted">
                  No tasks have been assigned to your team yet.
                </p>
              )}
            </>
          )}
        </section>

        <div className="min-w-0 lg:col-span-4">
          <TimeTrackerCard variant="overview" className="h-full rounded-2xl" />
        </div>

        <section className={`${CARD} flex flex-col justify-between lg:col-span-4`}>
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-base font-bold text-text">Attendance (Today)</h2>
            {attendanceSummary && team.status === 'ready' && (
              <span className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 font-mono text-xs font-bold text-text">
                {attendanceSummary.checkedIn}/{team.data.total}
              </span>
            )}
          </div>

          {(attendance.status === 'loading' || team.status === 'loading') && (
            <CardSkeleton rows={4} />
          )}
          {(attendance.status === 'error' || team.status === 'error') && (
            <CardMessage
              forbidden={
                (attendance.status === 'error' && attendance.forbidden) ||
                (team.status === 'error' && team.forbidden)
              }
              onRetry={() => retry('attendance', 'team')}
            />
          )}
          {attendanceSummary && (
            <ul className="my-auto space-y-4 py-4">
              {(
                [
                  ['Present', attendanceSummary.present, 'bg-success'],
                  ['Late', attendanceSummary.late, 'bg-warning'],
                  ['On leave', attendanceSummary.onLeave, 'bg-info'],
                  ['Absent', attendanceSummary.absent, 'bg-danger'],
                ] as const
              ).map(([label, count, dot], i, all) => (
                <li
                  key={label}
                  className={`flex items-center justify-between py-1 ${i < all.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-text">{label}</span>
                  </span>
                  <span className="font-mono text-sm font-bold text-text">{count}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-text-muted">
            <span>Own team attendance scope</span>
            <button
              type="button"
              onClick={() => navigate('/lead/attendance')}
              className="font-semibold text-primary-ink hover:underline"
            >
              View roster &rarr;
            </button>
          </div>
        </section>
      </div>

      {/* 4. Team performance and active tasks */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
        <section className={`${CARD} flex flex-col justify-between lg:col-span-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold text-text">Team Performance</h2>
            <button
              type="button"
              onClick={() => navigate('/lead/reports')}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted transition-colors hover:text-text"
              aria-label="View Team Performance Details"
            >
              <ArrowUpRightIcon />
            </button>
          </div>

          <TeamPerformanceIllustration />

          <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-text-muted">
            <span>Completion Rate</span>
            <span className="font-mono font-bold text-primary-ink">
              {teamTaskSummary && teamTaskSummary.total > 0
                ? `${teamTaskSummary.percents.completed}% achieved`
                : '—'}
            </span>
          </div>
        </section>

        <section className={`${CARD} flex flex-col justify-between lg:col-span-8`}>
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2 className="font-display text-base font-bold text-text">Active Team Tasks</h2>
            <button
              type="button"
              onClick={() => navigate('/lead/tasks')}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-muted transition-colors hover:text-text"
              aria-label="View team tasks"
            >
              <ArrowUpRightIcon />
            </button>
          </div>

          {teamTasks.status === 'loading' && <CardSkeleton rows={4} />}
          {teamTasks.status === 'error' && (
            <CardMessage forbidden={teamTasks.forbidden} onRetry={() => retry('teamTasks')} />
          )}
          {teamTasks.status === 'ready' && activeTasks.length === 0 && (
            <p className="py-6 text-center text-xs text-text-muted">
              No active tasks. Open tasks assigned to your team will appear here.
            </p>
          )}
          {activeTasks.length > 0 && (
            <div className="my-auto overflow-x-auto py-1">
              <table className="w-full min-w-[500px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border font-semibold text-text-muted">
                    <th scope="col" className="px-3 py-2.5">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Task
                    </th>
                    <th scope="col" className="px-3 py-2.5">
                      Due Date
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeTasks.map((task) => (
                    <tr key={task.id} className="transition-colors hover:bg-surface-muted">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar
                            name={task.assigneeName}
                            employeeId={task.assigneeEmployeeId}
                            decorative
                            className={`h-6 w-6 text-[10px] font-bold ${getAvatarTone(task.assigneeName)}`}
                          />
                          <span className="whitespace-nowrap font-semibold text-text">
                            {task.assigneeName}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-text">
                        {task.title}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-text-muted">
                        {formatDueDate(task.dueDate)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[task.status]}`}
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-text-muted">
            <span>Showing the next tasks due</span>
            <button
              type="button"
              onClick={() => navigate('/lead/tasks')}
              className="font-semibold text-primary-ink hover:underline"
            >
              View all tasks &rarr;
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
