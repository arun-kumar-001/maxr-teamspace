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

function IconAlertTriangle({ className = 'w-5 h-5' }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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

  // Filtered Timesheets
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

  const handleRejectSelected = () => {
    setTimesheetList((prev) =>
      prev.map((ts) => (selectedIds.has(ts.id) ? { ...ts, status: 'flagged' } : ts)),
    );
    setSelectedIds(new Set());
    setSuccessToast(`${selectedIds.size} timesheets flagged for review.`);
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

  // Mock Hours by Day data
  const hoursByDay = [
    { day: 'Mon', hours: 184, percent: 92 },
    { day: 'Tue', hours: 192, percent: 96 },
    { day: 'Wed', hours: 178, percent: 89 },
    { day: 'Thu', hours: 188, percent: 94 },
    { day: 'Fri', hours: 172, percent: 86 },
    { day: 'Sat', hours: 24, percent: 12 },
    { day: 'Sun', hours: 0, percent: 0 },
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

      {/* 1. Four Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours Worked */}
        <div className="p-4 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Total Hours Worked
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {totalHoursWorked} hrs
              </span>
              <span className="text-[11px] text-text-muted block truncate">
                Current work period
              </span>
            </div>
          </div>
        </div>

        {/* Overtime Hours */}
        <div className="p-4 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Overtime Hours
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {totalOvertime} hrs
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold block truncate">
                Eligible for compensation
              </span>
            </div>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="p-4 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <IconClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Pending Approval
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {pendingCount}
              </span>
              <span className="text-[11px] text-amber-700 block truncate font-semibold">
                Needs manager sign-off
              </span>
            </div>
          </div>
        </div>

        {/* Flagged Timesheets */}
        <div className="p-4 bg-white border border-border/80 rounded-card shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <IconAlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                Flagged Timesheets
              </span>
              <span className="text-2xl font-extrabold text-text font-display leading-tight block">
                {flaggedCount}
              </span>
              <span className="text-[11px] text-rose-600 block truncate font-semibold">
                Missing check-outs or variance
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Layout (9 cols Table & Bulk Actions, 3 cols Panels) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 9 cols: Filters, Table, Bulk Actions */}
        <div className="lg:col-span-9 space-y-4 min-w-0">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Tabs */}
              <div className="flex items-center p-1 bg-white border border-border/80 rounded-xl shadow-xs">
                {(['all', 'submitted', 'flagged', 'approved'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusTab(tab)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg capitalize transition-all ${
                      statusTab === tab
                        ? 'bg-primary-deep text-white shadow-xs'
                        : 'text-text-muted hover:text-text'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Department Dropdown */}
              <select
                aria-label="Filter by Department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold bg-white border border-border/80 rounded-xl text-text outline-none hover:bg-surface-muted cursor-pointer shadow-xs"
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
                className="w-40 min-h-[36px] px-3 py-1.5 text-xs bg-white border border-border/80 rounded-xl text-text outline-none focus:border-primary-strong shadow-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="min-h-[36px] px-3 text-xs font-semibold flex items-center gap-1.5 bg-white shadow-xs"
              >
                <IconDownload />
                Export
              </Button>
            </div>
          </div>

          {/* Bulk Action Bar (when checkboxes selected) */}
          {selectedIds.size > 0 && canApproveTimesheets && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-emerald-900">
                {selectedIds.size} timesheet{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApproveSelected}
                  className="min-h-[32px] text-xs font-bold bg-primary-deep text-white"
                >
                  Approve Selected
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleRejectSelected}
                  className="min-h-[32px] text-xs font-bold"
                >
                  Flag Selected
                </Button>
              </div>
            </div>
          )}

          {/* Timesheets Table */}
          <div className="bg-white border border-border/80 rounded-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm" aria-label="Timesheets Table">
                <thead className="bg-surface-muted/60 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="w-8 pl-3.5 pr-2 py-3.5">
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
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Employee
                    </th>
                    <th
                      scope="col"
                      className="px-2.5 xl:px-3.5 py-3.5 hidden md:table-cell whitespace-nowrap"
                    >
                      Dept
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Planned
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      Worked
                    </th>
                    <th scope="col" className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                      OT
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
                  {filteredTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-xs text-text-muted">
                        No timesheets found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTimesheets.map((ts) => {
                      return (
                        <tr key={ts.id} className="hover:bg-surface-muted/40 transition-colors">
                          <td className="w-8 pl-3.5 pr-2 py-3.5">
                            <input
                              type="checkbox"
                              aria-label={`Select ${ts.name}`}
                              checked={selectedIds.has(ts.id)}
                              onChange={() => handleSelectOne(ts.id)}
                              className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                            />
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5">
                            <span className="font-bold text-text block truncate">{ts.name}</span>
                            <span className="text-[11px] text-text-muted block">
                              {ts.employeeCode}
                            </span>
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5 hidden md:table-cell text-xs text-text-muted whitespace-nowrap">
                            {ts.departmentName}
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5 text-xs text-text-muted whitespace-nowrap">
                            {ts.plannedHours}h
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5 font-bold text-text whitespace-nowrap">
                            {ts.workedHours}h
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                            {ts.overtimeHours > 0 ? (
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                                +{ts.overtimeHours}h
                              </span>
                            ) : (
                              <span className="text-text-muted text-xs font-medium">None</span>
                            )}
                          </td>

                          <td className="px-2.5 xl:px-3.5 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                ts.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : ts.status === 'flagged'
                                    ? 'bg-rose-500/10 text-rose-700'
                                    : 'bg-amber-500/10 text-amber-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ts.status === 'approved'
                                    ? 'bg-emerald-500'
                                    : ts.status === 'flagged'
                                      ? 'bg-rose-500'
                                      : 'bg-amber-500'
                                }`}
                              />
                              {ts.status === 'approved'
                                ? 'Approved'
                                : ts.status === 'flagged'
                                  ? 'Flagged'
                                  : 'Submitted'}
                            </span>
                          </td>

                          <td className="px-2.5 xl:px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {ts.status === 'submitted' && canApproveTimesheets && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveSingle(ts.id)}
                                  className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold"
                                  title="Approve timesheet"
                                >
                                  <IconCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDetailedEntry(ts)}
                                className="min-h-[28px] text-[11px] px-2 py-0.5"
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

        {/* Right 3 cols: Hours by Day & Overtime Claims */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {/* Hours by Day Card */}
          <div className="p-4 sm:p-5 bg-white border border-border/80 rounded-card shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h3 className="text-sm font-bold text-text leading-tight">Hours by Day</h3>
              <span className="text-[11px] font-semibold text-text-muted">Weekly Total</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {hoursByDay.map((d) => (
                <div key={d.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text">{d.day}</span>
                    <span className="text-text-muted tabular-nums">{d.hours} hrs</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${d.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Overtime Claims */}
          <div className="p-5 bg-white border border-border/80 rounded-card shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <h3 className="text-sm font-bold text-text leading-tight">Overtime Claims</h3>
              <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                2 Pending
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2.5 rounded-xl bg-surface border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text">Arun Kumar</span>
                  <span className="font-semibold text-emerald-600">+2.5 hrs</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Production deployment on Friday night.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-surface border border-border/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text">Rajesh Patel</span>
                  <span className="font-semibold text-emerald-600">+3.0 hrs</span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Critical incident resolution on server downtime.
                </p>
              </div>
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
                    <span className="text-text-muted tabular-nums">
                      09:00 AM – 06:00 PM (8.5 hrs)
                    </span>
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
