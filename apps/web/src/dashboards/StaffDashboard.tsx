import { useState } from 'react';
import { Button, Badge, StatusPill } from '../components/ui';

export function StaffDashboard() {
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [checkInTime, setCheckInTime] = useState('09:15 AM');

  const handleToggleAttendance = () => {
    if (isCheckedIn) {
      setIsCheckedIn(false);
    } else {
      setIsCheckedIn(true);
      const now = new Date();
      setCheckInTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  };

  return (
    <div className="space-y-6" data-testid="staff-dashboard">
      {/* Top Welcome Banner with Sample Data Badge (B2 Fix) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Staff Member Dashboard
            </h1>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Personal attendance, leave balance, sprint tasks, and payslips
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]">
            My Profile
          </Button>
          <Button variant="primary" size="sm" className="min-h-[44px]">
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Attendance & Shift Card */}
      <div className="p-6 bg-surface border border-border rounded-card shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${isCheckedIn ? 'bg-positive-ink animate-pulse ring-4 ring-positive-soft' : 'bg-text-subtle'}`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Today's Attendance Session
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-text font-display">
            {isCheckedIn
              ? `Checked In \u00B7 Started at ${checkInTime}`
              : 'Not Checked In \u00B7 Shift Pending'}
          </p>
          <p className="text-xs text-text-muted">
            Regular Shift: 09:00 AM &ndash; 06:00 PM (IST) &middot; Working from Office
          </p>
        </div>

        <div>
          <Button
            variant={isCheckedIn ? 'danger' : 'primary'}
            size="lg"
            onClick={handleToggleAttendance}
            className="w-full sm:w-auto min-h-[48px] px-6 text-sm font-bold shadow-sm"
            data-testid="attendance-toggle-button"
          >
            {isCheckedIn ? 'Check Out for Today' : 'Check In Now'}
          </Button>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
            My Leave Balances (2026)
          </h2>
          <Badge variant="neutral">Sample data</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Annual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">14</p>
            <p className="mt-1 text-xs text-positive-ink font-medium">14 of 18 days available</p>
          </div>

          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Sick Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">8</p>
            <p className="mt-1 text-xs text-primary-ink font-medium">8 of 10 days available</p>
          </div>

          <div className="p-5 bg-surface border border-border rounded-card shadow-card">
            <p className="text-xs font-semibold text-text-muted">Casual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">4</p>
            <p className="mt-1 text-xs text-warning font-medium">4 of 6 days available</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Tasks & Payslip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text font-display">Assigned Tasks</h2>
            <Badge variant="neutral">Sample data</Badge>
          </div>
          <div className="space-y-3">
            {[
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
                className="flex items-center justify-between text-xs py-2 border-b border-border"
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
            <Badge variant="neutral">Sample data</Badge>
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
