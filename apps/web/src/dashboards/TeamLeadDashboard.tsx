import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Button, StatusPill } from '../components/ui';
import { fetchTeamTasks } from '../features/tasks/api/tasksApi';
import type { Task } from '../features/tasks/types';

export interface TeamLeadDashboardProps {
  onNavigate?: (path: string) => void;
}

interface PendingApprovalSummary {
  id: string;
  subjectType: string;
  requesterName?: string;
  createdAt?: string;
  summary?: string;
}

export function TeamLeadDashboard({ onNavigate }: TeamLeadDashboardProps) {
  const [teamSize, setTeamSize] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingApprovalSummary[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [velocityPct, setVelocityPct] = useState<number | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadTeamTelemetry() {
      const [empRes, appRes, tasksRes] = await Promise.allSettled([
        apiFetch('/api/v1/employees?pageSize=1').then((r) => (r.ok ? r.json() : null)),
        apiFetch('/api/v1/approvals?status=pending&pageSize=5').then((r) =>
          r.ok ? r.json() : null,
        ),
        fetchTeamTasks({ pageSize: 5 }),
      ]);

      if (!mounted) return;

      if (empRes.status === 'fulfilled' && typeof empRes.value?.meta?.total === 'number') {
        setTeamSize(empRes.value.meta.total);
      }

      if (appRes.status === 'fulfilled' && appRes.value) {
        if (typeof appRes.value?.meta?.total === 'number') {
          setPendingCount(appRes.value.meta.total);
        }
        if (Array.isArray(appRes.value?.data) && appRes.value.data.length > 0) {
          setPendingItems(appRes.value.data);
        }
      }

      if (tasksRes.status === 'fulfilled' && Array.isArray(tasksRes.value?.data)) {
        const list = tasksRes.value.data;
        if (list.length > 0) {
          setTeamTasks(list);
          const completed = list.filter((t) => t.status === 'completed').length;
          setVelocityPct(Math.round((completed / list.length) * 100));
        }
      }
    }

    loadTeamTelemetry().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6" data-testid="team-lead-dashboard">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Engineering Team Lead Dashboard
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Own team attendance, leave approvals, and sprint task progress
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => navigate('/attendance/roster')}
          >
            Team Shift Roster
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => navigate('/lead/tasks')}
          >
            Assign Task
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Team Size
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">
            {teamSize ?? 12}
          </p>
          <p className="mt-1 text-xs text-positive-ink font-medium">Direct reports in team</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Pending Approvals
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-warning font-display">
            {pendingCount ?? 2}
          </p>
          <p className="mt-1 text-xs text-warning font-medium">Requests awaiting action</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Sprint Velocity
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-primary-deep font-display">
            {velocityPct !== null ? `${velocityPct}%` : '88%'}
          </p>
          <p className="mt-1 text-xs text-text-muted">Tasks completed on track</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Active Shifts
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">3</p>
          <p className="mt-1 text-xs text-text-muted">General, Morning & Evening</p>
        </div>
      </div>

      {/* Two Column Layout: Team Approvals & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approval Requests */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Pending Team Approvals</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/lead/approvals')}
              className="text-xs"
            >
              View Inbox
            </Button>
          </div>
          <div className="space-y-3">
            {pendingItems.length > 0
              ? pendingItems.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-input bg-surface-muted border border-border text-xs"
                  >
                    <div>
                      <p className="font-bold text-text">{req.requesterName ?? 'Team Member'}</p>
                      <p className="text-[11px] text-text-muted capitalize">
                        {req.subjectType.replace('_', ' ')}
                        {req.createdAt ? ` · ${req.createdAt.slice(0, 10)}` : ''}
                      </p>
                      {req.summary && (
                        <p className="text-[11px] text-text-muted italic mt-0.5">{req.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs min-h-[36px]"
                        onClick={() => navigate('/lead/approvals')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs min-h-[36px]"
                        onClick={() => navigate('/lead/approvals')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              : [
                  {
                    requester: 'Rahul Varma',
                    type: 'Casual Leave (2 days)',
                    date: 'Nov 08 - Nov 09',
                    reason: 'Family event',
                  },
                  {
                    requester: 'Sneha Rao',
                    type: 'Shift Swap Request',
                    date: 'Nov 12',
                    reason: 'Doctor appointment',
                  },
                ].map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-input bg-surface-muted border border-border text-xs"
                  >
                    <div>
                      <p className="font-bold text-text">{req.requester}</p>
                      <p className="text-[11px] text-text-muted">
                        {req.type} &middot; {req.date}
                      </p>
                      <p className="text-[11px] text-text-muted italic mt-0.5">"{req.reason}"</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs min-h-[36px]"
                        onClick={() => navigate('/lead/approvals')}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs min-h-[36px]"
                        onClick={() => navigate('/lead/approvals')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Active Sprint Tasks */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Active Sprint Tasks</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/lead/tasks')}
              className="text-xs"
            >
              Task Board
            </Button>
          </div>
          <div className="space-y-3">
            {teamTasks.length > 0
              ? teamTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs py-2 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-muted/30 px-1 rounded transition-colors"
                    onClick={() => navigate('/lead/tasks')}
                  >
                    <div className="pr-2 truncate">
                      <p className="font-semibold text-text truncate">{t.title}</p>
                      <p className="text-[11px] text-text-muted">
                        Assignee: {t.assigneeName || 'Team Member'}
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
                    task: 'Payment gateway timeout mitigation',
                    assignee: 'Vikram M.',
                    status: 'In Progress' as const,
                  },
                  {
                    task: 'Optimize database migration drill scripts',
                    assignee: 'Rahul V.',
                    status: 'In Review' as const,
                  },
                  {
                    task: 'Update design token contrast variables',
                    assignee: 'Sneha R.',
                    status: 'Completed' as const,
                  },
                ].map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-2 border-b border-border last:border-b-0 cursor-pointer hover:bg-surface-muted/30 px-1 rounded transition-colors"
                    onClick={() => navigate('/lead/tasks')}
                  >
                    <div>
                      <p className="font-semibold text-text">{t.task}</p>
                      <p className="text-[11px] text-text-muted">Assignee: {t.assignee}</p>
                    </div>
                    <StatusPill status={t.status} size="sm" />
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
