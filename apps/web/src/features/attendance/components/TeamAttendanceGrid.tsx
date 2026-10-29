import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { AttendanceApiClient, defaultAttendanceApi } from '../api/attendanceApi';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

export interface TeamMemberStatus {
  employeeId: string;
  name: string;
  department?: string;
  record?: AttendanceRecord;
}

export interface TeamAttendanceGridProps {
  api?: AttendanceApiClient;
  teamMembers?: { id: string; name: string; department?: string }[];
  workDate?: string;
}

const statusBadgeClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-800 border-amber-200',
  HALF_DAY: 'bg-blue-50 text-blue-800 border-blue-200',
  EARLY_DEPARTURE: 'bg-purple-50 text-purple-800 border-purple-200',
  ON_LEAVE: 'bg-slate-50 text-slate-700 border-slate-200',
};

const defaultSampleTeam = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Alex Johnson', department: 'Engineering' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Sam Rivera', department: 'Engineering' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Taylor Chen', department: 'Design' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Jordan Smith', department: 'Product' },
];

export function TeamAttendanceGrid({
  api = defaultAttendanceApi,
  teamMembers = defaultSampleTeam,
  workDate = new Date().toISOString().slice(0, 10),
}: TeamAttendanceGridProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(workDate);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listAttendance({
        startDate: selectedDate,
        endDate: selectedDate,
      });
      setRecords(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team attendance');
    } finally {
      setLoading(false);
    }
  }, [api, selectedDate]);

  useEffect(() => {
    fetchTeamAttendance();
  }, [fetchTeamAttendance]);

  // Aggregate stats
  const memberStatuses: TeamMemberStatus[] = teamMembers.map((m) => {
    const rec = records.find((r) => r.employeeId === m.id && r.workDate === selectedDate);
    return {
      employeeId: m.id,
      name: m.name,
      department: m.department,
      record: rec,
    };
  });

  const presentCount = memberStatuses.filter(
    (m) => m.record && m.record.status === 'PRESENT',
  ).length;
  const lateCount = memberStatuses.filter((m) => m.record && m.record.status === 'LATE').length;
  const onLeaveCount = memberStatuses.filter(
    (m) => m.record && m.record.status === 'ON_LEAVE',
  ).length;
  const absentCount = memberStatuses.filter((m) => !m.record).length;

  return (
    <div className="w-full space-y-6">
      {/* Header & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text">Team Attendance Grid</h2>
          <p className="text-sm text-text-muted">
            Daily roster overview for Team Leads and HR managers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="team-grid-date"
            className="text-xs font-semibold text-text whitespace-nowrap"
          >
            Selected Date:
          </label>
          <input
            id="team-grid-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-1.5 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Summary KPI Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-card bg-surface border border-border">
          <p className="text-xs font-medium text-text-muted uppercase">Present</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{presentCount}</p>
        </div>
        <div className="p-4 rounded-card bg-surface border border-border">
          <p className="text-xs font-medium text-text-muted uppercase">Late</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{lateCount}</p>
        </div>
        <div className="p-4 rounded-card bg-surface border border-border">
          <p className="text-xs font-medium text-text-muted uppercase">On Leave</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{onLeaveCount}</p>
        </div>
        <div className="p-4 rounded-card bg-surface border border-border">
          <p className="text-xs font-medium text-text-muted uppercase">Not Checked In</p>
          <p className="text-2xl font-bold text-slate-500 mt-1">{absentCount}</p>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="p-8 text-center text-text-muted animate-pulse" role="status">
          Loading team roster attendance...
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-card bg-red-50 border border-danger text-danger text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm" aria-label="Team Attendance Roster">
            <thead className="bg-surface-muted text-xs font-semibold text-text uppercase border-b border-border">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Team Member
                </th>
                <th scope="col" className="px-4 py-3">
                  Department
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3">
                  Check In
                </th>
                <th scope="col" className="px-4 py-3">
                  Check Out
                </th>
                <th scope="col" className="px-4 py-3">
                  Session Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {memberStatuses.map((m) => (
                <tr key={m.employeeId} className="hover:bg-surface-muted/50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-text">
                    {m.name}
                    <div className="text-xs text-text-muted font-mono font-normal">
                      {m.employeeId.slice(0, 8)}...
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-text-muted">
                    {m.department || 'General'}
                  </td>
                  <td className="px-4 py-3.5">
                    {m.record ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                          statusBadgeClasses[m.record.status] ||
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {m.record.status.replace('_', ' ')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Not Checked In
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-text-muted">
                    {m.record
                      ? new Date(m.record.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-text-muted">
                    {m.record?.checkOutTime
                      ? new Date(m.record.checkOutTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : m.record
                        ? 'In Progress'
                        : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-text-muted max-w-xs truncate">
                    {m.record?.notes ||
                      (m.record?.location?.address ? `At: ${m.record.location.address}` : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
