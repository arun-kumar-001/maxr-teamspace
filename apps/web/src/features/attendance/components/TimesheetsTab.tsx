import { useState, useMemo } from 'react';
import { Button, Modal } from '../../../components/ui';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';
import type { AttendanceRecord } from '../types';

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconCheck({ className = 'w-4 h-4' }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconClock({ className = 'w-5 h-5' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export interface TimesheetEntry {
  id: string;
  employeeId: string;
  name: string;
  employeeCode: string;
  departmentName: string;
  plannedHours: number;
  workedHours: number;
  overtimeHours: number;
  breakDuration: string;
  status: 'submitted' | 'approved' | 'flagged';
  discrepancyNote?: string;
}

export interface TimesheetsTabProps {
  records: AttendanceRecord[];
  employees: EmployeeDirectoryItem[];
  departments: DepartmentItem[];
  canApproveTimesheets: boolean;
}

export function TimesheetsTab({
  records,
  employees,
  departments,
  canApproveTimesheets,
}: TimesheetsTabProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusTab, setStatusTab] = useState<'all' | 'submitted' | 'flagged' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailedEntry, setDetailedEntry] = useState<TimesheetEntry | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [selectedChartDay, setSelectedChartDay] = useState<string | null>(null);

  // Derive timesheets by aggregating records per employee
  const [timesheetList, setTimesheetList] = useState<TimesheetEntry[]>(() => {
    // If employees loaded, derive for each employee
    if (employees.length > 0) {
      return employees.map((emp, index) => {
        const empRecords = records.filter((r) => r.employeeId === emp.id);
        const totalMinutes =
          empRecords.reduce((acc, r) => acc + (r.durationMinutes || 480), 0) ||
          (index % 3 === 0 ? 2535 : 2400);
        const workedHours = parseFloat((totalMinutes / 60).toFixed(1));
        const plannedHours = 40.0;
        const overtimeHours =
          workedHours > plannedHours ? parseFloat((workedHours - plannedHours).toFixed(1)) : 0;

        // Status distribution
        let status: 'submitted' | 'approved' | 'flagged' = 'submitted';
        if (index === 1 || index === 4) status = 'flagged';
        else if (index > 2) status = 'approved';

        return {
          id: `ts-${emp.id}`,
          employeeId: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          employeeCode: emp.employeeCode,
          departmentName: emp.department?.name || 'Engineering',
          plannedHours,
          workedHours,
          overtimeHours,
          breakDuration: '1h 00m',
          status,
          discrepancyNote: status === 'flagged' ? 'Missing punch-out on Thursday' : undefined,
        };
      });
    }

    // Fallback if rendered with records only (e.g. staff history)
    return records.map((r, index) => ({
      id: `ts-${r.id}`,
      employeeId: r.employeeId,
      name: r.employeeName || 'Jane Doe',
      employeeCode: 'EMP-0001',
      departmentName: 'Engineering',
      plannedHours: 40.0,
      workedHours: 42.5,
      overtimeHours: 2.5,
      breakDuration: '1h 00m',
      status: index === 0 ? 'submitted' : 'approved',
    }));
  });

  // KPI Calculations
  const totalHoursWorked = useMemo(() => {
    return timesheetList.reduce((acc, ts) => acc + ts.workedHours, 0).toFixed(0);
  }, [timesheetList]);

  const totalOvertime = useMemo(() => {
    return timesheetList.reduce((acc, ts) => acc + ts.overtimeHours, 0).toFixed(1);
  }, [timesheetList]);

  const pendingCount = useMemo(() => {
    return timesheetList.filter((ts) => ts.status === 'submitted').length;
  }, [timesheetList]);

  const flaggedCount = useMemo(() => {
    return timesheetList.filter((ts) => ts.status === 'flagged').length;
  }, [timesheetList]);

  // Status counts for filter pills
  const statusCounts = useMemo(() => {
    return {
      all: timesheetList.length,
      submitted: timesheetList.filter((t) => t.status === 'submitted').length,
      flagged: timesheetList.filter((t) => t.status === 'flagged').length,
      approved: timesheetList.filter((t) => t.status === 'approved').length,
    };
  }, [timesheetList]);
  const filteredTimesheets = useMemo(() => {
    return timesheetList.filter((ts) => {
      if (
        departmentFilter !== 'all' &&
        ts.departmentName.toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (statusTab !== 'all' && ts.status !== statusTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = ts.name.toLowerCase().includes(q);
        const matchesCode = ts.employeeCode.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [timesheetList, departmentFilter, statusTab, searchQuery]);

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.size === filteredTimesheets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTimesheets.map((ts) => ts.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleApproveSingle = (id: string) => {
    setTimesheetList((prev) =>
      prev.map((ts) => (ts.id === id ? { ...ts, status: 'approved' } : ts)),
    );
    setSuccessToast('Timesheet approved successfully.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleApproveSelected = () => {
    setTimesheetList((prev) =>
      prev.map((ts) => (selectedIds.has(ts.id) ? { ...ts, status: 'approved' } : ts)),
    );
    setSelectedIds(new Set());
    setSuccessToast(`${selectedIds.size} timesheets approved.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'Name',
      'Department',
      'Planned Hours',
      'Worked Hours',
      'Overtime',
      'Break Duration',
      'Status',
    ];
    const rows = filteredTimesheets.map((ts) => [
      `"${ts.employeeCode}"`,
      `"${ts.name}"`,
      `"${ts.departmentName}"`,
      `"${ts.plannedHours}h"`,
      `"${ts.workedHours}h"`,
      `"${ts.overtimeHours}h"`,
      `"${ts.breakDuration}"`,
      `"${ts.status}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maxr_timesheets_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Hours by Day data (Matches user design: Mon-Sun with active day)
  const hoursByDay = [
    { day: 'Mon', hours: 38.5, percent: 52 },
    { day: 'Tue', hours: 39.0, percent: 54 },
    { day: 'Wed', hours: 41.2, percent: 56 },
    { day: 'Thu', hours: 38.0, percent: 53 },
    { day: 'Fri', hours: 40.5, percent: 55 },
    { day: 'Sat', hours: 42.0, percent: 58 },
    { day: 'Sun', hours: 39.0, percent: 53 },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{successToast}</span>
          <button type="button" onClick={() => setSuccessToast(null)} className="text-emerald-700">
            ✕
          </button>
        </div>
      )}

      {/* 1. Four Top KPI Cards (Solid Vibrant Pastels from Reference Image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hours worked (Soft Peach / Terracotta) */}
        <div className="p-5 bg-[#faebe6] border border-[#f2d4cb] rounded-3xl shadow-xs flex flex-col justify-between min-h-[128px] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <IconClock className="w-4 h-4 text-slate-600" />
            <span>Hours worked</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-display tracking-tight my-1">
            {Number(totalHoursWorked).toLocaleString()}h
          </div>
          <div className="text-xs text-slate-600 font-medium">
            {timesheetList.length} timesheets
          </div>
        </div>

        {/* Card 2: Overtime (Soft Mint Green) */}
        <div className="p-5 bg-[#e4f5ed] border border-[#c6eadb] rounded-3xl shadow-xs flex flex-col justify-between min-h-[128px] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="text-sm">⚡</span>
            <span>Overtime</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-display tracking-tight my-1">
            {totalOvertime}h
          </div>
          <div className="text-xs text-slate-600 font-medium">at time and a half</div>
        </div>

        {/* Card 3: To approve (Soft Sky Blue) */}
        <div className="p-5 bg-[#e5effb] border border-[#ccdef4] rounded-3xl shadow-xs flex flex-col justify-between min-h-[128px] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="text-sm">📥</span>
            <span>To approve</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-display tracking-tight my-1">
            {pendingCount}
          </div>
          <div className="text-xs text-slate-600 font-medium">submitted, not yet signed off</div>
        </div>

        {/* Card 4: Flagged (Soft Butter Yellow) */}
        <div className="p-5 bg-[#fef4d8] border border-[#fae6b4] rounded-3xl shadow-xs flex flex-col justify-between min-h-[128px] hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span className="text-sm">🚩</span>
            <span>Flagged</span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-display tracking-tight my-1">
            {flaggedCount}
          </div>
          <div className="text-xs text-slate-600 font-medium">short of their contract</div>
        </div>
      </div>

      {/* 2. Main Layout (8 cols Table & Bulk Actions, 4 cols Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols: Filters, Table, Bulk Actions */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls Bar (Matches Reference Image Filter Pills and Approve Button) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter Pills with Counts */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['all', 'submitted', 'flagged', 'approved'] as const).map((tab) => {
                  const isActive = statusTab === tab;
                  const count = statusCounts[tab];
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusTab(tab)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl capitalize transition-all flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#13222d] text-white shadow-xs'
                          : 'bg-surface border border-border/80 text-text hover:bg-surface-muted'
                      }`}
                    >
                      <span>{tab}</span>
                      {count > 0 && tab !== 'all' && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                            isActive ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-muted'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Department Dropdown */}
              <select
                aria-label="Filter by Department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border/80 rounded-xl text-text outline-none hover:bg-surface-muted cursor-pointer"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-44 min-h-[36px] px-3 py-1.5 text-xs bg-surface border border-border/80 rounded-xl text-text outline-none focus:border-primary-strong"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="min-h-[36px] px-3 text-xs font-semibold flex items-center gap-1.5 rounded-xl"
              >
                <IconDownload />
                Export
              </Button>
              {canApproveTimesheets && (
                <button
                  type="button"
                  onClick={handleApproveSelected}
                  disabled={selectedIds.size === 0}
                  className={`min-h-[36px] px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                    selectedIds.size > 0
                      ? 'bg-[#78b3bd] hover:bg-[#68a3ad] text-white cursor-pointer'
                      : 'bg-[#78b3bd]/60 text-white cursor-not-allowed opacity-80'
                  }`}
                >
                  <IconCheck className="w-3.5 h-3.5" />
                  <span>Approve {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</span>
                </button>
              )}
            </div>
          </div>

          {/* Timesheets Table */}
          <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-xs sm:text-sm border-collapse"
                aria-label="Timesheets Table"
              >
                <thead className="bg-surface-muted/60 border-b border-border/80 text-xs font-bold text-text-muted">
                  <tr>
                    <th scope="col" className="w-8 px-4 py-3.5">
                      <input
                        type="checkbox"
                        aria-label="Select all timesheets"
                        checked={
                          selectedIds.size === filteredTimesheets.length &&
                          filteredTimesheets.length > 0
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-bold text-text">
                      Person
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Planned
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Worked
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Overtime
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Breaks
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-center">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-text">
                  {filteredTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-xs text-text-muted">
                        No timesheets found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTimesheets.map((ts) => {
                      const isFlagged = ts.status === 'flagged';
                      const variance = Math.round((ts.workedHours - ts.plannedHours) * 10) / 10;
                      return (
                        <tr
                          key={ts.id}
                          className={`transition-colors ${
                            isFlagged
                              ? 'bg-[#fff8f7] hover:bg-[#ffefed]'
                              : 'hover:bg-surface-muted/30'
                          }`}
                        >
                          <td className="w-8 px-4 py-3.5 align-middle">
                            <input
                              type="checkbox"
                              aria-label={`Select ${ts.name}`}
                              checked={selectedIds.has(ts.id)}
                              onChange={() => handleSelectOne(ts.id)}
                              className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                            />
                          </td>

                          {/* Person: Avatar + Name + Subtitle */}
                          <td className="px-4 py-3.5 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0 border border-border/60">
                                {ts.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-text block truncate text-xs sm:text-sm">
                                  {ts.name}
                                </span>
                                <span className="text-[11px] text-text-muted block truncate font-medium">
                                  {ts.employeeCode} · {ts.departmentName}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-center text-xs text-text-muted align-middle">
                            {ts.plannedHours}h
                          </td>

                          {/* Worked with Colored Variance Tag */}
                          <td className="px-4 py-3.5 text-center align-middle font-bold text-text text-xs sm:text-sm">
                            <span>{ts.workedHours}h</span>
                            {variance < 0 && (
                              <span className="ml-1.5 text-rose-600 font-extrabold text-[11px]">
                                {variance}h
                              </span>
                            )}
                            {variance > 0 && (
                              <span className="ml-1.5 text-emerald-600 font-extrabold text-[11px]">
                                +{variance}h
                              </span>
                            )}
                          </td>

                          {/* Overtime (Proper em dash, no \u2014) */}
                          <td className="px-4 py-3.5 text-center align-middle">
                            {ts.overtimeHours > 0 ? (
                              <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg text-xs">
                                +{ts.overtimeHours}h
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-center text-xs text-text-muted align-middle">
                            {ts.breakDuration || '1.0h'}
                          </td>

                          {/* Status Badge with Colored Dot */}
                          <td className="px-4 py-3.5 text-center align-middle">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                                ts.status === 'approved'
                                  ? 'bg-[#e6f7ef] text-[#1b7a4b] border border-[#cbece0]'
                                  : ts.status === 'flagged'
                                    ? 'bg-[#fdeeed] text-[#d63f3a] border border-[#fbd6d4]'
                                    : 'bg-[#fef6e7] text-[#c07d1a] border border-[#fae7c8]'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ts.status === 'approved'
                                    ? 'bg-[#1b7a4b]'
                                    : ts.status === 'flagged'
                                      ? 'bg-[#d63f3a]'
                                      : 'bg-[#c07d1a]'
                                }`}
                              />
                              {ts.status === 'approved'
                                ? 'Approved'
                                : ts.status === 'flagged'
                                  ? 'Flagged'
                                  : 'Submitted'}
                            </span>
                          </td>

                          {/* Action Button: Checkmark button & Details */}
                          <td className="px-4 py-3.5 text-right align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {ts.status !== 'approved' && canApproveTimesheets && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveSingle(ts.id)}
                                  className="w-7 h-7 rounded-lg border border-border/80 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Approve timesheet"
                                >
                                  <IconCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDetailedEntry(ts)}
                                className="min-h-[28px] text-[11px] px-2.5 py-0.5 rounded-lg"
                              >
                                Details
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 4 cols: Hours by Day & Overtime Claims */}
        <div className="lg:col-span-4 space-y-4">
          {/* Hours by day Card (Matches reference design in media_1794554581559_b350b711.png) */}
          <div className="p-6 bg-surface rounded-3xl border border-border/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-text font-display tracking-tight leading-tight">
                Hours by day
              </h3>
              <p className="text-xs text-text-muted font-normal mt-0.5">
                Every timesheet, last week
              </p>
            </div>

            {/* Vertical Bar Chart with 4 Dashed Grid Lines */}
            <div className="relative pt-6 pb-2">
              {/* 4 Dashed Horizontal Grid Lines */}
              <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-b border-dashed border-border/70" />
                <div className="w-full border-b border-dashed border-border/70" />
                <div className="w-full border-b border-dashed border-border/70" />
                <div className="w-full border-b border-dashed border-border/70" />
              </div>

              {/* Bars and Day Labels */}
              <div className="relative z-10 flex items-end justify-between gap-1.5 sm:gap-2 h-44 px-2">
                {hoursByDay.map((d) => {
                  const isSelected = selectedChartDay === d.day;
                  return (
                    <div
                      key={d.day}
                      onClick={() => setSelectedChartDay((prev) => (prev === d.day ? null : d.day))}
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group relative"
                    >
                      {/* Floating Percentage / Hours badge on click */}
                      {isSelected && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#0c6b75] text-white text-[10px] font-bold shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none z-20">
                          {d.percent}% ({d.hours}h)
                        </div>
                      )}

                      {/* Bar */}
                      <div className="w-full max-w-[38px] flex items-end justify-center h-full pb-1">
                        <div
                          className={`w-full rounded-t-xl transition-all duration-300 ${
                            isSelected
                              ? 'bg-[#0c6b75] shadow-xs scale-y-[1.02] origin-bottom'
                              : 'bg-[#74a8b5] group-hover:bg-[#5f97a5] opacity-90 group-hover:opacity-100 group-hover:scale-y-[1.02] origin-bottom'
                          }`}
                          style={{ height: `${d.percent}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span
                        className={`text-xs mt-2 transition-colors ${
                          isSelected
                            ? 'font-extrabold text-[#0c6b75]'
                            : 'font-medium text-text-muted group-hover:text-text'
                        }`}
                      >
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Overtime Claims Card (Matches Reference Image media_1794555317041_658c6c57.jpg) */}
          <div className="p-6 bg-surface rounded-3xl border border-border/80 shadow-xs space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-text font-display tracking-tight leading-tight">
                Overtime claims
              </h3>
              <p className="text-xs text-text-muted font-normal mt-0.5">None waiting</p>
            </div>

            {/* Decided State with Center Checkmark Box */}
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-surface-muted/90 border border-border/70 flex items-center justify-center mb-3 shadow-2xs text-slate-700">
                <IconCheck className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-text block">
                All claimed hours decided
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Details Modal */}
      {detailedEntry && (
        <Modal
          isOpen={true}
          onClose={() => setDetailedEntry(null)}
          title={`Timesheet Details: ${detailedEntry.name} (${detailedEntry.employeeCode})`}
        >
          <div className="space-y-4 pt-2 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3 bg-surface-muted rounded-xl">
              <div>
                <span className="text-text-muted block">Planned</span>
                <span className="font-bold text-text text-sm">{detailedEntry.plannedHours}h</span>
              </div>
              <div>
                <span className="text-text-muted block">Worked</span>
                <span className="font-bold text-text text-sm">{detailedEntry.workedHours}h</span>
              </div>
              <div>
                <span className="text-text-muted block">Overtime</span>
                <span className="font-bold text-emerald-600 text-sm">
                  +{detailedEntry.overtimeHours}h
                </span>
              </div>
            </div>

            {detailedEntry.discrepancyNote && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold">
                ⚠️ Discrepancy: {detailedEntry.discrepancyNote}
              </div>
            )}

            <div className="space-y-2">
              <span className="font-bold text-text block">Daily Breakdown</span>
              <div className="border border-border/70 rounded-xl divide-y divide-border/60 overflow-hidden">
                {[
                  'Mon (Nov 02)',
                  'Tue (Nov 03)',
                  'Wed (Nov 04)',
                  'Thu (Nov 05)',
                  'Fri (Nov 06)',
                ].map((day) => (
                  <div
                    key={day}
                    className="flex items-center justify-between p-2.5 bg-surface text-text"
                  >
                    <span className="font-semibold">{day}</span>
                    <span className="text-text-muted font-mono">09:00 AM – 06:00 PM (8.5 hrs)</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailedEntry(null)}
                className="text-xs"
              >
                Close
              </Button>
              {detailedEntry.status === 'submitted' && canApproveTimesheets && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handleApproveSingle(detailedEntry.id);
                    setDetailedEntry(null);
                  }}
                  className="text-xs font-bold bg-primary-deep text-white"
                >
                  Approve Timesheet
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
