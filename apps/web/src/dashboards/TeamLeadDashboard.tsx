import { Button, Badge, StatusPill } from '../components/ui';

export function TeamLeadDashboard() {
  return (
    <div className="space-y-6" data-testid="team-lead-dashboard">
      {/* Top Banner with Sample Data Badge (B2 Fix) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Engineering Team Lead Dashboard
            </h1>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Own team attendance, leave approvals, and sprint task progress
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]">
            Team Shift Roster
          </Button>
          <Button variant="primary" size="sm" className="min-h-[44px]">
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
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-warning font-display">2</p>
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
            Blocked Issues
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-danger font-display">1</p>
          <p className="mt-1 text-xs text-danger font-medium">Needs dependency clearance</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Widget */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Pending Leave Approvals</h2>
            <div className="flex items-center gap-2">
              <Badge variant="warning">2 Actions</Badge>
              <Badge variant="neutral">Sample data</Badge>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { employee: 'Alex Mercer', type: 'Annual Leave', dates: 'Nov 02 - Nov 04 (3 days)' },
              { employee: 'Kavita Nair', type: 'Sick Leave', dates: 'Oct 29 (1 day)' },
            ].map((req, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-input bg-surface-muted border border-border gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-text">{req.employee}</p>
                  <p className="text-[11px] text-text-muted">
                    {req.type} &middot; {req.dates}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs min-h-[44px]">
                    Reject
                  </Button>
                  <Button variant="primary" size="sm" className="text-xs min-h-[44px]">
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Tasks Snapshot */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Active Sprint Tasks</h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
              {
                task: 'Refactor Auth session tokens',
                assignee: 'Alex Mercer',
                status: 'In Progress' as const,
              },
              {
                task: 'PostgreSQL migration for shifts',
                assignee: 'Kavita Nair',
                status: 'Completed' as const,
              },
              {
                task: 'Fix mobile drawer focus trap',
                assignee: 'Vikram Mehta',
                status: 'Blocked' as const,
              },
            ].map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-border"
              >
                <div>
                  <p className="font-semibold text-text">{t.task}</p>
                  <p className="text-[11px] text-text-muted">Assigned to: {t.assignee}</p>
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
