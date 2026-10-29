import { Button, StatusPill } from '../components/ui';

export function HRDashboard() {
  return (
    <div className="space-y-6" data-testid="hr-dashboard">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">HR Management Overview</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Workforce headcount, onboarding pipeline, and leave policy status
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Workforce Report
          </Button>
          <Button variant="primary" size="sm">
            Onboard Employee
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Total Headcount
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">124</p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">+4 new this month</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Onboarding Pipeline
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">3</p>
          <p className="mt-1 text-xs text-slate-600">Pending 4-step checklist</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            On Leave Today
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-blue-600">6</p>
          <p className="mt-1 text-xs text-slate-600">Approved leaves</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Retention Rate
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">98.2%</p>
          <p className="mt-1 text-xs text-slate-600">YTD workforce health</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding Checklist Summary (4-step per AGENTS.md §9) */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            4-Step Onboarding Pipeline (AGENTS.md §9)
          </h2>
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
                className="flex items-center justify-between text-xs py-2 border-b border-slate-100"
              >
                <div>
                  <p className="font-semibold text-slate-900">{candidate.candidate}</p>
                  <p className="text-[11px] text-slate-600">
                    {candidate.role} &middot; {candidate.step}
                  </p>
                </div>
                <StatusPill status={candidate.status} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Department Distribution</h2>
          <div className="space-y-3">
            {[
              { dept: 'Engineering', count: 68 },
              { dept: 'Product & Design', count: 24 },
              { dept: 'Operations & Finance', count: 18 },
              { dept: 'People & HR', count: 8 },
              { dept: 'Marketing', count: 6 },
            ].map((d) => (
              <div
                key={d.dept}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100"
              >
                <span className="font-medium text-slate-900">{d.dept}</span>
                <span className="font-semibold text-slate-600">{d.count} staff</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
