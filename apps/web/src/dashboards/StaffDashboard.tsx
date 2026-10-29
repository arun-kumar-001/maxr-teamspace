import { useState } from 'react';
import { Button, StatusPill } from '../components/ui';

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
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Staff Member Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Personal attendance, leave balance, sprint tasks, and payslips
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            My Profile
          </Button>
          <Button variant="primary" size="sm">
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Attendance & Shift Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${isCheckedIn ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`}
            />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Today's Attendance Session
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-slate-900">
            {isCheckedIn
              ? `Checked In \u00B7 Started at ${checkInTime}`
              : 'Not Checked In \u00B7 Shift Pending'}
          </p>
          <p className="text-xs text-slate-500">
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
        <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">
          My Leave Balances (2026)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-600">Annual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">14</p>
            <p className="mt-1 text-xs text-emerald-600 font-medium">14 of 18 days available</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-600">Sick Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">8</p>
            <p className="mt-1 text-xs text-blue-600 font-medium">8 of 10 days available</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-600">Casual Leave</p>
            <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">4</p>
            <p className="mt-1 text-xs text-amber-600 font-medium">4 of 6 days available</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Tasks & Payslip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tasks */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">My Current Tasks</h2>
          <div className="space-y-3">
            {[
              {
                title: 'Build responsive App Shell and Navigation',
                project: 'Global UI',
                status: 'In Progress' as const,
              },
              {
                title: 'Conduct 9-viewport responsive layout testing',
                project: 'Design System',
                status: 'To Do' as const,
              },
              {
                title: 'Update ADR documentation for monorepo layout',
                project: 'Architecture',
                status: 'Completed' as const,
              },
            ].map((task, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-slate-100"
              >
                <div>
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  <p className="text-[11px] text-slate-600">{task.project}</p>
                </div>
                <StatusPill status={task.status} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Payslips Snapshot */}
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Recent Payslips (Read-Only)</h2>
            <span className="text-xs text-blue-600 font-medium cursor-pointer hover:underline">
              View History
            </span>
          </div>

          <div className="space-y-3">
            {[
              { month: 'October 2026', ref: 'PAY-2026-10', status: 'Available' },
              { month: 'September 2026', ref: 'PAY-2026-09', status: 'Available' },
              { month: 'August 2026', ref: 'PAY-2026-08', status: 'Available' },
            ].map((slip, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-slate-100"
              >
                <div>
                  <p className="font-semibold text-slate-900">{slip.month}</p>
                  <p className="text-[11px] text-slate-500">{slip.ref}</p>
                </div>
                <Button variant="outline" size="sm" className="text-xs min-h-[36px]">
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
