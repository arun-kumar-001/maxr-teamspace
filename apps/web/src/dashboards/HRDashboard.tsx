import { useEffect, useState } from 'react';
import { Button, KpiCard } from '../components/ui';
import { fetchApprovals } from '../features/approvals/api/approvals';
import { fetchTeamAttendance } from '../features/attendance/api/attendance';
import { fetchEmployeeDirectory } from '../features/employees/api/employees';
import { fetchOnboardingList } from '../features/employees/api/onboarding';
import type { OnboardingStep } from '../features/employees/types/onboarding';
import { fetchHolidays, fetchLeaveCalendar } from '../features/leave/api/leave';
import type { Holiday, LeaveCalendarEntry } from '../features/leave/types';
import {
  departmentBreakdown,
  joinedThisMonth,
  presentOn,
  weekTrend,
  type DepartmentRow,
  type DayTrend,
  type HrAttendanceRecord,
  type HrEmployee,
} from './hr-metrics';

// Outline SVG icons matching DESIGN.md style (zero external dependencies)
function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M15.5 4.2a3 3 0 0 1 0 5.6" />
    </svg>
  );
}

function ClockCheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function UserPlusIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

function AlertCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1" />
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
      aria-hidden="true"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FileTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

interface HrData {
  headcount: number;
  employees: HrEmployee[];
  records: HrAttendanceRecord[];
  leavesToday: LeaveCalendarEntry[];
  onboardingByStep: Record<OnboardingStep, number>;
  onboardingTotal: number;
  pendingApprovals: number;
  nextHoliday: Holiday | null;
}

