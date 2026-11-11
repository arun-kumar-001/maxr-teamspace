import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal } from '../../../components/ui';
import { fetchMyAttendanceHistory, fetchTeamAttendance } from '../api/attendance';
import type { AttendanceRecord } from '../types';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';
import { fetchLeaveCalendar } from '../../leave/api/leave';
import type { LeaveCalendarEntry } from '../../leave/types';
import { assignShift, fetchEmployeeShiftAssignments } from '../../shifts/api/shifts';
import type { AttendancePolicy, Shift, ShiftAssignment } from '../../shifts/types';

function IconChevronLeft({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function IconChevronRight({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconCalendar({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseShiftHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => n === undefined || Number.isNaN(n))) return 8;
  let diffMin = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
  if (diffMin <= 0) diffMin += 24 * 60;
  // Standard 9h span (e.g. 09:00-18:00) corresponds to 8h net working shift when >= 9h, else exact
  return diffMin === 540 ? 8 : Math.round((diffMin / 60) * 10) / 10;
}

const SHIFT_TONE_PALETTE = [
  'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
  'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
  'bg-primary-soft text-primary-deep border-primary-soft-border hover:bg-primary/20',
];

const SHIFT_DOT_PALETTE = ['bg-emerald-600', 'bg-sky-600', 'bg-purple-600', 'bg-primary-strong'];

export interface RosterTabProps {
  employees: EmployeeDirectoryItem[];
  departments: DepartmentItem[];
  shifts: Shift[];
  attendancePolicy?: AttendancePolicy | null;
  selectedDate?: string;
  initialRecords?: AttendanceRecord[];
  initialLeaves?: LeaveCalendarEntry[];
  canManageRoster: boolean;
  onRefresh?: () => void;
}

export function RosterTab({
  employees,
  departments,
  shifts,
  attendancePolicy,
  selectedDate,
  initialRecords = [],
  initialLeaves = [],
  canManageRoster,
  onRefresh,
}: RosterTabProps) {
  const todayStr = useMemo(() => toLocalIsoDate(new Date()), []);
  const anchorIso = selectedDate || todayStr;

  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState<number>(0);

  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [weekLeaves, setWeekLeaves] = useState<LeaveCalendarEntry[]>(initialLeaves);
  const [assignmentsByEmp, setAssignmentsByEmp] = useState<Record<string, ShiftAssignment[]>>({});

  const [assigningEmployee, setAssigningEmployee] = useState<EmployeeDirectoryItem | null>(null);
  const [assignTargetDate, setAssignTargetDate] = useState<string>('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [effectiveTo, setEffectiveTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const workWeek = useMemo<number[]>(() => {
    if (attendancePolicy?.workWeek && attendancePolicy.workWeek.length > 0) {
      return attendancePolicy.workWeek;
    }
    return [1, 2, 3, 4, 5];
  }, [attendancePolicy]);

  const defaultShift = useMemo<Shift | null>(() => {
    if (shifts.length === 0) return null;
    if (attendancePolicy?.defaultShiftId) {
      const found = shifts.find((s) => s.id === attendancePolicy.defaultShiftId);
      if (found) return found;
    }
    return shifts.find((s) => s.isActive) ?? shifts[0] ?? null;
  }, [shifts, attendancePolicy]);

  // Compute Monday..Sunday for displayed week anchored to selectedDate + weekOffset
  const weekDays = useMemo(() => {
    const anchor = new Date(`${anchorIso}T00:00:00`);
    const currentDay = anchor.getDay(); // 0=Sun..6=Sat
    const distanceToMonday = (currentDay + 6) % 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - distanceToMonday + weekOffset * 7);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days: {
      dayName: string;
      isoWeekday: number; // 1=Mon..7=Sun
      dateStr: string;
      formatted: string;
      isToday: boolean;
      isPast: boolean;
      isWeekend: boolean;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toLocalIsoDate(d);
      const isoWeekday = i + 1;
      days.push({
        dayName: dayNames[i] ?? '',
        isoWeekday,
        dateStr: iso,
        formatted: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: iso === todayStr,
        isPast: iso < todayStr,
        isWeekend: !workWeek.includes(isoWeekday),
      });
    }
    return days;
  }, [anchorIso, weekOffset, todayStr, workWeek]);

  const weekStartStr = weekDays[0]?.dateStr ?? anchorIso;
  const weekEndStr = weekDays[6]?.dateStr ?? anchorIso;
  const displayYear = weekStartStr.slice(0, 4);

  const weekLabel = useMemo(() => {
    if (!weekDays[0] || !weekDays[6]) return 'Current Week';
    return `${weekDays[0].formatted} – ${weekDays[6].formatted}, ${displayYear}`;
  }, [weekDays, displayYear]);

  // Load week attendance & approved/pending leave calendar for the visible week
  useEffect(() => {
    let active = true;
    const attPromise = canManageRoster
      ? fetchTeamAttendance({ startDate: weekStartStr, endDate: weekEndStr, pageSize: 200 })
      : fetchMyAttendanceHistory({ startDate: weekStartStr, endDate: weekEndStr, pageSize: 100 });

    void Promise.allSettled([attPromise, fetchLeaveCalendar(weekStartStr, weekEndStr)]).then(
      ([attRes, leaveRes]) => {
        if (!active) return;
        if (attRes.status === 'fulfilled') {
          setWeekRecords(attRes.value.data || []);
        }
        if (leaveRes.status === 'fulfilled') {
          setWeekLeaves(leaveRes.value || []);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [weekStartStr, weekEndStr, canManageRoster]);

  // Filter employees by department & search query
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return employees.filter((emp) => {
      if (
        departmentFilter !== 'all' &&
        (emp.department?.name || '').toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (q) {
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        return (
          fullName.includes(q) ||
          emp.employeeCode.toLowerCase().includes(q) ||
          (emp.department?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, departmentFilter, searchQuery]);

  // Load real shift assignments for visible employees
  useEffect(() => {
    if (filteredEmployees.length === 0) return;
    let active = true;
    const targets = filteredEmployees.slice(0, 40);

    void Promise.allSettled(
      targets.map(async (emp) => ({
        empId: emp.id,
        assignments: await fetchEmployeeShiftAssignments(emp.id),
      })),
    ).then((results) => {
      if (!active) return;
      const next: Record<string, ShiftAssignment[]> = {};
      for (const res of results) {
        if (res.status === 'fulfilled') {
          next[res.value.empId] = res.value.assignments;
        }
      }
      setAssignmentsByEmp((prev) => ({ ...prev, ...next }));
    });

    return () => {
      active = false;
    };
  }, [filteredEmployees]);

  // Index records and leaves for fast O(1) cell lookup
  const recordByEmpDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of weekRecords) {
      map.set(`${rec.employeeId}__${rec.workDate}`, rec);
    }
    return map;
  }, [weekRecords]);

  const leaveByEmpDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntry>();
    for (const leave of weekLeaves) {
      for (const wd of weekDays) {
        if (wd.dateStr >= leave.startDate && wd.dateStr <= leave.endDate) {
          map.set(`${leave.employeeId}__${wd.dateStr}`, leave);
        }
      }
    }
    return map;
  }, [weekLeaves, weekDays]);

  const shiftIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    shifts.forEach((s, idx) => map.set(s.id, idx));
    return map;
  }, [shifts]);

  const resolveShiftForEmployeeOnDate = (empId: string, dateStr: string): Shift | null => {
    const list = assignmentsByEmp[empId] || [];
    const matched = list.find(
      (a) => a.effectiveFrom <= dateStr && (!a.effectiveTo || a.effectiveTo >= dateStr),
    );
    if (matched) {
      const fromCatalog = shifts.find((s) => s.id === matched.shiftId);
      if (fromCatalog) return fromCatalog;
    }
    return defaultShift;
  };

  // Summary metrics anchored on today (or anchorIso if viewing another week)
  const focusDateStr = weekDays.some((w) => w.isToday) ? todayStr : anchorIso;
  const focusSummary = useMemo(() => {
    const focusWd = weekDays.find((w) => w.dateStr === focusDateStr);
    const isOffFocus = focusWd ? focusWd.isWeekend : false;
    let onLeave = 0;
    let present = 0;
    let scheduled = 0;

    for (const emp of filteredEmployees) {
      const leave = leaveByEmpDate.get(`${emp.id}__${focusDateStr}`);
      const rec = recordByEmpDate.get(`${emp.id}__${focusDateStr}`);
      if (leave) {
        onLeave += 1;
      } else if (!isOffFocus) {
        scheduled += 1;
      }
      if (rec && (rec.status === 'present' || rec.status === 'late' || rec.status === 'half_day')) {
        present += 1;
      }
    }

    return {
      totalEmployees: filteredEmployees.length,
      scheduled,
      present,
      onLeave,
    };
  }, [filteredEmployees, weekDays, focusDateStr, leaveByEmpDate, recordByEmpDate]);

  const openAssignModal = (
    emp: EmployeeDirectoryItem,
    dateStr: string,
    currentShift: Shift | null,
  ) => {
    setAssigningEmployee(emp);
    setAssignTargetDate(dateStr);
    setSelectedShiftId(currentShift?.id || shifts[0]?.id || '');
    setEffectiveFrom(dateStr);
    setEffectiveTo(weekEndStr);
    setAssignError(null);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningEmployee || !selectedShiftId || !effectiveFrom) return;

    try {
      setIsSubmitting(true);
      setAssignError(null);
      const created = await assignShift({
        employeeId: assigningEmployee.id,
        shiftId: selectedShiftId,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });

      setAssignmentsByEmp((prev) => ({
        ...prev,
        [assigningEmployee.id]: [created, ...(prev[assigningEmployee.id] || [])],
      }));

      setSuccessMessage(
        `Shift updated for ${assigningEmployee.firstName} ${assigningEmployee.lastName} (${effectiveFrom}${effectiveTo ? ` to ${effectiveTo}` : ' onwards'}).`,
      );
      setAssigningEmployee(null);
      onRefresh?.();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to assign shift (check for overlapping shift dates).';
      setAssignError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="attendance-roster-tab">
      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between"
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Live Current-Date Roster Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-[11px] font-semibold text-text-subtle uppercase tracking-wider block">
            Rostered Team
          </span>
          <span className="text-xl font-display font-bold text-text mt-0.5 block tabular-nums">
            {focusSummary.totalEmployees}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-[11px] font-semibold text-primary-ink uppercase tracking-wider block">
            Scheduled ({focusDateStr === todayStr ? 'Today' : focusDateStr})
          </span>
          <span className="text-xl font-display font-bold text-primary-ink mt-0.5 block tabular-nums">
            {focusSummary.scheduled}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-[11px] font-semibold text-positive-ink uppercase tracking-wider block">
            Checked In / Present
          </span>
          <span className="text-xl font-display font-bold text-positive-ink mt-0.5 block tabular-nums">
            {focusSummary.present}
          </span>
        </div>
        <div className="p-3.5 bg-surface rounded-card border border-border shadow-card">
          <span className="text-[11px] font-semibold text-warning uppercase tracking-wider block">
            On Leave
          </span>
          <span className="text-xl font-display font-bold text-warning mt-0.5 block tabular-nums">
            {focusSummary.onLeave}
          </span>
        </div>
      </div>

      {/* 2. Clean Week Controls, Search, Department & Dynamic Shift Legend */}
      <div className="flex flex-col gap-3 p-4 bg-surface border border-border rounded-card shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Week Selector (Fixed compact icon + whitespace-nowrap) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              aria-label="Previous week"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="w-9 h-9 rounded-lg border border-border bg-surface text-text hover:bg-surface-muted flex items-center justify-center transition-colors shrink-0"
            >
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-muted border border-border text-xs font-bold text-text whitespace-nowrap">
              <IconCalendar className="w-4 h-4 shrink-0 text-primary-deep" />
              <span>{weekLabel}</span>
            </div>
            <button
              type="button"
              aria-label="Next week"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="w-9 h-9 rounded-lg border border-border bg-surface text-text hover:bg-surface-muted flex items-center justify-center transition-colors shrink-0"
            >
              <IconChevronRight className="w-4 h-4" />
            </button>
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="px-2.5 py-1.5 text-xs font-semibold text-primary-ink bg-primary-soft rounded-lg hover:bg-primary/20 transition-colors"
              >
                Current Week
              </button>
            )}
          </div>

          {/* Search & Department Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="w-full sm:w-56">
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search employee or code..."
                aria-label="Search roster employees"
              />
            </div>
            <select
              aria-label="Filter Roster by Department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-input text-text outline-none hover:bg-surface-muted cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Shift Legend + Live Status Guide */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border flex-wrap text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text-subtle uppercase tracking-wider mr-1">
              Shifts:
            </span>
            {shifts.length > 0 ? (
              shifts
                .filter((s) => s.isActive)
                .map((shift, idx) => {
                  const tone = SHIFT_TONE_PALETTE[idx % SHIFT_TONE_PALETTE.length];
                  const dot = SHIFT_DOT_PALETTE[idx % SHIFT_DOT_PALETTE.length];
                  return (
                    <span
                      key={shift.id}
                      className={`inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full border ${tone}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden="true" />
                      {shift.name} ({shift.startTime}–{shift.endTime})
                    </span>
                  );
                })
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                General (09:00–18:00)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-positive-ink" aria-hidden="true" />
              Present / Active
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" aria-hidden="true" />
              On Leave
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-text-subtle" aria-hidden="true" />
              Week Off
            </span>
          </div>
        </div>
      </div>

      {/* 3. Weekly Roster Matrix */}
      <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm" aria-label="Weekly Shift Roster">
            <thead className="bg-surface-muted/70 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3.5 min-w-[210px]">
                  Employee
                </th>
                {weekDays.map((wd) => (
                  <th
                    key={wd.dateStr}
                    scope="col"
                    className={`px-2.5 py-3 text-center min-w-[128px] ${
                      wd.isToday ? 'bg-primary-soft/40 border-x border-primary-soft-border' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-bold text-text">{wd.dayName}</span>
                      {wd.isToday && (
                        <span className="px-1.5 py-0.5 rounded bg-primary text-sidebar text-[9px] font-extrabold uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                    <span className="block text-[10px] font-normal text-text-subtle font-mono mt-0.5">
                      {wd.formatted}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-3.5 text-center min-w-[90px]">
                  Scheduled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-text-muted">
                    No employees match the selected department or search filter.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  let weeklyHours = 0;

                  const dayCells = weekDays.map((wd) => {
                    const leave = leaveByEmpDate.get(`${emp.id}__${wd.dateStr}`);
                    const record = recordByEmpDate.get(`${emp.id}__${wd.dateStr}`);
                    const shift = resolveShiftForEmployeeOnDate(emp.id, wd.dateStr);
                    const shiftHours = shift ? parseShiftHours(shift.startTime, shift.endTime) : 8;

                    if (!wd.isWeekend && !leave) {
                      weeklyHours += shiftHours;
                    }

                    const shiftIdx = shift ? (shiftIndexMap.get(shift.id) ?? 0) : 0;
                    const tone = SHIFT_TONE_PALETTE[shiftIdx % SHIFT_TONE_PALETTE.length];

                    return {
                      wd,
                      leave,
                      record,
                      shift,
                      tone,
                    };
                  });

                  return (
                    <tr key={emp.id} className="hover:bg-surface-muted/30 transition-colors">
                      {/* Employee Info */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink font-bold text-xs flex items-center justify-center shrink-0">
                            {emp.firstName[0]}
                            {emp.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-text block truncate">
                              {emp.firstName} {emp.lastName}
                            </span>
                            <span className="text-[11px] text-text-muted font-mono block truncate">
                              {emp.employeeCode} • {emp.department?.name || 'General'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Day Columns */}
                      {dayCells.map(({ wd, leave, record, shift, tone }) => (
                        <td
                          key={wd.dateStr}
                          className={`px-2 py-2.5 text-center align-middle ${
                            wd.isToday
                              ? 'bg-primary-soft/15 border-x border-primary-soft-border/60'
                              : ''
                          }`}
                        >
                          {wd.isWeekend ? (
                            <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-semibold text-text-subtle bg-surface-muted/80">
                              Off
                            </span>
                          ) : leave ? (
                            <div
                              className="inline-flex flex-col items-center px-2.5 py-1 rounded-lg border bg-tile-yellow border-warning/30 text-warning text-[11px] font-semibold"
                              title={`${leave.leaveTypeName} (${leave.status})`}
                            >
                              <span>On Leave</span>
                              <span className="text-[10px] opacity-80 font-mono">
                                {leave.leaveTypeCode}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!canManageRoster || shifts.length === 0}
                              onClick={() => {
                                if (canManageRoster && shifts.length > 0) {
                                  openAssignModal(emp, wd.dateStr, shift);
                                }
                              }}
                              title={
                                canManageRoster && shifts.length > 0
                                  ? `Click to reassign shift from ${wd.dateStr}`
                                  : shift
                                    ? `${shift.name} (${shift.startTime}–${shift.endTime})`
                                    : 'Default Shift'
                              }
                              className={`w-full max-w-[132px] inline-flex flex-col items-center px-2 py-1 rounded-lg border text-[11px] transition-all ${tone} ${
                                canManageRoster && shifts.length > 0
                                  ? 'cursor-pointer hover:shadow-xs'
                                  : 'cursor-default'
                              }`}
                            >
                              <span className="font-semibold truncate max-w-full">
                                {shift ? shift.name.replace(/\s+Shift$/i, '') : 'General'}
                              </span>
                              <span className="text-[10px] opacity-80 font-mono">
                                {shift ? `${shift.startTime}–${shift.endTime}` : '09:00–18:00'}
                              </span>

                              {/* Real Attendance Status Overlay on Today & Past Days */}
                              {record ? (
                                <span
                                  className={`mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold ${
                                    record.status === 'late'
                                      ? 'text-warning'
                                      : record.status === 'absent'
                                        ? 'text-danger'
                                        : 'text-positive-ink'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      record.status === 'late'
                                        ? 'bg-warning'
                                        : record.status === 'absent'
                                          ? 'bg-danger'
                                          : 'bg-positive-ink'
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {record.checkOutTime
                                    ? 'Present'
                                    : record.status === 'late'
                                      ? 'Late In'
                                      : 'Active'}
                                </span>
                              ) : wd.isToday ? (
                                <span className="mt-0.5 text-[10px] text-text-subtle">
                                  Pending check-in
                                </span>
                              ) : wd.isPast ? (
                                <span className="mt-0.5 text-[10px] text-text-subtle">
                                  No check-in
                                </span>
                              ) : null}
                            </button>
                          )}
                        </td>
                      ))}

                      {/* Total Scheduled Hours */}
                      <td className="px-3 py-3 text-center font-bold text-text tabular-nums">
                        {Math.round(weeklyHours * 10) / 10}h
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Shift Assignment Modal */}
      {assigningEmployee && (
        <Modal
          isOpen={true}
          onClose={() => setAssigningEmployee(null)}
          title={`Assign Shift: ${assigningEmployee.firstName} ${assigningEmployee.lastName}`}
          subtitle={`${assigningEmployee.employeeCode} · Starting ${assignTargetDate}`}
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-1">
            {assignError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-negative-soft border border-border text-xs text-danger"
              >
                {assignError}
              </div>
            )}

            <div>
              <label
                htmlFor="shift-select"
                className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
              >
                Shift
              </label>
              <select
                id="shift-select"
                value={selectedShiftId}
                onChange={(e) => setSelectedShiftId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-surface border border-border rounded-input text-text outline-none"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime} – {s.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="shift-effective-from"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Effective From
                </label>
                <input
                  id="shift-effective-from"
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-surface border border-border rounded-input text-text"
                />
              </div>
              <div>
                <label
                  htmlFor="shift-effective-to"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Effective To (Optional)
                </label>
                <input
                  id="shift-effective-to"
                  type="date"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-surface border border-border rounded-input text-text"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssigningEmployee(null)}
                className="min-h-[40px] text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !selectedShiftId}
                className="min-h-[40px] text-xs font-bold"
              >
                {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
