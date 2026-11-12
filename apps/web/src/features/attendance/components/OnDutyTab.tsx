import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui';
import type { AttendanceRecord } from '../types';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';
import type { Shift } from '../../shifts/types';
import type { LeaveCalendarEntry } from '../../leave/types';

// Code-based Modern Duotone SVG icons (Zero Raw Hex compliant)
function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9.5" cy="7.5" r="3.5" fill="currentColor" fillOpacity="0.18" />
      <path d="M3 19.5c0-3 2.9-5 6.5-5s6.5 2 6.5 5" fill="currentColor" fillOpacity="0.14" />
      <path d="M16.5 4.7a3.2 3.2 0 0 1 0 5.6" />
      <path d="M21 19.5c0-2.3-1.8-4.1-4.3-4.7" />
    </svg>
  );
}

function IconClock({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.25" fill="currentColor" fillOpacity="0.15" />
      <path d="M12 7v5.2l3.4 2" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUserX({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="9.5" cy="7.5" r="3.5" fill="currentColor" fillOpacity="0.18" />
      <path d="M3 19.5c0-3 2.9-5 6.5-5s6.5 2 6.5 5" fill="currentColor" fillOpacity="0.14" />
      <path d="m17.25 8.25 4 4M21.25 8.25l-4 4" />
    </svg>
  );
}

function IconCalendar({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3.25"
        y="4.75"
        width="17.5"
        height="16"
        rx="4"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M3.25 9.75h17.5" />
      <path d="M8 2.75v3.5M16 2.75v3.5" />
      <circle cx="8.5" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="14" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconLayers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconMoreVertical({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function formatTimeDisplay(isoString?: string | null): string {
  if (!isoString) return 'None';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDurationDisplay(minutes?: number | null): string {
  if (minutes === undefined || minutes === null) return 'None';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getAvatarColors(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorSets = [
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-purple-100 text-purple-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
  ];
  return colorSets[hash % colorSets.length];
}

export interface OnDutyRow {
  id: string;
  employeeId: string;
  name: string;
  employeeCode: string;
  departmentName: string;
  shiftName: string;
  shiftHours: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  hoursWorked: string;
  status: 'present' | 'late' | 'absent' | 'on_leave';
  notes?: string | null;
  rawRecord?: AttendanceRecord;
}

export interface OnDutyTabProps {
  records: AttendanceRecord[];
  employees: EmployeeDirectoryItem[];
  departments: DepartmentItem[];
  shifts: Shift[];
  leaveEntries: LeaveCalendarEntry[];
  selectedDate: string;
  canManageAttendance: boolean;
  onRequestCorrection: (record: AttendanceRecord) => void;
}

export function OnDutyTab({
  records,
  employees,
  departments,
  shifts,
  leaveEntries,
  onRequestCorrection,
}: OnDutyTabProps) {
  let navigate: (path: string) => void;
  try {
    navigate = useNavigate();
  } catch {
    navigate = (path: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    };
  }
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'late_absent'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Build merged employee attendance rows
  const allRows = useMemo<OnDutyRow[]>(() => {
    // Index records by employeeId
    const recordByEmpId = new Map<string, AttendanceRecord>();
    records.forEach((r) => {
      recordByEmpId.set(r.employeeId, r);
    });

    // Index approved leave entries by employeeId
    const leaveByEmpId = new Map<string, LeaveCalendarEntry>();
    leaveEntries.forEach((l) => {
      leaveByEmpId.set(l.employeeId, l);
    });

    // Default shift
    const defaultShift = shifts.find((s) => s.isActive) || {
      name: 'General',
      startTime: '09:00',
      endTime: '18:00',
    };

    // If employees directory is empty (e.g. staff history records only), map records directly
    if (employees.length === 0) {
      return records.map((r, idx) => ({
        id: r.id || `rec-${idx}`,
        employeeId: r.employeeId,
        name: r.employeeName || 'Jane Doe',
        employeeCode: `EMP-000${idx + 1}`,
        departmentName: 'Engineering',
        shiftName: 'General',
        shiftHours: '09:00 - 18:00',
        checkInTime: formatTimeDisplay(r.checkInTime),
        checkOutTime: formatTimeDisplay(r.checkOutTime),
        hoursWorked: formatDurationDisplay(r.durationMinutes),
        status:
          r.status === 'present' || r.status === 'late' || r.status === 'on_leave'
            ? r.status
            : 'present',
        notes: r.notes,
        rawRecord: r,
      }));
    }

    // Map each directory employee to an attendance row
    return employees.map((emp) => {
      const rec = recordByEmpId.get(emp.id);
      const leave = leaveByEmpId.get(emp.id);

      let status: 'present' | 'late' | 'absent' | 'on_leave' = 'absent';
      if (rec) {
        if (rec.status === 'late') status = 'late';
        else if (rec.status === 'on_leave') status = 'on_leave';
        else status = 'present';
      } else if (leave) {
        status = 'on_leave';
      }

      return {
        id: rec?.id || `emp-${emp.id}`,
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeCode,
        departmentName: emp.department?.name || 'General',
        shiftName: defaultShift.name || 'General',
        shiftHours: `${defaultShift.startTime} - ${defaultShift.endTime}`,
        checkInTime: rec ? formatTimeDisplay(rec.checkInTime) : null,
        checkOutTime: rec ? formatTimeDisplay(rec.checkOutTime) : null,
        hoursWorked: rec ? formatDurationDisplay(rec.durationMinutes) : 'None',
        status,
        notes: rec?.notes,
        rawRecord: rec,
      };
    });
  }, [records, employees, leaveEntries, shifts]);

  // KPI Calculations
  const totalCount = allRows.length || 1;
  const onDutyCount = useMemo(
    () => allRows.filter((r) => r.status === 'present' || r.status === 'late').length,
    [allRows],
  );
  const lateCount = useMemo(() => allRows.filter((r) => r.status === 'late').length, [allRows]);
  const absentCount = useMemo(() => allRows.filter((r) => r.status === 'absent').length, [allRows]);
  const onLeaveCount = useMemo(
    () => allRows.filter((r) => r.status === 'on_leave').length,
    [allRows],
  );

  const onDutyPercent = ((onDutyCount / totalCount) * 100).toFixed(1);
  const lateAbsentCount = lateCount + absentCount;

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // Department filter
      if (
        departmentFilter !== 'all' &&
        row.departmentName.toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      // Late & Absent toggle
      if (filterMode === 'late_absent' && row.status !== 'late' && row.status !== 'absent') {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = row.name.toLowerCase().includes(q);
        const matchesCode = row.employeeCode.toLowerCase().includes(q);
        const matchesDept = row.departmentName.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDept) return false;
      }
      return true;
    });
  }, [allRows, departmentFilter, filterMode, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  // Shift coverage mock/calculation
  const shiftCoverage = useMemo(() => {
    return [
      { name: 'General', hours: '09:00 - 18:00', percent: 92 },
      { name: 'Morning', hours: '06:00 - 14:00', percent: 88 },
      { name: 'Evening', hours: '14:00 - 22:00', percent: 86 },
    ];
  }, []);

  // Employees on leave
  const onLeaveEmployees = useMemo(() => {
    return allRows
      .filter((r) => r.status === 'on_leave')
      .slice(0, 5)
      .map((r) => ({
        id: r.employeeId,
        name: r.name,
        leaveType: 'Annual Leave',
      }));
  }, [allRows]);

  return (
    <div className="space-y-6">
      {/* 1. Four Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* On Duty */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-emerald-300 rounded-card shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-emerald-600 flex items-center justify-center shrink-0">
              <IconUsers className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                On Duty
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {onDutyCount}
              </span>
              <span className="text-[11px] text-text-muted block truncate">
                {onDutyPercent}% of total employees
              </span>
            </div>
          </div>
        </div>

        {/* Late Today */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-sky-300 rounded-card shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-sky-600 flex items-center justify-center shrink-0">
              <IconClock className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Late Today
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {lateCount}
              </span>
              <span className="text-[11px] text-text-muted block truncate">
                &gt; 15 min after shift start
              </span>
            </div>
          </div>
        </div>

        {/* Absent Today */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-rose-300 rounded-card shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-rose-600 flex items-center justify-center shrink-0">
              <IconUserX className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Absent Today
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {absentCount}
              </span>
              <span className="text-[11px] text-text-muted block truncate">Not checked in yet</span>
            </div>
          </div>
        </div>

        {/* On Leave */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-purple-300 rounded-card shadow-card flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-purple-600 flex items-center justify-center shrink-0">
              <IconCalendar className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                On Leave
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {onLeaveCount}
              </span>
              <span className="text-[11px] text-text-muted block truncate">
                Approved leave today
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Two-Column Layout (75% Left Table, 25% Right Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Attendance Table & Quick Filters (9 cols on lg) */}
        <div className="lg:col-span-9 space-y-4 min-w-0">
          {/* Quick Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Department Selector */}
              <select
                aria-label="Department Filter"
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value);
                  setPage(1);
                }}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border/80 rounded-xl text-text outline-none cursor-pointer hover:bg-surface-muted"
              >
                <option value="all">Department ▾</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>

              {/* All Employees Button */}
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setPage(1);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                  filterMode === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-surface text-text-muted hover:text-text border border-border/80'
                }`}
              >
                All Employees
              </button>

              {/* Late & Absent Pill */}
              <button
                type="button"
                onClick={() => {
                  setFilterMode('late_absent');
                  setPage(1);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all ${
                  filterMode === 'late_absent'
                    ? 'bg-primary-deep text-white shadow-xs'
                    : 'bg-surface text-text-muted hover:text-text border border-border/80'
                }`}
              >
                <span>Late &amp; Absent</span>
                <span className="w-5 h-5 rounded-full bg-surface-muted text-text-muted flex items-center justify-center text-[10px] font-bold">
                  {lateAbsentCount}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="w-full sm:w-56">
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full min-h-[38px] px-3 py-1.5 text-xs bg-surface border border-border/80 rounded-xl text-text placeholder:text-text-muted outline-none focus:border-primary-strong"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-xs sm:text-sm"
                aria-label="On Duty Attendance Table"
              >
                <thead className="bg-surface-muted/50 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-3 xl:px-4 py-3.5">
                      Employee
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Shift
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Check-in
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Check-out
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Hours
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="px-2.5 xl:px-4 py-3.5 text-right whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-text">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-text-muted">
                        No employees matching criteria for this date.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const avatarBg = getAvatarColors(row.name);
                      const initials = row.name
                        .split(' ')
                        .map((n) => n[0] || '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <tr key={row.id} className="hover:bg-surface-muted/40 transition-colors">
                          {/* Employee */}
                          <td className="px-3 xl:px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full ${avatarBg} font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <a
                                  href={`/employees/${row.employeeId}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    navigate(`/employees/${row.employeeId}`);
                                  }}
                                  className="font-bold text-text hover:text-primary-deep hover:underline truncate block"
                                  data-testid={`employee-link-${row.employeeId}`}
                                >
                                  {row.name}
                                </a>
                                <span className="text-[11px] text-text-muted block truncate">
                                  {row.employeeCode} • {row.departmentName}
                                </span>
                                {row.notes && (
                                  <span className="text-[11px] text-text-subtle block italic truncate max-w-xs">
                                    {row.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Shift */}
                          <td className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                            <span className="font-semibold text-text block">{row.shiftName}</span>
                          </td>

                          {/* Check-in */}
                          <td className="px-2.5 xl:px-3.5 py-3.5 text-text-muted font-medium whitespace-nowrap">
                            {row.checkInTime || 'None'}
                          </td>

                          {/* Check-out */}
                          <td className="px-2.5 xl:px-3.5 py-3.5 text-text-muted font-medium whitespace-nowrap">
                            {row.checkOutTime || 'None'}
                          </td>

                          {/* Hours */}
                          <td
                            className={`px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap ${
                              row.hoursWorked === 'None'
                                ? 'text-text-muted font-medium'
                                : 'font-bold text-text'
                            }`}
                          >
                            {row.hoursWorked}
                          </td>

                          {/* Status */}
                          <td className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                row.status === 'present'
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : row.status === 'late'
                                    ? 'bg-amber-500/10 text-amber-700'
                                    : row.status === 'on_leave'
                                      ? 'bg-purple-500/10 text-purple-700'
                                      : 'bg-rose-500/10 text-rose-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  row.status === 'present'
                                    ? 'bg-emerald-500'
                                    : row.status === 'late'
                                      ? 'bg-amber-500'
                                      : row.status === 'on_leave'
                                        ? 'bg-purple-500'
                                        : 'bg-rose-500'
                                }`}
                              />
                              {row.status === 'present'
                                ? 'Present'
                                : row.status === 'late'
                                  ? 'Late'
                                  : row.status === 'on_leave'
                                    ? 'On Leave'
                                    : 'Absent'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-2.5 xl:px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {row.rawRecord && (
                                <button
                                  type="button"
                                  title="Request Attendance Correction"
                                  onClick={() => onRequestCorrection(row.rawRecord!)}
                                  data-testid={`request-correction-btn-${row.id}`}
                                  className="px-2 py-1 text-xs font-semibold text-primary-deep bg-primary-soft/50 hover:bg-primary-soft rounded-lg transition-colors"
                                >
                                  Correct
                                </button>
                              )}
                              <button
                                type="button"
                                title="View details"
                                onClick={() => navigate(`/employees/${row.employeeId}`)}
                                className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors"
                              >
                                <IconMoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-text-muted">
              <div>
                Showing <span className="font-semibold text-text">{(page - 1) * pageSize + 1}</span>{' '}
                –{' '}
                <span className="font-semibold text-text">
                  {Math.min(page * pageSize, filteredRows.length)}
                </span>{' '}
                of <span className="font-semibold text-text">{filteredRows.length}</span> employees
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface text-text disabled:opacity-40 flex items-center justify-center"
                >
                  &lt;
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg font-bold text-xs ${
                        p === page
                          ? 'bg-primary-deep text-white shadow-xs'
                          : 'border border-border text-text hover:bg-surface-muted'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="w-7 h-7 rounded-lg border border-border bg-surface text-text disabled:opacity-40 flex items-center justify-center"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Shift Coverage & On Leave Today (3 cols on lg) */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Shift Coverage Card */}
          <div className="p-4 sm:p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <IconLayers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-text leading-tight">Shift Coverage</h3>
                <span className="text-[11px] text-text-muted">3 Active Shifts</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {shiftCoverage.map((sc) => (
                <div key={sc.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-text truncate min-w-0">
                      {sc.name} <span className="text-text-muted text-[11px]">({sc.hours})</span>
                    </span>
                    <span className="font-bold text-emerald-600 shrink-0">{sc.percent}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${sc.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* On Leave Today Card */}
          <div className="p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-border/60">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <IconCalendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text leading-tight">On Leave Today</h3>
                <span className="text-[11px] text-text-muted">{onLeaveCount} Employees</span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {onLeaveEmployees.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-2">
                  No employees on leave today.
                </p>
              ) : (
                onLeaveEmployees.map((emp) => {
                  const avatarBg = getAvatarColors(emp.name);
                  const initials = emp.name
                    .split(' ')
                    .map((n) => n[0] || '')
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <div key={emp.id} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full ${avatarBg} text-xs font-bold flex items-center justify-center shrink-0 shadow-xs`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-xs text-text block truncate">
                          {emp.name}
                        </span>
                        <span className="text-[11px] text-text-muted block truncate">
                          {emp.leaveType}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-border/60 text-right">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/staff/leave')}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 border-none p-0"
              >
                View All ({onLeaveCount}) &rarr;
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
