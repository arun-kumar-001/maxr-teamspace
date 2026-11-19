import { Button, Badge, StatusPill, KpiCard } from '../components/ui';

function UsersIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClockIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function VelocityIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function AlertIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function TeamLeadDashboard() {
  return (
    <div className="space-y-6 w-full min-w-0" data-testid="team-lead-dashboard">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KpiCard
          label="Team Size"
          value="12"
          icon={<UsersIcon />}
          badge="10 present today"
          variant="teal"
        />
        <KpiCard
          label="Pending Approvals"
          value="2"
          icon={<ClockIcon />}
          badge="Awaiting action"
          variant="amber"
        />
        <KpiCard
          label="Sprint Velocity"
          value="88%"
          icon={<VelocityIcon />}
          badge="On track"
          variant="emerald"
        />
        <KpiCard
          label="Blocked Issues"
          value="1"
          icon={<AlertIcon />}
          badge="Needs clearance"
          variant="rose"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Widget */}
        <div className="p-6 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card transition-all space-y-4">
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
        <div className="p-6 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card transition-all space-y-4">
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
