import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Button, StatusPill } from '../components/ui';

export interface TeamLeadDashboardProps {
  onNavigate?: (path: string) => void;
}

export function TeamLeadDashboard({ onNavigate }: TeamLeadDashboardProps) {
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const navigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    } else if (typeof window !== 'undefined') {
      window.location.href = path;
    }
  };

  useEffect(() => {
    let mounted = true;
    apiFetch('/api/v1/approvals?status=pending&pageSize=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (mounted && typeof json?.meta?.total === 'number') {
          setPendingCount(json.meta.total);
        }
      })
      .catch(() => {});
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
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">12</p>
          <p className="mt-1 text-xs text-positive-ink font-medium">10 present today</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Pending Approvals
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-warning font-display">
            {pendingCount ?? 2}
          </p>
          <p className="mt-1 text-xs text-warning font-medium">Leave requests awaiting action</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Sprint Velocity
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-primary-deep font-display">
            88%
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
            {[
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
            {[
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
