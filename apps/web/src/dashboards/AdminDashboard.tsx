import { Button, Badge } from '../components/ui';

export function AdminDashboard() {
  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      {/* Top Banner with Sample Data Badge (B2 Fix) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              System Administration Dashboard
            </h1>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Company-wide security, user governance, and infrastructure health
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]">
            Export Audit Log
          </Button>
          <Button variant="primary" size="sm" className="min-h-[44px]">
            Add User
          </Button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Total Users
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">128</p>
          <p className="mt-1 text-xs text-positive-ink font-medium">100% active accounts</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Active Sessions
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">42</p>
          <p className="mt-1 text-xs text-primary-ink font-medium">Across all departments</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            System Health
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-positive-ink font-display">
            99.98%
          </p>
          <p className="mt-1 text-xs text-text-muted">Database &amp; Redis normal</p>
        </div>

        <div className="p-5 bg-surface border border-border rounded-card shadow-card">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Security Events
          </p>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">0</p>
          <p className="mt-1 text-xs text-positive-ink font-medium">Zero anomalies detected</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role Distribution Card */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Role Distribution</h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
              { role: 'Administrator', count: 3, pct: '2%' },
              { role: 'HR Manager', count: 6, pct: '5%' },
              { role: 'Team Lead', count: 18, pct: '14%' },
              { role: 'Staff Employee', count: 101, pct: '79%' },
            ].map((item) => (
              <div
                key={item.role}
                className="flex items-center justify-between text-xs py-2 border-b border-border"
              >
                <span className="font-medium text-text">{item.role}</span>
                <span className="font-semibold text-text-muted">
                  {item.count} users ({item.pct})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Snapshot */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Recent Security Audits</h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
              {
                event: 'User Login: admin@maxr.com',
                time: '10 mins ago',
              },
              {
                event: 'Role Updated: usr-042 to Team Lead',
                time: '1 hour ago',
              },
              {
                event: 'Session Revocation: usr-089 signed out',
                time: '3 hours ago',
              },
            ].map((audit, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-border"
              >
                <div>
                  <p className="font-semibold text-text">{audit.event}</p>
                  <p className="text-[11px] text-text-muted">{audit.time}</p>
                </div>
                <span className="text-[11px] font-medium text-positive-ink bg-positive-soft px-2 py-0.5 rounded-full">
                  Logged
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
