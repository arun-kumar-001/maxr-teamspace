import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button, KpiCard, Modal } from '../../../components/ui';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';
import type { AttendanceRecord } from '../types';
import { fetchTeamAttendance, fetchMyAttendanceHistory } from '../api/attendance';
import { fetchHolidays, fetchLeaveCalendar } from '../../leave/api/leave';
import type { LeaveCalendarEntry } from '../../leave/types';
import { fetchAttendancePolicy } from '../../shifts/api/shifts';
import { plannedFor, varianceHours } from '../lib/timesheet-plan';

function formatPunchTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function getWeekDays(refDateStr?: string) {
  let baseDate = new Date();
  if (refDateStr && /^\d{4}-\d{2}-\d{2}$/.test(refDateStr)) {
    const parts = refDateStr.split('-').map(Number);
    const yr = parts[0];
    const mo = parts[1];
    const da = parts[2];
    if (typeof yr === 'number' && typeof mo === 'number' && typeof da === 'number') {
      baseDate = new Date(yr, mo - 1, da);
    }
  }

  const day = baseDate.getDay(); // 0: Sun, 1: Mon, ...
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() + diffToMon);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days: Array<{
    dayName: string;
    isoDate: string;
    displayLabel: string;
    fullDisplay: string;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    const yr = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const da = String(dt.getDate()).padStart(2, '0');
    const isoDate = `${yr}-${mo}-${da}`;
    const shortDisplay = dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const name = dayNames[i] ?? '';
    days.push({
      dayName: name,
      isoDate,
      displayLabel: `${name} (${shortDisplay})`,
      fullDisplay: `${name}, ${shortDisplay} ${yr}`,
    });
  }

  const firstDay = days[0];
  const lastDay = days[6];

  return {
    mondayIso: firstDay?.isoDate ?? '',
    sundayIso: lastDay?.isoDate ?? '',
    startLabel: firstDay?.displayLabel ?? '',
    endLabel: lastDay?.displayLabel ?? '',
    days,
  };
}

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
  /** Days with a check-in this week. */
  daysWorked: number;
  /** Working days so far this week; null when the company plan could not be read. */
  plannedDays: number | null;
  plannedHours: number | null;
  workedHours: number;
  /** Worked minus planned (positive is overtime); null when the plan is not known. */
  varianceHours: number | null;
  breakDuration: string;
  /** A check-in on a past day with no check-out. */
  discrepancyNote?: string;
}

export interface TimesheetsTabProps {
  records: AttendanceRecord[];
  employees: EmployeeDirectoryItem[];
  departments: DepartmentItem[];
  /** Whether the whole team's attendance may be listed (otherwise only the viewer's own). */
  canViewTeam: boolean;
  selectedDate?: string;
}

const formatHours = (hours: number | null): string => (hours === null ? '—' : `${hours}h`);

const localIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function TimesheetsTab({
  records,
  employees,
  departments,
  canViewTeam,
  selectedDate,
}: TimesheetsTabProps) {
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [detailedEntry, setDetailedEntry] = useState<TimesheetEntry | null>(null);
  const [selectedChartDay, setSelectedChartDay] = useState<string | null>(null);
  const [hoveredChartDay, setHoveredChartDay] = useState<string | null>(null);
  const [plan, setPlan] = useState<{
    workWeek: number[];
    fullDayMinutes: number;
    holidays: Set<string>;
    leaves: LeaveCalendarEntry[];
  } | null>(null);
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>(records);

  const activeSelectedDate = useMemo(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return selectedDate;
    }
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const da = String(now.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  }, [selectedDate]);

  const weekInfo = useMemo(() => getWeekDays(activeSelectedDate), [activeSelectedDate]);

  // Sync with records prop
  useEffect(() => {
    if (records && records.length > 0) {
      setWeekRecords((prev) => {
        if (prev.length === 0) return records;
        const map = new Map<string, AttendanceRecord>();
        prev.forEach((r) => map.set(r.id, r));
        records.forEach((r) => map.set(r.id, r));
        return Array.from(map.values());
      });
    }
  }, [records]);

  // Fetch full week team records
  const loadWeekRecords = useCallback(async () => {
    try {
      const res = canViewTeam
        ? await fetchTeamAttendance({
            startDate: weekInfo.mondayIso,
            endDate: weekInfo.sundayIso,
            pageSize: 300,
          })
        : await fetchMyAttendanceHistory({
            startDate: weekInfo.mondayIso,
            endDate: weekInfo.sundayIso,
            pageSize: 50,
          });
      if (res && Array.isArray(res.data)) {
        setWeekRecords(res.data);
      }
    } catch {
      // Keep existing weekRecords if API fails
    }
  }, [canViewTeam, weekInfo.mondayIso, weekInfo.sundayIso]);

  useEffect(() => {
    void loadWeekRecords();
  }, [loadWeekRecords]);

  // Real-time live update listeners
  useEffect(() => {
    const handleSync = () => {
      void loadWeekRecords();
    };
    window.addEventListener('maxr:attendance-updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('maxr:attendance-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [loadWeekRecords]);

  // What the week should hold: the company work week and full-day hours, holidays and leave.
  useEffect(() => {
    let active = true;
    const years = [
      ...new Set([Number(weekInfo.mondayIso.slice(0, 4)), Number(weekInfo.sundayIso.slice(0, 4))]),
    ];
    void Promise.allSettled([
      fetchAttendancePolicy(),
      Promise.all(years.map((y) => fetchHolidays(y))).then((lists) => lists.flat()),
      fetchLeaveCalendar(weekInfo.mondayIso, weekInfo.sundayIso),
    ]).then(([policy, holidays, leaves]) => {
      if (!active) return;
      if (policy.status !== 'fulfilled') {
        setPlan(null);
        return;
      }
      setPlan({
        workWeek: policy.value.workWeek,
        fullDayMinutes: policy.value.fullDayMinutes,
        holidays: new Set(holidays.status === 'fulfilled' ? holidays.value.map((h) => h.date) : []),
        leaves: leaves.status === 'fulfilled' ? leaves.value : [],
      });
    });
    return () => {
      active = false;
    };
  }, [weekInfo.mondayIso, weekInfo.sundayIso]);

  // Who is shown: the employees we know, or (a person's own history) whoever the records name.
  const people = useMemo(() => {
    if (employees.length > 0) {
      return employees.map((emp) => ({
        id: emp.id,
        code: emp.employeeCode,
        name: `${emp.firstName} ${emp.lastName}`.trim(),
        department: emp.department?.name || 'General',
      }));
    }
    const seen = new Map<string, { id: string; code: string; name: string; department: string }>();
    for (const r of weekRecords) {
      if (!seen.has(r.employeeId)) {
        seen.set(r.employeeId, {
          id: r.employeeId,
          code: '',
          name: r.employeeName || 'Employee',
          department: 'General',
        });
      }
    }
    return [...seen.values()];
  }, [employees, weekRecords]);

  // One timesheet per person: the week's attendance against what was expected of them
  const timesheetList = useMemo<TimesheetEntry[]>(() => {
    const todayIso = localIso(new Date());
    const weekDates = weekInfo.days.map((d) => d.isoDate);

    return people.map((person) => {
      const empRecords = weekRecords.filter(
        (r) => r.employeeId === person.id || (person.code && r.employeeId === person.code),
      );
      const totalMinutes = empRecords.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
      const workedHours = parseFloat((totalMinutes / 60).toFixed(1));
      const daysWorked = new Set(empRecords.filter((r) => r.checkInTime).map((r) => r.workDate))
        .size;

      const leaveDates = new Set<string>();
      for (const leave of plan?.leaves ?? []) {
        if (leave.employeeId !== person.id || leave.status !== 'approved') continue;
        for (const date of weekDates) {
          if (date >= leave.startDate && date <= leave.endDate) leaveDates.add(date);
        }
      }
      const planned = plan
        ? plannedFor({
            weekDates,
            today: todayIso,
            workWeek: plan.workWeek,
            holidays: plan.holidays,
            leaveDates,
            fullDayMinutes: plan.fullDayMinutes,
          })
        : null;

      const totalBreakMinutes = empRecords.reduce((acc, r) => acc + (r.breakMinutes || 0), 0);
      const breakH = Math.floor(totalBreakMinutes / 60);
      const breakM = totalBreakMinutes % 60;
      const breakDuration =
        totalBreakMinutes > 0
          ? breakH > 0
            ? `${breakH}h ${breakM > 0 ? `${breakM}m` : ''}`.trim()
            : `${breakM}m`
          : '0m';

      const missingPunchRecord = empRecords.find(
        (r) => r.checkInTime && !r.checkOutTime && r.workDate < todayIso,
      );

      return {
        id: `ts-${person.id}`,
        employeeId: person.id,
        name: person.name,
        employeeCode: person.code,
        departmentName: person.department,
        daysWorked,
        plannedDays: planned ? planned.plannedDays : null,
        plannedHours: planned ? planned.plannedHours : null,
        workedHours,
        varianceHours: planned ? varianceHours(workedHours, planned.plannedHours) : null,
        breakDuration,
        discrepancyNote: missingPunchRecord
          ? `Missing check-out on ${missingPunchRecord.workDate}`
          : undefined,
      };
    });
  }, [people, weekRecords, weekInfo.days, plan]);

  // KPI Calculations
  const totalHoursWorked = useMemo(() => {
    return timesheetList.reduce((acc, ts) => acc + ts.workedHours, 0).toFixed(0);
  }, [timesheetList]);

  const totalPlannedHours = useMemo(
    () => (plan ? timesheetList.reduce((acc, ts) => acc + (ts.plannedHours ?? 0), 0) : null),
    [timesheetList, plan],
  );

  const totalOvertime = useMemo(() => {
    return timesheetList
      .reduce((acc, ts) => acc + Math.max(0, ts.varianceHours ?? 0), 0)
      .toFixed(1);
  }, [timesheetList]);

  const missingCheckoutCount = useMemo(
    () => timesheetList.filter((ts) => ts.discrepancyNote).length,
    [timesheetList],
  );

  const filteredTimesheets = useMemo(() => {
    return timesheetList.filter((ts) => {
      if (
        departmentFilter !== 'all' &&
        ts.departmentName.toLowerCase() !== departmentFilter.toLowerCase()
      ) {
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
  }, [timesheetList, departmentFilter, searchQuery]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'Name',
      'Department',
      'Days Worked',
      'Planned Hours',
      'Worked Hours',
      'Break Duration',
      'Difference (h)',
      'Note',
    ];
    const rows = filteredTimesheets.map((ts) => [
      `"${ts.employeeCode}"`,
      `"${ts.name}"`,
      `"${ts.departmentName}"`,
      `"${ts.daysWorked}"`,
      `"${ts.plannedHours ?? ''}"`,
      `"${ts.workedHours}"`,
      `"${ts.breakDuration}"`,
      `"${ts.varianceHours ?? ''}"`,
      `"${ts.discrepancyNote ?? ''}"`,
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

  // Hours by Day data derived from actual attendance records for the 7 days of the week
  const hoursByDay = useMemo(() => {
    const dayTotals = weekInfo.days.map((d) => {
      const dayRecs = weekRecords.filter((r) => r.workDate === d.isoDate);
      const dayMinutes = dayRecs.reduce((acc, r) => acc + (r.durationMinutes || 0), 0);
      const hours = parseFloat((dayMinutes / 60).toFixed(1));
      return {
        day: d.dayName,
        isoDate: d.isoDate,
        hours,
      };
    });

    const maxHours = Math.max(...dayTotals.map((d) => d.hours), 8);

    return dayTotals.map((d) => ({
      day: d.day,
      hours: d.hours,
      percent:
        d.hours > 0 ? Math.max(12, Math.min(100, Math.round((d.hours / maxHours) * 100))) : 8,
    }));
  }, [weekInfo.days, weekRecords]);

  // Average hours per day calculation
  const avgDayHours = useMemo(() => {
    const totalWeekHours = hoursByDay.reduce((acc, d) => acc + d.hours, 0);
    const activeDays = hoursByDay.filter((d) => d.hours > 0).length || 5;
    return (totalWeekHours / activeDays).toFixed(1);
  }, [hoursByDay]);

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <KpiCard
          label="Hours Worked"
          value={`${Number(totalHoursWorked).toLocaleString()}h`}
          icon={<IconClock className="w-6 h-6" />}
          variant="blue"
        />
        <KpiCard
          label="Planned So Far"
          value={totalPlannedHours === null ? '—' : `${Math.round(totalPlannedHours * 10) / 10}h`}
          icon={
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          }
          variant="emerald"
        />
        <KpiCard
          label="Overtime"
          value={`${totalOvertime}h`}
          icon={
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
          variant="amber"
        />
        <KpiCard
          label="Missing Check-outs"
          value={missingCheckoutCount}
          icon={
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
          variant="rose"
        />
      </div>

      {/* 2. Main Layout (Table & Hours by Day Panel) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left: Filters, Table, Bulk Actions */}
        <div className="xl:col-span-9 space-y-4">
          {/* Controls Bar (Filter Pills, Search, Export, and Approve Button) */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
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
            </div>
          </div>

          {/* Timesheets Table */}
          <div className="bg-surface rounded-2xl border border-border/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-xs border-collapse"
                aria-label="Timesheets Table"
              >
                <thead className="bg-surface-muted/60 border-b border-border/80 text-xs font-bold text-text-muted">
                  <tr>
                    <th
                      scope="col"
                      className="px-3.5 py-3 font-bold text-text whitespace-nowrap min-w-[170px]"
                    >
                      Person
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-center whitespace-nowrap min-w-[70px]"
                      title="Days with a check-in, out of the working days so far"
                    >
                      Days
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-center whitespace-nowrap min-w-[70px]"
                      title="Working days so far this week, less holidays and approved leave, at the full-day hours"
                    >
                      Planned
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-center whitespace-nowrap min-w-[70px]"
                    >
                      Worked
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3 text-center whitespace-nowrap min-w-[70px]"
                    >
                      Breaks
                    </th>
                    <th
                      scope="col"
                      className="px-3.5 py-3 text-right whitespace-nowrap min-w-[90px]"
                      title="Worked minus planned: plus is overtime, minus is a shortfall"
                    >
                      Difference
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-text">
                  {filteredTimesheets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-xs text-text-muted">
                        No timesheets found matching filters.
                      </td>
                    </tr>
                  ) : (
                    filteredTimesheets.map((ts) => {
                      const subtitle = [ts.employeeCode, ts.departmentName]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <tr
                          key={ts.id}
                          className={`transition-colors ${
                            ts.discrepancyNote
                              ? 'bg-rose-50/40 hover:bg-rose-50/70'
                              : 'hover:bg-surface-muted/30'
                          }`}
                        >
                          {/* Person: the whole cell opens the week's details */}
                          <td className="px-3.5 py-3 align-middle">
                            <button
                              type="button"
                              onClick={() => setDetailedEntry(ts)}
                              aria-label={`Timesheet details for ${ts.name}`}
                              className="flex w-full items-center gap-3 text-left min-h-[44px] cursor-pointer"
                            >
                              <span
                                aria-hidden="true"
                                className="w-8 h-8 rounded-full bg-surface-muted text-text font-bold text-xs flex items-center justify-center shrink-0 border border-border/60"
                              >
                                {ts.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </span>
                              <span className="min-w-0">
                                <span className="font-bold text-text block truncate text-xs sm:text-sm">
                                  {ts.name}
                                </span>
                                <span className="text-[11px] text-text-muted block truncate font-medium">
                                  {subtitle}
                                </span>
                                {ts.discrepancyNote && (
                                  <span className="mt-0.5 block text-[11px] font-semibold text-rose-700">
                                    ⚠ {ts.discrepancyNote}
                                  </span>
                                )}
                              </span>
                            </button>
                          </td>

                          <td className="px-3 py-3 text-center text-xs text-text align-middle tabular-nums">
                            {ts.daysWorked}
                            {ts.plannedDays !== null && (
                              <span className="text-text-muted"> / {ts.plannedDays}</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-center text-xs text-text-muted align-middle tabular-nums">
                            {formatHours(ts.plannedHours)}
                          </td>

                          <td className="px-3 py-3 text-center align-middle font-bold text-text text-xs sm:text-sm tabular-nums">
                            {ts.workedHours}h
                          </td>

                          <td className="px-3 py-3 text-center text-xs text-text-muted align-middle tabular-nums">
                            {ts.breakDuration}
                          </td>

                          {/* Difference: sign and words as well as colour */}
                          <td className="px-3.5 py-3 text-right align-middle text-xs font-bold tabular-nums">
                            {ts.varianceHours === null ? (
                              <span className="text-text-muted font-normal">—</span>
                            ) : ts.varianceHours > 0 ? (
                              <span className="text-emerald-700">+{ts.varianceHours}h over</span>
                            ) : ts.varianceHours < 0 ? (
                              <span className="text-rose-700">{ts.varianceHours}h short</span>
                            ) : (
                              <span className="text-text-muted font-semibold">On plan</span>
                            )}
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

        {/* Right: Hours by Day Interactive Chart */}
        <div className="xl:col-span-3 space-y-4">
          {/* Hours by day Card (Interactive Chart) */}
          <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-border/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-text font-display tracking-tight leading-tight">
                  Hours by day
                </h3>
                <p className="text-[11px] text-text-muted font-normal mt-0.5">
                  Every timesheet, this week ({weekInfo.startLabel} – {weekInfo.endLabel})
                </p>
              </div>
              {selectedChartDay && (
                <button
                  type="button"
                  onClick={() => setSelectedChartDay(null)}
                  className="text-[10px] font-semibold text-primary-deep hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Vertical Bar Chart with 3 Dashed Grid Lines */}
            <div className="relative pt-6 pb-1">
              {/* 3 Dashed Horizontal Grid Lines */}
              <div className="absolute inset-x-0 top-6 bottom-6 flex flex-col justify-between pointer-events-none">
                <div className="w-full border-b border-dashed border-border/70" />
                <div className="w-full border-b border-dashed border-border/70" />
                <div className="w-full border-b border-dashed border-border/70" />
              </div>

              {/* Bars and Day Labels */}
              <div className="relative z-10 flex items-end justify-between gap-1.5 sm:gap-2 h-32 px-1">
                {hoursByDay.map((d) => {
                  const isSelected = selectedChartDay === d.day;
                  const isHovered = hoveredChartDay === d.day;
                  const isActive = isSelected || isHovered;
                  return (
                    <div
                      key={d.day}
                      onMouseEnter={() => setHoveredChartDay(d.day)}
                      onMouseLeave={() => setHoveredChartDay(null)}
                      onClick={() => setSelectedChartDay((prev) => (prev === d.day ? null : d.day))}
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group relative"
                    >
                      {/* Floating Percentage / Hours badge on hover or click */}
                      {isActive && (
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-primary-deep text-white text-[10px] font-bold shadow-md whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none z-20">
                          {d.hours}h · {d.percent}%
                        </div>
                      )}

                      {/* Bar */}
                      <div className="w-full max-w-[32px] flex items-end justify-center h-full pb-1">
                        <div
                          className={`w-full rounded-t-lg transition-all duration-200 ${
                            isActive
                              ? 'bg-primary-deep shadow-xs scale-y-[1.04] origin-bottom'
                              : 'bg-primary/70 group-hover:bg-primary opacity-85 group-hover:opacity-100 group-hover:scale-y-[1.02] origin-bottom'
                          }`}
                          style={{ height: `${d.percent}%` }}
                        />
                      </div>

                      {/* Day Label */}
                      <span
                        className={`text-[11px] mt-1.5 transition-colors ${
                          isActive
                            ? 'font-extrabold text-primary-deep'
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

            {/* Interactive Stats Footer */}
            {(() => {
              const activeDay = hoursByDay.find(
                (d) => d.day === (hoveredChartDay || selectedChartDay),
              );
              return (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                  <span className="text-text-muted text-[11px] font-medium">
                    {activeDay ? `${activeDay.day} selected` : 'Avg / day'}
                  </span>
                  <span className="font-bold text-primary-deep font-mono text-xs">
                    {activeDay
                      ? `${activeDay.hours} hrs (${activeDay.percent}%)`
                      : `${avgDayHours} hrs`}
                  </span>
                </div>
              );
            })()}
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
                <span className="font-bold text-text text-sm">
                  {formatHours(detailedEntry.plannedHours)}
                </span>
              </div>
              <div>
                <span className="text-text-muted block">Worked</span>
                <span className="font-bold text-text text-sm">{detailedEntry.workedHours}h</span>
              </div>
              <div>
                <span className="text-text-muted block">Breaks</span>
                <span className="font-bold text-text text-sm">{detailedEntry.breakDuration}</span>
              </div>
            </div>

            {detailedEntry.discrepancyNote && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold">
                ⚠ {detailedEntry.discrepancyNote}
              </div>
            )}

            <div className="space-y-2">
              <span className="font-bold text-text block">
                Daily Breakdown ({weekInfo.startLabel} – {weekInfo.endLabel})
              </span>
              <div className="border border-border/70 rounded-xl divide-y divide-border/60 overflow-hidden">
                {weekInfo.days.map((day) => {
                  const empDayRec = weekRecords.find(
                    (r) =>
                      (r.employeeId === detailedEntry.employeeId ||
                        r.employeeId === detailedEntry.id.replace('ts-', '')) &&
                      r.workDate === day.isoDate,
                  );
                  const hasRecord = !!empDayRec;
                  const punchIn = empDayRec?.checkInTime
                    ? formatPunchTime(empDayRec.checkInTime)
                    : null;
                  const punchOut = empDayRec?.checkOutTime
                    ? formatPunchTime(empDayRec.checkOutTime)
                    : null;
                  const hours = empDayRec
                    ? ((empDayRec.durationMinutes || 0) / 60).toFixed(1)
                    : '0.0';

                  return (
                    <div
                      key={day.isoDate}
                      className="flex items-center justify-between p-2.5 bg-surface text-text text-xs"
                    >
                      <span className="font-semibold">{day.fullDisplay}</span>
                      <span
                        className={`font-mono ${
                          hasRecord ? 'text-primary-deep font-bold' : 'text-text-muted'
                        }`}
                      >
                        {hasRecord
                          ? `${punchIn} – ${punchOut || 'Active'} (${hours} hrs)`
                          : 'No attendance recorded (0.0 hrs)'}
                      </span>
                    </div>
                  );
                })}
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
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
