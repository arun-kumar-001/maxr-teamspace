import { Button, StatusPill } from '../components/ui';

export function TeamLeadDashboard() {
  return (
    <div className="space-y-6" data-testid="team-lead-dashboard">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Engineering Team Lead Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Own team attendance, leave approvals, and sprint task progress
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Team Shift Roster
          </Button>
          <Button variant="primary" size="sm">
            Assign Task
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Team Size</p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">12</p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">10 present today</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Pending Approvals
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-600">2</p>
          <p className="mt-1 text-xs text-amber-600 font-medium">Leave requests awaiting action</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Sprint Velocity
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-teal-600">88%</p>
          <p className="mt-1 text-xs text-slate-600">Tasks completed on track</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Blocked Issues
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-red-600">1</p>
          <p className="mt-1 text-xs text-red-600 font-medium">Needs dependency clearance</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Widget */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Pending Leave Approvals</h2>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
              2 Actions
            </span>
          </div>

          <div className="space-y-3">
            {[
              { employee: 'Alex Mercer', type: 'Annual Leave', dates: 'Nov 02 - Nov 04 (3 days)' },
              { employee: 'Kavita Nair', type: 'Sick Leave', dates: 'Oct 29 (1 day)' },
            ].map((req, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{req.employee}</p>
                  <p className="text-[11px] text-slate-600">
                    {req.type} &middot; {req.dates}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="text-xs min-h-[36px]">
                    Reject
                  </Button>
                  <Button variant="primary" size="sm" className="text-xs min-h-[36px]">
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Tasks Snapshot */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Active Sprint Tasks</h2>
          <div className="space-y-3">
            {[
              {
                task: 'Implement check-in geolocation validation',
                owner: 'Alex M.',
                status: 'In Progress' as const,
              },
              {
                task: 'Audit log pagination API optimization',
                owner: 'Kavita N.',
                status: 'In Review' as const,
              },
              {
                task: 'Cantobo file storage adapter integration',
                owner: 'Dev Team',
                status: 'Blocked' as const,
              },
              {
                task: 'Responsive breakpoint verification',
                owner: 'Venkat B.',
                status: 'Completed' as const,
              },
            ].map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-slate-100"
              >
                <div>
                  <p className="font-semibold text-slate-900">{t.task}</p>
                  <p className="text-[11px] text-slate-600">Assignee: {t.owner}</p>
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
