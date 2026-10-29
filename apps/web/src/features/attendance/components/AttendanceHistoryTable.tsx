import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { AttendanceApiClient, defaultAttendanceApi } from '../api/attendanceApi';
import { AttendanceRecord, AttendanceStatus } from '../types/attendance';

export interface AttendanceHistoryTableProps {
  api?: AttendanceApiClient;
  employeeId?: string;
  isStaffOnly?: boolean;
}

const statusBadgeClasses: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-800 border-amber-200',
  HALF_DAY: 'bg-blue-50 text-blue-800 border-blue-200',
  EARLY_DEPARTURE: 'bg-purple-50 text-purple-800 border-purple-200',
  ON_LEAVE: 'bg-slate-50 text-slate-700 border-slate-200',
};

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function AttendanceHistoryTable({
  api = defaultAttendanceApi,
  employeeId,
  isStaffOnly = true,
}: AttendanceHistoryTableProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        pageSize: 10,
        employeeId: isStaffOnly ? undefined : employeeId,
      };

      const res = isStaffOnly ? await api.getMyHistory(query) : await api.listAttendance(query);

      setRecords(res.data);
      const total = res.meta?.total ?? res.data.length;
      setTotalPages(Math.max(1, Math.ceil(total / 10)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance history');
    } finally {
      setLoading(false);
    }
  }, [api, isStaffOnly, employeeId, startDate, endDate, statusFilter, page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return (
    <div className="w-full space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text">Attendance History</h2>
          <p className="text-sm text-text-muted">
            {isStaffOnly
              ? 'View your complete personal attendance log and session durations.'
              : 'Audit and track attendance records and shift activity.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="att-start-date" className="block text-xs font-semibold text-text mb-1">
              Start Date
            </label>
            <input
              id="att-start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="att-end-date" className="block text-xs font-semibold text-text mb-1">
              End Date
            </label>
            <input
              id="att-end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="att-status" className="block text-xs font-semibold text-text mb-1">
              Status
            </label>
            <select
              id="att-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-xs text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="EARLY_DEPARTURE">Early Departure</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              size="md"
              className="w-full min-h-[44px]"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setStatusFilter('ALL');
                setPage(1);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Content States */}
      {loading ? (
        <div className="p-8 text-center text-text-muted animate-pulse" role="status">
          Loading attendance history...
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-card bg-red-50 border border-danger text-danger text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center rounded-card bg-surface border border-border">
          <p className="text-base font-medium text-text">No attendance records found</p>
          <p className="text-sm text-text-muted mt-1">
            No records match your selected date range or status filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card List */}
          <div
            className="grid grid-cols-1 gap-3 sm:hidden"
            role="list"
            aria-label="Attendance records"
          >
            {records.map((r) => (
              <div
                key={r.id}
                role="listitem"
                className="p-4 rounded-card bg-surface border border-border space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text text-sm">{r.workDate}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                      statusBadgeClasses[r.status] || 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {r.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-text-muted grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="font-medium text-text">Check-in:</span>{' '}
                    {new Date(r.checkInTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div>
                    <span className="font-medium text-text">Check-out:</span>{' '}
                    {r.checkOutTime
                      ? new Date(r.checkOutTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Active'}
                  </div>
                  <div>
                    <span className="font-medium text-text">Duration:</span>{' '}
                    {formatMinutes(r.durationMinutes)}
                  </div>
                  {r.location?.address && (
                    <div className="col-span-2 truncate">
                      <span className="font-medium text-text">Location:</span> {r.location.address}
                    </div>
                  )}
                  {r.notes && (
                    <div className="col-span-2 italic text-text bg-surface-muted p-1.5 rounded-input border border-border">
                      &quot;{r.notes}&quot;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm" aria-label="Attendance Records Table">
              <thead className="bg-surface-muted text-xs font-semibold text-text uppercase border-b border-border">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Work Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Check In
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Check Out
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Duration
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Location & Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-text">{r.workDate}</td>
                    <td className="px-4 py-3.5 text-text-muted text-xs font-mono">
                      {new Date(r.checkInTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3.5 text-text-muted text-xs font-mono">
                      {r.checkOutTime
                        ? new Date(r.checkOutTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'In Progress'}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-text text-xs">
                      {formatMinutes(r.durationMinutes)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                          statusBadgeClasses[r.status] ||
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-text-muted text-xs max-w-xs truncate">
                      {r.location?.address ? `${r.location.address} ` : ''}
                      {r.notes ? `(${r.notes})` : !r.location?.address ? '—' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-text-muted">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
