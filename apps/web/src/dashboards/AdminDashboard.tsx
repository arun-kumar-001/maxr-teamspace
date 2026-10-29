import { Button, StatusPill } from '../components/ui';

export function AdminDashboard() {
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            System Administration Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Company-wide security, user governance, and infrastructure health
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Export Audit Log
          </Button>
          <Button variant="primary" size="sm">
            Add User
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Total Users
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">128</p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">100% active accounts</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Active Sessions
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">42</p>
          <p className="mt-1 text-xs text-blue-600 font-medium">Across all departments</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            System Health
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-emerald-600">99.98%</p>
          <p className="mt-1 text-xs text-slate-600">Database &amp; Redis normal</p>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Security Events
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">0</p>
          <p className="mt-1 text-xs text-emerald-600 font-medium">Zero anomalies detected</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution Card */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Role Distribution</h2>
          <div className="space-y-3">
            {[
              { role: 'Administrator', count: 3, pct: '2%' },
              { role: 'HR Manager', count: 6, pct: '5%' },
              { role: 'Team Lead', count: 18, pct: '14%' },
              { role: 'Staff Employee', count: 101, pct: '79%' },
            ].map((item) => (
              <div
                key={item.role}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100"
              >
                <span className="font-medium text-slate-900">{item.role}</span>
                <span className="font-semibold text-slate-600">
                  {item.count} users ({item.pct})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Snapshot */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Recent Security Audits</h2>
          <div className="space-y-3">
            {[
              {
                event: 'User Login: admin@maxr.com',
                time: '10 mins ago',
                status: 'Approved' as const,
              },
              {
                event: 'Role Updated: usr-042 to Team Lead',
                time: '1 hour ago',
                status: 'Approved' as const,
              },
              {
                event: 'Session Revocation: usr-019',
                time: '3 hours ago',
                status: 'Completed' as const,
              },
            ].map((log, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100"
              >
                <div>
                  <p className="font-medium text-slate-900">{log.event}</p>
                  <p className="text-[11px] text-slate-500">{log.time}</p>
                </div>
                <StatusPill status={log.status} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
