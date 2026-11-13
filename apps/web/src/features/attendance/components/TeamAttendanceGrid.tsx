import type { AttendanceRecord } from '../types';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

export interface TeamAttendanceGridProps {
  records: AttendanceRecord[];
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '\u2014';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function TeamAttendanceGrid({ records }: TeamAttendanceGridProps) {
  if (records.length === 0) {
    return (
      <div
        className="p-8 text-center bg-surface border border-border rounded-card"
        data-testid="team-grid-empty"
      >
        <p className="text-sm font-semibold text-text">No team attendance records found</p>
        <p className="text-xs text-text-muted mt-1">
          No team members have recorded attendance matching the current filters.
        </p>
      </div>
    );
  }

  return (
    <div
      className="bg-white border border-border/80 rounded-card shadow-xs overflow-hidden"
      data-testid="team-attendance-grid"
    >
      {/* Desktop & Tablet Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-text-muted">
              <th className="p-3 font-semibold">Employee</th>
              <th className="p-3 font-semibold">Date</th>
              <th className="p-3 font-semibold">Check-In</th>
              <th className="p-3 font-semibold">Check-Out</th>
              <th className="p-3 font-semibold">Duration</th>
              <th className="p-3 font-semibold">Mode</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-surface-muted/30 transition-colors">
                <td className="p-3 font-medium text-text">
                  {r.employeeName ?? r.employeeId.slice(0, 8)}
                </td>
                <td className="p-3 text-text-muted">{r.workDate}</td>
                <td className="p-3 text-text">{formatTime(r.checkInTime)}</td>
                <td className="p-3 text-text-muted">{formatTime(r.checkOutTime)}</td>
                <td className="p-3 text-text-muted">
                  {r.durationMinutes !== null
                    ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}m`
                    : '\u2014'}
                </td>
                <td className="p-3 capitalize text-text-muted">
                  {r.location?.workMode ?? 'Office'}
                </td>
                <td className="p-3">
                  <AttendanceStatusBadge status={r.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (< 640px) */}
      <div className="sm:hidden divide-y divide-border" data-testid="team-grid-mobile-cards">
        {records.map((r) => (
          <div key={r.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-text">
                {r.employeeName ?? r.employeeId.slice(0, 8)}
              </span>
              <AttendanceStatusBadge status={r.status} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
              <div>
                <span className="font-medium text-text-subtle">Date: </span>
                {r.workDate}
              </div>
              <div>
                <span className="font-medium text-text-subtle">Mode: </span>
                <span className="capitalize">{r.location?.workMode ?? 'Office'}</span>
              </div>
              <div>
                <span className="font-medium text-text-subtle">In: </span>
                {formatTime(r.checkInTime)}
              </div>
              <div>
                <span className="font-medium text-text-subtle">Out: </span>
                {formatTime(r.checkOutTime)}
              </div>
            </div>

            {r.durationMinutes !== null && (
              <p className="text-xs text-positive-ink font-medium">
                Duration: {Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