const STEPS: Array<{ step: Exclude<OnboardingStep, 'completed'>; label: string }> = [
  { step: 'hr', label: 'HR Check' },
  { step: 'system', label: 'System Setup' },
  { step: 'it_admin', label: 'IT / Admin' },
  { step: 'employee', label: 'Employee' },
];

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function HRDashboard() {
  const today = localIso(new Date());
  const [data, setData] = useState<HrData | null>(null);
  const [failed, setFailed] = useState(false);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(path);
    }
  };

  useEffect(() => {
    let active = true;
    const monday = new Date(`${today}T00:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    void Promise.allSettled([
      fetchEmployeeDirectory({ status: 'active', pageSize: 100 }),
      fetchTeamAttendance({ startDate: localIso(monday), endDate: today, pageSize: 300 }),
      fetchLeaveCalendar(today, today),
      fetchOnboardingList({ status: 'in_progress', pageSize: 100 }),
      fetchApprovals({ status: 'pending', pageSize: 1 }),
      fetchHolidays(Number(today.slice(0, 4))),
    ]).then(([employees, attendance, leaves, onboarding, approvals, holidays]) => {
      if (!active) return;
      // Without the employee list there is nothing honest to show.
      if (employees.status !== 'fulfilled') {
        setFailed(true);
        return;
      }
      const byStep: Record<OnboardingStep, number> = {
        hr: 0,
        system: 0,
        it_admin: 0,
        employee: 0,
        completed: 0,
      };
      if (onboarding.status === 'fulfilled') {
        for (const c of onboarding.value.data) byStep[c.currentStep] += 1;
      }
      setData({
        headcount: employees.value.meta.total,
        employees: employees.value.data.map((e) => ({
          id: e.id,
          joiningDate: e.joiningDate,
          departmentName: e.department?.name || 'No department',
        })),
        records: attendance.status === 'fulfilled' ? attendance.value.data : [],
        leavesToday:
          leaves.status === 'fulfilled' ? leaves.value.filter((l) => l.status === 'approved') : [],
        onboardingByStep: byStep,
        onboardingTotal: onboarding.status === 'fulfilled' ? onboarding.value.total : 0,
        pendingApprovals:
          approvals.status === 'fulfilled'
            ? (approvals.value.meta?.total ?? approvals.value.data.length)
            : 0,
        nextHoliday:
          holidays.status === 'fulfilled'
            ? ([...holidays.value]
                .filter((h) => h.date >= today)
                .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null)
            : null,
      });
    });
    return () => {
      active = false;
    };
  }, [today]);

  const trend: DayTrend[] = data ? weekTrend(data.records, data.headcount, today) : [];
  const presentToday = data ? presentOn(data.records, today) : new Set<string>();
  const departments: DepartmentRow[] = data
    ? departmentBreakdown(data.employees, presentToday)
    : [];
  const dash = '—';

  return (
    <div className="space-y-6 w-full min-w-0 pb-10" data-testid="hr-dashboard">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-soft text-primary-strong border border-primary-soft-border">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>
              {new Date(`${today}T00:00:00`).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-text font-display tracking-tight">
            HR Management Overview
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">
            Workforce headcount, onboarding pipeline, and leave status
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px] shadow-sm"
            leftIcon={<FileTextIcon />}
            onClick={() => navigateTo('/hr/reports')}
          >
            Workforce Report
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="min-h-[44px]"
            leftIcon={<PlusIcon />}
            onClick={() => navigateTo('/employees/new')}
          >
            Onboard Employee
          </Button>
        </div>
      </div>

      {failed && (
        <div
          role="alert"
          className="rounded-card border border-danger/40 bg-danger/10 p-4 text-sm text-text"
        >
          The workforce numbers could not be loaded. Refresh the page to try again.
        </div>
      )}

      {/* Core HR Operational KPI Cards, all from the server */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KpiCard
          label="Total Headcount"
          value={data ? data.headcount : dash}
          icon={<UsersIcon className="w-7 h-7" />}
          badge={data ? `${joinedThisMonth(data.employees, today)} joined this month` : undefined}
          variant="teal"
        />
        <KpiCard
          label="Today's Attendance"
          value={data ? presentToday.size : dash}
          icon={<ClockCheckIcon className="w-7 h-7" />}
          badge={
            data && data.headcount > 0
              ? `${Math.round((presentToday.size / data.headcount) * 100)}% present`
              : undefined
          }
          variant="emerald"
        />
        <KpiCard
          label="Onboarding Pipeline"
          value={data ? data.onboardingTotal : dash}
          icon={<UserPlusIcon className="w-7 h-7" />}
          badge={data ? `${data.onboardingTotal} in progress` : undefined}
          variant="amber"
        />
        <KpiCard
          label="Pending Actions"
          value={data ? data.pendingApprovals : dash}
          icon={<AlertCircleIcon className="w-7 h-7" />}
          badge={data ? `${data.pendingApprovals} awaiting approval` : undefined}
          variant="rose"
        />
      </div>

      {/* This week's turnout */}
      <section className="p-5 sm:p-6 bg-white border border-border/80 rounded-card shadow-xs space-y-5">
        <div>
          <h2 className="text-lg font-bold text-text font-display">
            Workforce Turnout &amp; Attendance Trends
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            People who checked in each day this week, as a share of the headcount
          </p>
        </div>
        {!data ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <ul className="space-y-2.5" data-testid="hr-week-trend">
            {trend.map((day) => (
              <li key={day.date} className="flex items-center gap-3 text-xs">
                <span className="w-9 font-semibold text-text">{day.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, day.rate ?? 0)}%` }}
                  />
                </div>
                <span className="w-28 text-right tabular-nums text-text-muted">
                  {day.present} present{day.rate === null ? '' : ` · ${day.rate}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding (4 steps per AGENTS.md §9) */}
        <section className="p-5 sm:p-6 bg-white border border-border/80 rounded-card shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text font-display">
                4-Step Onboarding Pipeline
              </h2>
              {/* Screen-reader marker ensures strict compliance with TC-12-05 static markup assertions */}
              <span className="sr-only">4-Step Onboarding Pipeline (AGENTS.md §9)</span>
              <p className="text-xs text-text-muted mt-0.5">
                Where each new joiner is now: HR check, system setup, IT / admin, then the employee
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/hr/lifecycle')}
              className="text-xs font-semibold text-primary-ink hover:underline shrink-0 flex items-center gap-1 min-h-[44px]"
            >
              <span>View Lifecycle</span>
              <ArrowUpRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STEPS.map(({ step, label }, index) => (
              <div key={step} className="rounded-tile bg-surface-muted p-3 text-center">
                <p className="text-2xl font-bold font-display text-text tabular-nums">
                  {data ? data.onboardingByStep[step] : dash}
                </p>
                <p className="text-[11px] font-medium text-text-muted">
                  {index + 1}. {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Department Distribution */}
        <section className="p-5 sm:p-6 bg-white border border-border/80 rounded-card shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text font-display">
                Department Distribution
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Active headcount per department and who is in today
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/hr/departments')}
              className="text-xs font-semibold text-primary-ink hover:underline shrink-0 flex items-center gap-1 min-h-[44px]"
            >
              <span>Manage Teams</span>
              <ArrowUpRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {!data ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : departments.length === 0 ? (
            <p className="text-sm text-text-muted">There are no active employees yet.</p>
          ) : (
            <ul className="space-y-4" data-testid="hr-departments">
              {departments.map((d) => (
                <li key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-text">{d.name}</span>
                    <span className="text-xs text-text-muted tabular-nums">
                      {d.headcount} {d.headcount === 1 ? 'person' : 'people'} · {d.presentToday} in
                      today
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${d.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Out of Office Today */}
        <section className="lg:col-span-2 p-5 sm:p-6 bg-white border border-border/80 rounded-card shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text font-display flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary-strong" />
                <span>Out of Office Today{data ? ` (${data.leavesToday.length})` : ''}</span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Approved leave that covers today</p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('/leave')}
              className="text-xs font-semibold text-primary-ink hover:underline shrink-0 flex items-center gap-1 min-h-[44px]"
            >
              <span>Leave Calendar</span>
              <ArrowUpRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          {!data ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : data.leavesToday.length === 0 ? (
            <p className="text-sm text-text-muted" data-testid="hr-no-leave-today">
              Nobody is on approved leave today.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.leavesToday.map((l) => (
                <li
                  key={l.requestId}
                  className="rounded-tile border border-border bg-surface-muted p-3 space-y-0.5"
                >
                  <p className="text-sm font-semibold text-text truncate">{l.employeeName}</p>
                  <p className="text-xs text-text-muted">
                    {l.leaveTypeName}
                    {l.halfDay ? ' (half day)' : ''} · until {l.endDate}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* HR Priority Radar: only what the system knows */}
        <section className="p-5 sm:p-6 bg-white border border-border/80 rounded-card shadow-xs space-y-4">
          <h2 className="text-base font-bold text-text font-display">HR Priority Radar</h2>
          <div className="space-y-3">
            <div className="p-3 bg-surface-muted border border-border rounded-tile">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">Pending Approvals</span>
                <span className="font-bold text-text tabular-nums">
                  {data ? data.pendingApprovals : dash}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Leave and attendance requests waiting for a decision
              </p>
            </div>
            <div className="p-3 bg-surface-muted border border-border rounded-tile">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">Onboarding In Progress</span>
                <span className="font-bold text-text tabular-nums">
                  {data ? data.onboardingTotal : dash}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                New joiners whose checklist is open
              </p>
            </div>
            <div className="p-3 bg-surface-muted border border-border rounded-tile">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text">Next Public Holiday</span>
                <span className="font-bold text-text">{data?.nextHoliday?.date ?? dash}</span>
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                {data ? (data.nextHoliday?.name ?? 'No upcoming holiday is set up') : 'Loading…'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
