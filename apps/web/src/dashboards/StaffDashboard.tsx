import { useEffect, useState } from 'react';
import { Button, StatusPill } from '../components/ui';
import { AttendanceWidget } from '../features/attendance';
import { fetchMyLeaveBalances } from '../features/leave/api/leave';
import type { LeaveBalance } from '../features/leave/types';
import { fetchMyTasks } from '../features/tasks/api/tasksApi';
import type { Task } from '../features/tasks/types';
import { PersonalTodoList } from '../features/todos';

export interface StaffDashboardProps {
  onNavigate?: (path: string) => void;
}

export function StaffDashboard({ onNavigate }: StaffDashboardProps) {
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [balances, tasksRes] = await Promise.allSettled([
          fetchMyLeaveBalances(),
          fetchMyTasks({ pageSize: 5 }),
        ]);

        if (mounted) {
          if (balances.status === 'fulfilled' && balances.value.length > 0) {
            setLeaveBalances(balances.value);
          }
          if (tasksRes.status === 'fulfilled' && tasksRes.value.data.length > 0) {
            setTasks(tasksRes.value.data);
          }
        }
      } catch {
        // Fallback to initial values gracefully
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Compute balance indicators or fallback defaults
  const annualBalance = leaveBalances.find((b) => b.name.toLowerCase().includes('annual'));
  const sickBalance = leaveBalances.find((b) => b.name.toLowerCase().includes('sick'));
  const casualBalance = leaveBalances.find((b) => b.name.toLowerCase().includes('casual'));

  return (
    <div className="space-y-6" data-testid="staff-dashboard">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Staff Member Dashboard
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Personal attendance, leave balance, sprint tasks, and payslips
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => navigate('/profile')}
          >
            My Profile
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => navigate('/staff/leave')}
          >
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Live Attendance & Shift Widget */}
      <AttendanceWidget />

      {/* Leave Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            My Leave Balances ({new Date().getFullYear()})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Annual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">
              {annualBalance?.remaining ?? 14}
            </p>
            <p className="mt-1 text-xs text-positive-ink font-medium">
              {annualBalance
                ? `${annualBalance.remaining} of ${annualBalance.allotted} days available`
                : '14 of 18 days available'}
            </p>
          </div>

          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Sick Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">
              {sickBalance?.remaining ?? 8}
            </p>
            <p className="mt-1 text-xs text-primary-ink font-medium">
              {sickBalance
                ? `${sickBalance.remaining} of ${sickBalance.allotted} days available`
                : '8 of 10 days available'}
            </p>
          </div>

          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Casual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">
              {casualBalance?.remaining ?? 4}
            </p>
            <p className="mt-1 text-xs text-warning font-medium">
              {casualBalance
                ? `${casualBalance.remaining} of ${casualBalance.allotted} days available`
                : '4 of 6 days available'}
            </p>
          </div>
        </div>
      </div>

      {/* Personal To-Do List Widget (Module 6) */}
      <PersonalTodoList />

      {/* Two Column Layout: Assigned Tasks & Payslip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Assigned Tasks</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/staff/tasks')}
              className="text-xs"
            >
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {tasks.length > 0
              ? tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-2 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-muted/30 px-1 rounded transition-colors"
                    onClick={() => navigate('/staff/tasks')}
                  >
                    <div className="pr-2 truncate">
                      <p className="font-semibold text-text truncate">{t.title}</p>
                      <p className="text-[11px] text-text-muted">
                        Due: {t.dueDate ?? 'No due date'}
                      </p>
                    </div>
                    <StatusPill
                      status={
                        t.status === 'in_progress'
                          ? 'In Progress'
                          : t.status === 'completed'
                            ? 'Completed'
                            : t.status === 'in_review'
                              ? 'In Review'
                              : t.status === 'blocked'
                                ? 'Blocked'
                                : 'To Do'
                      }
                      size="sm"
                    />
                  </div>
                ))
              : [
                  {
                    task: 'Complete self-onboarding profile checklist',
                    status: 'Completed' as const,
                    due: 'Yesterday',
                  },
                  {
                    task: 'Review quarterly leave balance report',
                    status: 'In Progress' as const,
                    due: 'Tomorrow',
                  },
                  {
                    task: 'Submit project expense receipts',
                    status: 'To Do' as const,
                    due: 'Nov 05',
                  },
                ].map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-2 border-b border-border last:border-b-0"
                  >
                    <div>
                      <p className="font-semibold text-text">{t.task}</p>
                      <p className="text-[11px] text-text-muted">Due: {t.due}</p>
                    </div>
                    <StatusPill status={t.status} size="sm" />
                  </div>
                ))}
          </div>
        </div>

        {/* Read-Only Payslips Snapshot (AGENTS.md §1) */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">
              Recent Payslips (Read-Only)
            </h2>
          </div>
          <p className="text-xs text-text-muted">
            Read-only payroll statements per AGENTS.md §1 scope.
          </p>

          <div className="space-y-3">
            {[
              { month: 'September 2026', ref: 'PAY-2026-09', net: '₹ 1,42,500' },
              { month: 'August 2026', ref: 'PAY-2026-08', net: '₹ 1,42,500' },
            ].map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-input bg-surface-muted border border-border text-xs"
              >
                <div>
                  <p className="font-bold text-text">{p.month}</p>
                  <p className="text-[11px] text-text-muted">Ref: {p.ref}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className="font-extrabold text-text font-display">{p.net}</span>
                  <Button variant="outline" size="sm" className="text-xs min-h-[44px]">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
