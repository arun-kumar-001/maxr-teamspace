import { useState, useMemo } from 'react';
import type { AttendanceRecord, AttendanceBreak } from '../types';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';

export interface CompanyCheckInOutTabProps {
  records: AttendanceRecord[];
  employees: EmployeeDirectoryItem[];
  departments: DepartmentItem[];
  selectedDate: string;
  onRequestCorrection?: (record: AttendanceRecord) => void;
}

interface EmployeeSessionRow {
  employee: EmployeeDirectoryItem;
  fullName: string;
  record: AttendanceRecord | null;
  status: 'checked_in' | 'on_break' | 'checked_out' | 'not_checked_in';
  checkInTimeFormatted: string;
  checkOutTimeFormatted: string;
  durationFormatted: string;
  breakSummary: string;
  isOnBreak: boolean;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  checkInAddress: string;
  checkOutAddress: string;
}

// ---------------------------------------------------------------------------
// Clean Design-System SVG Icons (Zero Emojis)
// ---------------------------------------------------------------------------

function IconSearch({ className = 'w-4 h-4' }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function IconMapPin({ className = 'w-3.5 h-3.5' }: { className?: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconUserCheck({ className = 'w-7 h-7' }: { className?: string }) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconCoffee({ className = 'w-7 h-7' }: { className?: string }) {
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
      <path d="M10 2v2" />
      <path d="M14 2v2" />
      <path d="M6 2v2" />
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
    </svg>
  );
}

function IconLogOut({ className = 'w-7 h-7' }: { className?: string }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconHourglass({ className = 'w-7 h-7' }: { className?: string }) {
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
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '0h 00m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyCheckInOutTab({
  records,
  employees,
  departments,
  selectedDate,
  onRequestCorrection,
}: CompanyCheckInOutTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'checked_in' | 'on_break' | 'checked_out' | 'not_checked_in'
  >('all');
  const [previewPhoto, setPreviewPhoto] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const [selectedSessionRow, setSelectedSessionRow] = useState<EmployeeSessionRow | null>(null);

  // Map employee with their latest record for selectedDate
  const sessionRows = useMemo<EmployeeSessionRow[]>(() => {
    const recordByEmpId = new Map<string, AttendanceRecord>();
    for (const rec of records) {
      if (!recordByEmpId.has(rec.employeeId)) {
        recordByEmpId.set(rec.employeeId, rec);
      }
    }

    return employees.map((emp) => {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      const rec = recordByEmpId.get(emp.id) || null;

      if (!rec) {
        return {
          employee: emp,
          fullName,
          record: null,
          status: 'not_checked_in',
          checkInTimeFormatted: '--:--',
          checkOutTimeFormatted: '--:--',
          durationFormatted: '0h 00m',
          breakSummary: 'None',
          isOnBreak: false,
          checkInPhoto: null,
          checkOutPhoto: null,
          checkInAddress: 'Not Checked In',
          checkOutAddress: '--',
        };
      }

      const isOnBreak = Boolean(rec.breaks?.some((b: AttendanceBreak) => b.endTime === null));
      let status: 'checked_in' | 'on_break' | 'checked_out' | 'not_checked_in' = 'checked_in';

      if (rec.checkOutTime) {
        status = 'checked_out';
      } else if (isOnBreak) {
        status = 'on_break';
      } else {
        status = 'checked_in';
      }

      // Calculate breaks
      const breaksList = rec.breaks || [];
      const totalBreakMins =
        rec.breakMinutes ??
        breaksList.reduce((acc, b) => {
          if (b.startTime && b.endTime) {
            const diff = Math.max(
              0,
              (new Date(b.endTime).getTime() - new Date(b.startTime).getTime()) / 60000,
            );
            return acc + diff;
          }
          return acc;
        }, 0);

      const breakSummary =
        breaksList.length > 0
          ? `${breaksList.length} break${breaksList.length > 1 ? 's' : ''} (${Math.round(totalBreakMins)}m)`
          : 'None';

      const checkInAddr =
        rec.location?.address ||
        (rec.location?.latitude && rec.location?.longitude
          ? `${rec.location.latitude.toFixed(4)}, ${rec.location.longitude.toFixed(4)}`
          : 'Location not tagged');
      const checkOutAddr =
        rec.checkOutLocation?.address ||
        (rec.checkOutLocation?.latitude && rec.checkOutLocation?.longitude
          ? `${rec.checkOutLocation.latitude.toFixed(4)}, ${rec.checkOutLocation.longitude.toFixed(4)}`
          : rec.checkOutTime
            ? 'Location not tagged'
            : '--');

      return {
        employee: emp,
        fullName,
        record: rec,
        status,
        checkInTimeFormatted: formatTime(rec.checkInTime),
        checkOutTimeFormatted: formatTime(rec.checkOutTime),
        durationFormatted: formatMinutes(rec.durationMinutes),
        breakSummary,
        isOnBreak,
        checkInPhoto: rec.checkInPhoto || null,
        checkOutPhoto: rec.checkOutPhoto || null,
        checkInAddress: checkInAddr,
        checkOutAddress: checkOutAddr,
      };
    });
  }, [records, employees]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return sessionRows.filter((row) => {
      // 1. Department filter
      if (departmentFilter !== 'all') {
        const deptId = row.employee.department?.id || row.employee.department?.name;
        if (deptId !== departmentFilter && row.employee.department?.name !== departmentFilter) {
          return false;
        }
      }

      // 2. Status filter
      if (statusFilter !== 'all') {
        if (row.status !== statusFilter) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = row.fullName.toLowerCase().includes(q);
        const codeMatch = (row.employee.employeeCode || '').toLowerCase().includes(q);
        const deptMatch = (row.employee.department?.name || '').toLowerCase().includes(q);
        const desigMatch = (row.employee.designation?.title || '').toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !deptMatch && !desigMatch) return false;
      }

      return true;
    });
  }, [sessionRows, departmentFilter, statusFilter, searchQuery]);

  // High-level Metrics for Admin
  const kpiStats = useMemo(() => {
    const total = sessionRows.length;
    let checkedIn = 0;
    let onBreak = 0;
    let checkedOut = 0;
    let notCheckedIn = 0;

    for (const r of sessionRows) {
      if (r.status === 'checked_in') checkedIn++;
      else if (r.status === 'on_break') onBreak++;
      else if (r.status === 'checked_out') checkedOut++;
      else notCheckedIn++;
    }

    return { total, checkedIn, onBreak, checkedOut, notCheckedIn };
  }, [sessionRows]);

  return (
    <div className="space-y-6" data-testid="company-checkin-checkout-tab">
      {/* 1. Admin KPI Summary Cards - Styled cleanly matching Admin Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Currently Checked In */}
        <div
          onClick={() => setStatusFilter('checked_in')}
          className="p-4 sm:p-4.5 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <IconUserCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Currently Checked In
              </span>
              <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
                {kpiStats.checkedIn}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full block whitespace-nowrap">
              Active Now
            </span>
          </div>
        </div>

        {/* Card 2: Taking Break */}
        <div
          onClick={() => setStatusFilter('on_break')}
          className="p-4 sm:p-4.5 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IconCoffee className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Taking Break
              </span>
              <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
                {kpiStats.onBreak}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full block whitespace-nowrap">
              Paused
            </span>
          </div>
        </div>

        {/* Card 3: Completed Shift */}
        <div
          onClick={() => setStatusFilter('checked_out')}
          className="p-4 sm:p-4.5 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <IconLogOut className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Completed Shift
              </span>
              <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
                {kpiStats.checkedOut}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs text-teal-800 font-semibold bg-teal-50 px-2 py-0.5 rounded-full block whitespace-nowrap">
              Checked Out
            </span>
          </div>
        </div>

        {/* Card 4: Not Checked In */}
        <div
          onClick={() => setStatusFilter('not_checked_in')}
          className="p-4 sm:p-4.5 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3 min-w-0 cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <IconHourglass className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Not Checked In
              </span>
              <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
                {kpiStats.notCheckedIn}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[11px] sm:text-xs text-text-subtle font-medium block whitespace-nowrap">
              {kpiStats.notCheckedIn} pending
            </span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="p-4 rounded-card bg-white border border-border/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface-muted/60 rounded-xl">
            {(
              [
                { id: 'all', label: `All (${sessionRows.length})` },
                { id: 'checked_in', label: `Checked In (${kpiStats.checkedIn})` },
                { id: 'on_break', label: `On Break (${kpiStats.onBreak})` },
                { id: 'checked_out', label: `Checked Out (${kpiStats.checkedOut})` },
                { id: 'not_checked_in', label: `Not Checked In (${kpiStats.notCheckedIn})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white text-text shadow-xs font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Department Selector with clean SVG search icon */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-56 text-xs px-3 py-1.5 pl-8 rounded-lg bg-white border border-border/80 text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-strong shadow-xs"
              />
              <span className="absolute left-2.5 top-2 text-text-muted flex items-center justify-center">
                <IconSearch className="w-3.5 h-3.5" />
              </span>
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-border/80 text-text focus:outline-none focus:ring-2 focus:ring-primary-strong cursor-pointer shadow-xs"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Company-wide Check-In / Check-Out Table */}
      <div className="rounded-card bg-white border border-border/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-text">
              Employee Sessions &middot; {selectedDate}
            </h2>
            <p className="text-xs text-text-muted">
              Showing {filteredRows.length} employee attendance session
              {filteredRows.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-muted/60 text-text-muted border-b border-border text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Breaks</th>
                <th className="py-3 px-4">Logged Hours</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted">
                    No employee check-in/out records found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-surface-muted/40 transition-colors">
                    {/* Employee Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-soft text-primary-deep font-bold flex items-center justify-center shrink-0 border border-primary-strong/20">
                          {row.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-text text-sm">{row.fullName}</p>
                          <p className="text-[11px] text-text-muted">
                            {row.employee.employeeCode || row.employee.id.slice(0, 8)} &middot;{' '}
                            {row.employee.department?.name || 'General'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4">
                      {row.status === 'checked_in' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Checked In
                        </span>
                      )}
                      {row.status === 'on_break' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          On Break
                        </span>
                      )}
                      {row.status === 'checked_out' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                          Checked Out
                        </span>
                      )}
                      {row.status === 'not_checked_in' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-muted border border-border">
                          Not Checked In
                        </span>
                      )}
                    </td>

                    {/* Check-In Details with Photo & Street Address */}
                    <td className="py-3.5 px-4">
                      {row.record ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text text-xs">
                              {row.checkInTimeFormatted}
                            </span>
                            {row.checkInPhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: row.checkInPhoto!,
                                    title: `${row.fullName} – Check-In Selfie`,
                                    subtitle: `Recorded at ${row.checkInTimeFormatted} &middot; ${row.checkInAddress}`,
                                  })
                                }
                                className="group relative"
                                title="View Check-In Photo"
                              >
                                <img
                                  src={row.checkInPhoto}
                                  alt="Selfie"
                                  className="w-6 h-6 rounded-md object-cover border border-primary-strong/40 shadow-2xs group-hover:scale-110 transition-transform cursor-pointer"
                                />
                              </button>
                            )}
                          </div>
                          <div
                            className="flex items-center gap-1 text-[11px] text-text-muted max-w-[200px] truncate"
                            title={row.checkInAddress}
                          >
                            <IconMapPin className="w-3 h-3 text-text-muted shrink-0" />
                            <span className="truncate">{row.checkInAddress}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-subtle text-xs">--</span>
                      )}
                    </td>

                    {/* Check-Out Details with Photo & Street Address */}
                    <td className="py-3.5 px-4">
                      {row.record?.checkOutTime ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text text-xs">
                              {row.checkOutTimeFormatted}
                            </span>
                            {row.checkOutPhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: row.checkOutPhoto!,
                                    title: `${row.fullName} – Check-Out Selfie`,
                                    subtitle: `Recorded at ${row.checkOutTimeFormatted} &middot; ${row.checkOutAddress}`,
                                  })
                                }
                                className="group relative"
                                title="View Check-Out Photo"
                              >
                                <img
                                  src={row.checkOutPhoto}
                                  alt="Check-Out Selfie"
                                  className="w-6 h-6 rounded-md object-cover border border-teal-600/40 shadow-2xs group-hover:scale-110 transition-transform cursor-pointer"
                                />
                              </button>
                            )}
                          </div>
                          <div
                            className="flex items-center gap-1 text-[11px] text-text-muted max-w-[200px] truncate"
                            title={row.checkOutAddress}
                          >
                            <IconMapPin className="w-3 h-3 text-text-muted shrink-0" />
                            <span className="truncate">{row.checkOutAddress}</span>
                          </div>
                        </div>
                      ) : row.record ? (
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-text-subtle text-xs">--</span>
                      )}
                    </td>

                    {/* Breaks */}
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-text">{row.breakSummary}</span>
                    </td>

                    {/* Total Duration - Standard Sans Font, No Font-Mono */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-text text-xs sm:text-sm">
                        {row.durationFormatted}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {row.record ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionRow(row)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface-muted hover:bg-surface-raised border border-border text-text transition-colors cursor-pointer"
                          >
                            Details
                          </button>
                          {onRequestCorrection && (
                            <button
                              type="button"
                              onClick={() => onRequestCorrection(row.record!)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              Correct
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-subtle text-[11px]">No session</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Photo Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="bg-surface rounded-card p-5 max-w-md w-full shadow-2xl border border-border space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-text text-base">{previewPhoto.title}</h3>
                {previewPhoto.subtitle && (
                  <p className="text-xs text-text-muted mt-0.5">{previewPhoto.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="text-text-muted hover:text-text font-bold text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black/90 flex items-center justify-center max-h-[360px]">
              <img
                src={previewPhoto.url}
                alt="Captured Selfie"
                className="max-h-[360px] w-auto object-contain"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-2 bg-surface-muted hover:bg-surface-raised rounded-xl text-xs font-bold text-text border border-border cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Detailed Session Modal */}
      {selectedSessionRow && selectedSessionRow.record && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSelectedSessionRow(null)}
        >
          <div
            className="bg-surface rounded-card p-6 max-w-lg w-full shadow-2xl border border-border space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-text">
                  {selectedSessionRow.fullName} &middot; Attendance Session
                </h3>
                <p className="text-xs text-text-muted">
                  Work Date: {selectedSessionRow.record.workDate} &middot; Code:{' '}
                  {selectedSessionRow.employee.employeeCode ||
                    selectedSessionRow.employee.id.slice(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionRow(null)}
                className="text-text-muted hover:text-text font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Check-In vs Check-Out Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Check-In Card */}
              <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-2">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Check-In
                </p>
                <p className="text-lg font-bold font-display text-text">
                  {selectedSessionRow.checkInTimeFormatted}
                </p>
                {selectedSessionRow.checkInPhoto && (
                  <img
                    src={selectedSessionRow.checkInPhoto}
                    alt="Check-In"
                    className="w-full h-32 rounded-lg object-cover border border-border"
                  />
                )}
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <IconMapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="truncate">{selectedSessionRow.checkInAddress}</span>
                </div>
              </div>

              {/* Check-Out Card */}
              <div className="p-3.5 rounded-xl bg-surface-muted border border-border space-y-2">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Check-Out
                </p>
                <p className="text-lg font-bold font-display text-text">
                  {selectedSessionRow.checkOutTimeFormatted}
                </p>
                {selectedSessionRow.checkOutPhoto ? (
                  <img
                    src={selectedSessionRow.checkOutPhoto}
                    alt="Check-Out"
                    className="w-full h-32 rounded-lg object-cover border border-border"
                  />
                ) : (
                  <div className="w-full h-32 rounded-lg bg-surface border border-dashed border-border flex items-center justify-center text-xs text-text-muted">
                    {selectedSessionRow.record.checkOutTime
                      ? 'No photo recorded'
                      : 'Still in progress'}
                  </div>
                )}
                <div className="flex items-center gap-1 text-[11px] text-text-muted">
                  <IconMapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                  <span className="truncate">{selectedSessionRow.checkOutAddress}</span>
                </div>
              </div>
            </div>

            {/* Breaks breakdown */}
            <div className="p-3.5 rounded-xl bg-surface-muted/60 border border-border space-y-2">
              <p className="text-xs font-bold text-text">Breaks History</p>
              {selectedSessionRow.record.breaks && selectedSessionRow.record.breaks.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedSessionRow.record.breaks.map((b, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-none"
                    >
                      <span className="font-semibold text-text">Break #{idx + 1}</span>
                      <span className="text-text-muted font-semibold">
                        {formatTime(b.startTime)} &ndash;{' '}
                        {b.endTime ? formatTime(b.endTime) : 'Ongoing'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted">No breaks taken during this session.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedSessionRow(null)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanyCheckInOutTab;
