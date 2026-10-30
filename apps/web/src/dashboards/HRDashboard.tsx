import { Button, Badge, StatusPill } from '../components/ui';

export function HRDashboard() {
  return (
    <div className="space-y-6" data-testid="hr-dashboard">
      {/* Top Banner with Sample Data Badge (B2 Fix) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              HR Management Overview
            </h1>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Workforce headcount, onboarding pipeline, and leave policy status
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]">
            Workforce Report
          </Button>
          <Button variant="primary" size="sm" className="min-h-[44px]">
            Onboard Employee
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Total Headcount
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">124</p>
          <p className="mt-1 text-xs text-positive-ink font-medium">+4 new this month</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Onboarding Pipeline
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-warning font-display">3</p>
          <p className="mt-1 text-xs text-text-muted">Pending 4-step checklist</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            On Leave Today
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-primary-ink font-display">
            6
          </p>
          <p className="mt-1 text-xs text-text-muted">Approved leaves</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Retention Rate
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-positive-ink font-display">
            98.2%
          </p>
          <p className="mt-1 text-xs text-text-muted">YTD workforce health</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding Checklist Summary (4-step per AGENTS.md §9) */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">
              4-Step Onboarding Pipeline (AGENTS.md §9)
            </h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
              {
                candidate: 'Rohan Sharma',
                role: 'Frontend Engineer',
                step: 'Step 3: IT/Admin Provisioning',
                status: 'In Progress' as const,
              },
              {
                candidate: 'Priya Patel',
                role: 'Product Designer',
                step: 'Step 2: System Account Setup',
                status: 'In Progress' as const,
              },
              {
                candidate: 'Vikram Mehta',
                role: 'DevOps Lead',
                step: 'Step 4: Employee Document Signing',
                status: 'In Review' as const,
              },
            ].map((candidate, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-border"
              >
                <div>
                  <p className="font-semibold text-text">{candidate.candidate}</p>
                  <p className="text-[11px] text-text-muted">
                    {candidate.role} &middot; {candidate.step}
                  </p>
                </div>
                <StatusPill status={candidate.status} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Department Distribution</h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Engineering', count: 62, budget: 'On track' },
              { name: 'Product & Design', count: 18, budget: 'On track' },
              { name: 'Human Resources', count: 12, budget: 'Optimal' },
              { name: 'Operations & Support', count: 32, budget: 'On track' },
            ].map((dept) => (
              <div
                key={dept.name}
                className="flex items-center justify-between text-xs py-2 border-b border-border"
              >
                <div>
                  <p className="font-semibold text-text">{dept.name}</p>
                  <p className="text-[11px] text-text-muted">{dept.count} team members</p>
                </div>
                <span className="text-[11px] font-medium text-positive-ink bg-positive-soft px-2 py-0.5 rounded-full">
                  {dept.budget}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
