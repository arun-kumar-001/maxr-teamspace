import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Modal } from '../../../components/ui';
import { fetchMyAttendanceHistory, fetchTeamAttendance } from '../api/attendance';
import type { AttendanceRecord } from '../types';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';
import { fetchLeaveCalendar } from '../../leave/api/leave';
import type { LeaveCalendarEntry } from '../../leave/types';
import { assignShift, createShift, fetchEmployeeShiftAssignments } from '../../shifts/api/shifts';
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

function IconChevronDown({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <polyline points="6 9 12 15 18 9" />
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

function IconUsers({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClock({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUmbrella({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <path d="M22 12A10 10 0 0 0 2 12" />
      <path d="M12 12v8a2 2 0 0 0 4 0" />
      <path d="M12 2v1" />
    </svg>
  );
}

function IconSearch({ className = 'w-4 h-4 shrink-0' }: { className?: string }) {
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
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
  return diffMin === 540 ? 8 : Math.round((diffMin / 60) * 10) / 10;
}

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
  openCreateModal?: boolean;
  onCloseCreateModal?: () => void;
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
  openCreateModal = false,
  onCloseCreateModal,
}: RosterTabProps) {
  const todayStr = useMemo(() => toLocalIsoDate(new Date()), []);
  const anchorIso = selectedDate || todayStr;

  // View state: 'week' | 'month' (User requested Week and Month)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [monthOffset, setMonthOffset] = useState<number>(0);

  // Department collapse state
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());

  // Create Roster Bulk Modal state
  const [isCreateRosterOpen, setIsCreateRosterOpen] = useState(false);
  const [createScope, setCreateScope] = useState<'department' | 'employee'>('department');
  const [selectedTargetDept, setSelectedTargetDept] = useState<string>('');
  const [selectedTargetEmpId, setSelectedTargetEmpId] = useState<string>('');
  const [createShiftId, setCreateShiftId] = useState<string>('');
  const [createStartDate, setCreateStartDate] = useState<string>('');
  const [createEndDate, setCreateEndDate] = useState<string>('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Custom Shift Schedule fields in Create Roster Modal
  const [isCustomShift, setIsCustomShift] = useState(false);
  const [customShiftName, setCustomShiftName] = useState('Standard Shift (9 to 7)');
  const [customShiftCode, setCustomShiftCode] = useState('STANDARD');
  const [customStartTime, setCustomStartTime] = useState('09:00');
  const [customEndTime, setCustomEndTime] = useState('19:00');
  const [customGraceMinutes, setCustomGraceMinutes] = useState(15);

  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>(initialRecords);
  const [weekLeaves, setWeekLeaves] = useState<LeaveCalendarEntry[]>(initialLeaves);
  const [assignmentsByEmp, setAssignmentsByEmp] = useState<Record<string, ShiftAssignment[]>>({});

  // Individual cell shift assignment modal
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

  const fallbackDefaultShift: Shift = useMemo(
    () => ({
      id: 'standard-shift-9-to-7',
      code: 'STANDARD',
      name: 'Standard Shift (9 to 7)',
      startTime: '09:00',
      endTime: '19:00',
      graceMinutes: 15,
      isActive: true,
      crossesMidnight: false,
    }),
    [],
  );

  const defaultShift = useMemo<Shift | null>(() => {
    if (shifts.length === 0) return fallbackDefaultShift;
    if (attendancePolicy?.defaultShiftId) {
      const found = shifts.find((s) => s.id === attendancePolicy.defaultShiftId);
      if (found) return found;
    }
    const standardMatch = shifts.find(
      (s) =>
        (s.startTime?.startsWith('09') && s.endTime?.startsWith('19')) ||
        s.code.toUpperCase() === 'STANDARD',
    );
    if (standardMatch) return standardMatch;
    return shifts.find((s) => s.isActive) ?? shifts[0] ?? fallbackDefaultShift;
  }, [shifts, attendancePolicy, fallbackDefaultShift]);

  // Compute Monday..Sunday for displayed week
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

  // Compute Month days for displayed month
  const currentMonthDate = useMemo(() => {
    const anchor = new Date(`${anchorIso}T00:00:00`);
    anchor.setDate(1);
    anchor.setMonth(anchor.getMonth() + monthOffset);
    const year = anchor.getFullYear();
    const month = anchor.getMonth(); // 0-indexed
    const monthName = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const lastDayNum = new Date(year, month + 1, 0).getDate();
    const dayShorts = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const days: {
      dayName: string;
      isoWeekday: number;
      dateStr: string;
      dayNumber: number;
      isToday: boolean;
      isPast: boolean;
      isWeekend: boolean;
    }[] = [];

    for (let day = 1; day <= lastDayNum; day++) {
      const d = new Date(year, month, day);
      const iso = toLocalIsoDate(d);
      const dayOfWeek = d.getDay();
      const isoWeekday = ((dayOfWeek + 6) % 7) + 1;
      days.push({
        dayName: dayShorts[dayOfWeek] ?? '',
        isoWeekday,
        dateStr: iso,
        dayNumber: day,
        isToday: iso === todayStr,
        isPast: iso < todayStr,
        isWeekend: !workWeek.includes(isoWeekday),
      });
    }

    const startIso = days[0]?.dateStr ?? `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endIso =
      days[days.length - 1]?.dateStr ??
      `${year}-${String(month + 1).padStart(2, '0')}-${lastDayNum}`;

    return {
      year,
      month,
      monthName,
      days,
      startIso,
      endIso,
    };
  }, [anchorIso, monthOffset, todayStr, workWeek]);

  const weekStartStr = weekDays[0]?.dateStr ?? anchorIso;
  const weekEndStr = weekDays[6]?.dateStr ?? anchorIso;

  const dateNavLabel = useMemo(() => {
    if (viewMode === 'month') {
      return currentMonthDate.monthName;
    }
    if (!weekDays[0] || !weekDays[6]) return 'Current Week';
    const startStr = weekDays[0].formatted;
    const endStr = weekDays[6].formatted;
    const yr = weekDays[0].dateStr.slice(0, 4);
    return `${startStr} – ${endStr}, ${yr}`;
  }, [viewMode, currentMonthDate, weekDays]);

  // Sync external openCreateModal trigger and initialize default dates
  useEffect(() => {
    if (openCreateModal) {
      setCreateScope('department');
      setSelectedTargetDept(departments[0]?.id || '');
      setSelectedTargetEmpId(employees[0]?.id || '');
      setCreateShiftId(shifts[0]?.id || '');
      setCreateStartDate(viewMode === 'week' ? weekStartStr : currentMonthDate.startIso);
      setCreateEndDate(viewMode === 'week' ? weekEndStr : currentMonthDate.endIso);
      setIsCustomShift(false);
      setCreateError(null);
      setIsCreateRosterOpen(true);
    }
  }, [
    openCreateModal,
    departments,
    employees,
    shifts,
    viewMode,
    weekStartStr,
    weekEndStr,
    currentMonthDate,
  ]);

  // Load attendance & approved/pending leaves
  useEffect(() => {
    let active = true;
    const start = viewMode === 'week' ? weekStartStr : currentMonthDate.startIso;
    const end = viewMode === 'week' ? weekEndStr : currentMonthDate.endIso;

    const attPromise = canManageRoster
      ? fetchTeamAttendance({ startDate: start, endDate: end, pageSize: 300 })
      : fetchMyAttendanceHistory({ startDate: start, endDate: end, pageSize: 150 });

    void Promise.allSettled([attPromise, fetchLeaveCalendar(start, end)]).then(
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
  }, [weekStartStr, weekEndStr, currentMonthDate, viewMode, canManageRoster]);

  // Filter employees
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
          (emp.department?.name || '').toLowerCase().includes(q) ||
          (emp.designation?.title || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, departmentFilter, searchQuery]);

  // Load shift assignments for visible employees
  useEffect(() => {
    if (filteredEmployees.length === 0) return;
    let active = true;
    const targets = filteredEmployees.slice(0, 50);

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

  // Fast cell lookup maps
  const recordByEmpDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of weekRecords) {
      map.set(`${rec.employeeId}__${rec.workDate}`, rec);
    }
    return map;
  }, [weekRecords]);

  const leaveByEmpDate = useMemo(() => {
    const map = new Map<string, LeaveCalendarEntry>();
    const dates =
      viewMode === 'week'
        ? weekDays.map((d) => d.dateStr)
        : currentMonthDate.days.map((d) => d.dateStr);
    for (const leave of weekLeaves) {
      for (const dStr of dates) {
        if (dStr >= leave.startDate && dStr <= leave.endDate) {
          map.set(`${leave.employeeId}__${dStr}`, leave);
        }
      }
    }
    return map;
  }, [weekLeaves, weekDays, currentMonthDate, viewMode]);

  const resolveShiftForEmployeeOnDate = (empId: string, dateStr: string): Shift | null => {
    const list = assignmentsByEmp[empId] || [];
    const matched = list.find(
      (a) => a.effectiveFrom <= dateStr && (!a.effectiveTo || a.effectiveTo >= dateStr),
    );
    if (matched) {
      const fromCatalog = shifts.find((s) => s.id === matched.shiftId);
      if (fromCatalog) return fromCatalog;
    }
    return defaultShift ?? fallbackDefaultShift;
  };

  // 4 Top Metric Cards calculation
  const metrics = useMemo(() => {
    const focusDays = viewMode === 'week' ? weekDays : currentMonthDate.days;
    let totalScheduledHours = 0;
    const scheduledEmployees = new Set<string>();
    const onLeaveEmployees = new Set<string>();

    for (const emp of filteredEmployees) {
      for (const wd of focusDays) {
        const leave = leaveByEmpDate.get(`${emp.id}__${wd.dateStr}`);
        if (leave) {
          onLeaveEmployees.add(emp.id);
        } else if (!wd.isWeekend) {
          const shift = resolveShiftForEmployeeOnDate(emp.id, wd.dateStr);
          const hrs = shift ? parseShiftHours(shift.startTime, shift.endTime) : 10;
          totalScheduledHours += hrs;
          scheduledEmployees.add(emp.id);
        }
      }
    }

    return {
      teamMembers: filteredEmployees.length,
      scheduled: scheduledEmployees.size,
      totalHours: Math.round(totalScheduledHours),
      onLeave: onLeaveEmployees.size,
    };
  }, [
    filteredEmployees,
    weekDays,
    currentMonthDate,
    leaveByEmpDate,
    assignmentsByEmp,
    defaultShift,
    fallbackDefaultShift,
    shifts,
    viewMode,
  ]);

  // Department Grouping for Grid
  const departmentGroups = useMemo(() => {
    const map = new Map<string, EmployeeDirectoryItem[]>();
    for (const emp of filteredEmployees) {
      const deptName = emp.department?.name || 'Operations';
      if (!map.has(deptName)) {
        map.set(deptName, []);
      }
      map.get(deptName)!.push(emp);
    }
    return Array.from(map.entries()).map(([deptName, emps]) => ({
      deptName,
      employees: emps,
    }));
  }, [filteredEmployees]);

  const toggleDeptCollapse = (deptName: string) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) {
        next.delete(deptName);
      } else {
        next.add(deptName);
      }
      return next;
    });
  };

  // Helper for Shift styling & categorization (compact, executive, MaxR Flow tokens)
  const getShiftCellConfig = (shift: Shift | null, isLeave: boolean, isWeekend: boolean) => {
    if (isWeekend) {
      return {
        isOff: true,
        isLeave: false,
        isCustom: false,
        className: 'bg-surface-muted/20 text-text-muted/50 border-transparent',
        badge: 'Off',
        timing: '',
      };
    }
    if (isLeave) {
      return {
        isOff: false,
        isLeave: true,
        isCustom: false,
        className: 'bg-amber-50 text-amber-900 border border-amber-200/80 hover:bg-amber-100/70',
        badge: 'On Leave',
        timing: '',
      };
    }

    const effective = shift ?? fallbackDefaultShift;
    const start = effective.startTime.slice(0, 5);
    const end = effective.endTime.slice(0, 5);
    const timing = `${start} – ${end}`;
    const isStandard =
      (start === '09:00' && end === '19:00') ||
      effective.code.toUpperCase() === 'STANDARD';

    if (isStandard) {
      return {
        isOff: false,
        isLeave: false,
        isCustom: false,
        className:
          'bg-surface-muted/60 text-text border border-border/80 hover:bg-primary-soft hover:border-primary-strong/30 hover:text-primary-ink',
        badge: '09:00 – 19:00',
        timing: '09:00 – 19:00',
      };
    }

    return {
      isOff: false,
      isLeave: false,
      isCustom: true,
      className:
        'bg-purple-50 text-purple-900 border border-purple-200/80 hover:bg-purple-100/80',
      badge: effective.name || timing,
      timing,
    };
  };

  // Handlers for individual shift assign
  const openAssignModal = (
    emp: EmployeeDirectoryItem,
    dateStr: string,
    currentShift: Shift | null,
  ) => {
    setAssigningEmployee(emp);
    setAssignTargetDate(dateStr);
    setSelectedShiftId(currentShift?.id || shifts[0]?.id || '');
    setEffectiveFrom(dateStr);
    setEffectiveTo(viewMode === 'week' ? weekEndStr : currentMonthDate.endIso);
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
        err instanceof Error ? err.message : 'Unable to assign shift (check for date overlap).';
      setAssignError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeBulkCreateModal = () => {
    setIsCreateRosterOpen(false);
    onCloseCreateModal?.();
  };

  // Handle Bulk Create Shift (supporting both predefined & customized shifts)
  const handleBulkCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createStartDate) return;

    try {
      setIsBulkSubmitting(true);
      setCreateError(null);

      let finalShiftId = createShiftId;

      // If custom shift is chosen, create it dynamically
      if (isCustomShift) {
        if (!customShiftName || !customStartTime || !customEndTime) {
          throw new Error('Please fill all custom shift schedule fields.');
        }
        const createdNewShift = await createShift({
          code: customShiftCode.trim().toUpperCase() || `CUSTOM_${Date.now() % 10000}`,
          name: customShiftName.trim(),
          startTime: customStartTime,
          endTime: customEndTime,
          graceMinutes: Number(customGraceMinutes) || 15,
        });
        finalShiftId = createdNewShift.id;
      }

      if (!finalShiftId) {
        throw new Error('Please select or configure a shift schedule.');
      }

      let targetEmpList: EmployeeDirectoryItem[] = [];
      if (createScope === 'department') {
        const dept = departments.find((d) => d.id === selectedTargetDept);
        targetEmpList = employees.filter(
          (emp) => emp.department?.id === selectedTargetDept || emp.department?.name === dept?.name,
        );
        if (targetEmpList.length === 0) {
          throw new Error('No employees found in the selected department.');
        }
      } else {
        const found = employees.find((emp) => emp.id === selectedTargetEmpId);
        if (found) targetEmpList = [found];
      }

      for (const emp of targetEmpList) {
        try {
          const res = await assignShift({
            employeeId: emp.id,
            shiftId: finalShiftId,
            effectiveFrom: createStartDate,
            effectiveTo: createEndDate || null,
          });
          setAssignmentsByEmp((prev) => ({
            ...prev,
            [emp.id]: [res, ...(prev[emp.id] || [])],
          }));
        } catch {
          // Continue if individual assignment fails
        }
      }

      setSuccessMessage(
        `Roster schedule created successfully for ${targetEmpList.length} employee(s).`,
      );
      closeBulkCreateModal();
      onRefresh?.();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create roster shifts.';
      setCreateError(msg);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 select-none" data-testid="attendance-roster-tab">
      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Four Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Team Members */}
        <div className="p-5 bg-white border border-border/80 rounded-card shadow-xs flex items-center justify-between hover:-translate-y-0.5 hover:shadow-card transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-muted block">Team Members</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-text font-display tabular-nums tracking-tight block">
              {metrics.teamMembers}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
            <IconUsers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Scheduled */}
        <div className="p-5 bg-white border border-border/80 rounded-card shadow-xs flex items-center justify-between hover:-translate-y-0.5 hover:shadow-card transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-muted block">Scheduled</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-text font-display tabular-nums tracking-tight block">
              {metrics.scheduled}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
            <IconCalendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Hours */}
        <div className="p-5 bg-white border border-border/80 rounded-card shadow-xs flex items-center justify-between hover:-translate-y-0.5 hover:shadow-card transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-muted block">Total Hours</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-text font-display tabular-nums tracking-tight block">
              {metrics.totalHours.toLocaleString()}h
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 shadow-xs">
            <IconClock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: On Leave */}
        <div className="p-5 bg-white border border-border/80 rounded-card shadow-xs flex items-center justify-between hover:-translate-y-0.5 hover:shadow-card transition-all">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-text-muted block">On Leave</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-text font-display tabular-nums tracking-tight block">
              {metrics.onLeave}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <IconUmbrella className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Control Bar: View Switcher (Week / Month), Date Navigator with Directional Jump, Department Filter, and Search */}
      <div className="p-3 sm:p-4 bg-white rounded-card border border-border/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Left: View Mode Pills (Week / Month) */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-surface-muted border border-border/80">
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'week'
                  ? 'bg-primary-deep text-white shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <IconCalendar className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                viewMode === 'month'
                  ? 'bg-primary-deep text-white shadow-xs'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <IconCalendar className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
          </div>
        </div>

        {/* Center: Date Range Navigator with Proper Left / Right Directional Jump */}
        <div className="flex items-center justify-center gap-2">
          {/* If navigated to FUTURE (offset > 0), show jump button on the LEFT pointing back ← */}
          {((viewMode === 'week' && weekOffset > 0) ||
            (viewMode === 'month' && monthOffset > 0)) && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setMonthOffset(0);
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-primary-deep bg-primary-soft hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
            >
              <span>←</span>
              <span>{viewMode === 'week' ? 'Current Week' : 'Current Month'}</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Previous"
            onClick={() => {
              if (viewMode === 'week') setWeekOffset((p) => p - 1);
              else setMonthOffset((p) => p - 1);
            }}
            className="w-8 h-8 rounded-lg border border-border/80 bg-white hover:bg-surface-muted text-text flex items-center justify-center transition-colors shrink-0 shadow-xs"
          >
            <IconChevronLeft className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-border/80 text-xs font-bold text-text whitespace-nowrap shadow-xs">
            <IconCalendar className="w-3.5 h-3.5 text-text-muted" />
            <span>{dateNavLabel}</span>
          </div>

          <button
            type="button"
            aria-label="Next"
            onClick={() => {
              if (viewMode === 'week') setWeekOffset((p) => p + 1);
              else setMonthOffset((p) => p + 1);
            }}
            className="w-8 h-8 rounded-lg border border-border/80 bg-white hover:bg-surface-muted text-text flex items-center justify-center transition-colors shrink-0 shadow-xs"
          >
            <IconChevronRight className="w-4 h-4" />
          </button>

          {/* If navigated to PAST (offset < 0), show jump button on the RIGHT pointing forward → */}
          {((viewMode === 'week' && weekOffset < 0) ||
            (viewMode === 'month' && monthOffset < 0)) && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setMonthOffset(0);
              }}
              className="px-2.5 py-1 text-[11px] font-bold text-primary-deep bg-primary-soft hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
            >
              <span>{viewMode === 'week' ? 'Current Week' : 'Current Month'}</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* Right: Department Filter and Search Input ONLY (No duplicate Create Roster button) */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            aria-label="Filter Roster by Department"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-white border border-border/80 rounded-xl text-text outline-none hover:bg-surface-muted cursor-pointer transition-colors shadow-xs"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <IconSearch className="w-3.5 h-3.5" />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee..."
              aria-label="Search roster employees"
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-border/80 text-text placeholder:text-text-muted outline-none focus:border-primary-deep transition-colors shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Roster Grid: Compact, Perfectly Aligned Table (100% width, No Horizontal Scroll) */}
      {viewMode === 'week' ? (
        <div className="bg-white rounded-card border border-border/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table
              className="w-full text-left text-xs sm:text-sm border-collapse"
              aria-label="Attendance Shift Roster Grid"
            >
              <colgroup>
                <col className="w-[23%] min-w-[170px]" />
                {weekDays.map((wd) => (
                  <col key={wd.dateStr} className="w-[11%]" />
                ))}
              </colgroup>

              <thead className="bg-surface-muted/60 border-b border-border/80 text-xs font-bold text-text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold text-text">
                    Employee
                  </th>
                  {weekDays.map((wd) => (
                    <th
                      key={wd.dateStr}
                      scope="col"
                      className={`px-1 py-2.5 text-center transition-colors ${
                        wd.isToday
                          ? 'bg-primary-soft/50 text-primary-ink font-bold'
                          : 'text-text-muted'
                      }`}
                    >
                      <div className="font-bold text-text flex items-center justify-center gap-1">
                        <span>{wd.dayName}</span>
                      </div>
                      <span
                        className={`block text-[11px] font-normal mt-0.5 ${
                          wd.isToday ? 'text-primary-ink font-semibold' : 'text-text-muted'
                        }`}
                      >
                        {wd.formatted}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60 text-text">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-xs text-text-muted">
                      No employees match the selected department or search filter.
                    </td>
                  </tr>
                ) : (
                  departmentGroups.map(({ deptName, employees: deptEmps }) => {
                    const isCollapsed = collapsedDepts.has(deptName);
                    return (
                      <Fragment key={deptName}>
                        {/* Collapsible Department Header */}
                        <tr
                          onClick={() => toggleDeptCollapse(deptName)}
                          className="bg-surface-muted/40 hover:bg-surface-muted/60 cursor-pointer transition-colors border-y border-border/80"
                        >
                          <td colSpan={8} className="px-4 py-2.5">
                            <div className="flex items-center gap-2 text-xs font-bold text-text">
                              <span
                                className={`transition-transform duration-200 ${
                                  isCollapsed ? '-rotate-90' : 'rotate-0'
                                }`}
                              >
                                <IconChevronDown className="w-3.5 h-3.5 text-text-muted" />
                              </span>
                              <IconUsers className="w-3.5 h-3.5 text-primary-deep" />
                              <span>{deptName}</span>
                              <span className="text-text-muted font-normal text-[11px]">
                                ({deptEmps.length})
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Department Employees Rows */}
                        {!isCollapsed &&
                          deptEmps.map((emp) => {
                            return (
                              <tr
                                key={emp.id}
                                className="hover:bg-surface-muted/20 transition-colors border-b border-border/40"
                              >
                                {/* Employee Profile Cell */}
                                <td className="px-4 py-2.5 align-middle">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-surface-muted text-text font-bold text-xs flex items-center justify-center shrink-0 border border-border/80 shadow-xs">
                                      {emp.firstName[0]}
                                      {emp.lastName[0]}
                                    </div>
                                    <div className="min-w-0 truncate">
                                      <span className="font-semibold text-text block truncate text-xs sm:text-sm">
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      <span className="text-[11px] text-text-muted block truncate font-normal">
                                        {emp.designation?.title || emp.employeeCode}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Day Shift Cells: Compact, uniform 32px height, perfectly aligned */}
                                {weekDays.map((wd) => {
                                  const leave = leaveByEmpDate.get(`${emp.id}__${wd.dateStr}`);
                                  const record = recordByEmpDate.get(`${emp.id}__${wd.dateStr}`);
                                  const shift = resolveShiftForEmployeeOnDate(emp.id, wd.dateStr);
                                  const cellConfig = getShiftCellConfig(
                                    shift,
                                    !!leave,
                                    wd.isWeekend,
                                  );

                                  return (
                                    <td
                                      key={wd.dateStr}
                                      className={`px-1 py-2 text-center align-middle transition-colors ${
                                        wd.isToday ? 'bg-primary-soft/30' : ''
                                      }`}
                                    >
                                      {cellConfig.isOff ? (
                                        <div className="h-8 w-full max-w-[100px] mx-auto rounded-lg flex items-center justify-center text-text-muted/50 bg-surface-muted/20 text-xs font-medium select-none">
                                          Off
                                        </div>
                                      ) : cellConfig.isLeave ? (
                                        <div className="h-8 w-full max-w-[100px] mx-auto rounded-lg flex items-center justify-center bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-semibold select-none">
                                          On Leave
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={!canManageRoster}
                                          onClick={() => {
                                            if (canManageRoster) {
                                              openAssignModal(emp, wd.dateStr, shift);
                                            }
                                          }}
                                          title={
                                            canManageRoster
                                              ? `Click to change shift for ${emp.firstName} on ${wd.dateStr} (${cellConfig.timing})`
                                              : `${cellConfig.timing} Shift`
                                          }
                                          className={`h-8 w-full max-w-[100px] mx-auto rounded-lg flex items-center justify-center gap-1.5 px-2 transition-all text-xs font-semibold tabular-nums ${
                                            cellConfig.className
                                          } ${
                                            canManageRoster
                                              ? 'cursor-pointer hover:shadow-xs'
                                              : 'cursor-default'
                                          }`}
                                        >
                                          <span className="truncate text-[11px] leading-tight">
                                            {cellConfig.timing}
                                          </span>
                                          {record && (
                                            <span
                                              title={`Status: ${record.status}`}
                                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                record.status === 'late'
                                                  ? 'bg-warning'
                                                  : record.status === 'absent'
                                                    ? 'bg-danger'
                                                    : 'bg-emerald-600'
                                              }`}
                                            />
                                          )}
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Month View: Full 30-Day Matrix with Fixed Column Widths and Sticky Employee Column */
        <div className="bg-white rounded-card border border-border/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-xs border-collapse table-fixed"
              aria-label="Monthly Attendance Shift Grid"
            >
              <colgroup>
                <col className="w-[240px] min-w-[240px] max-w-[240px]" />
                {currentMonthDate.days.map((d) => (
                  <col key={d.dateStr} className="w-[68px] min-w-[68px] max-w-[68px]" />
                ))}
                <col className="w-[84px] min-w-[84px] max-w-[84px]" />
              </colgroup>

              <thead className="bg-surface-muted/80 border-b border-border/80 font-bold text-text-muted sticky top-0 z-20">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3.5 sticky left-0 bg-surface-muted z-30 w-[240px] min-w-[240px] max-w-[240px] border-r border-border/80 font-bold text-text shadow-[2px_0_6px_-1px_rgba(0,0,0,0.08)]"
                  >
                    Employee
                  </th>
                  {currentMonthDate.days.map((d) => (
                    <th
                      key={d.dateStr}
                      scope="col"
                      className={`px-1 py-2.5 text-center w-[68px] min-w-[68px] max-w-[68px] border-r border-border/40 ${
                        d.isToday
                          ? 'bg-emerald-50 text-emerald-800 font-extrabold border-x border-emerald-200/80'
                          : d.isWeekend
                            ? 'bg-surface-muted/40 text-text-subtle'
                            : 'text-text'
                      }`}
                    >
                      <span className="block text-[10px] text-text-muted font-normal">
                        {d.dayName}
                      </span>
                      <span className="block text-xs font-bold">{d.dayNumber}</span>
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-2 py-3 text-center w-[84px] min-w-[84px] max-w-[84px] font-bold text-text bg-surface-muted/90"
                  >
                    Hours
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60 text-text">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={currentMonthDate.days.length + 2}
                      className="px-6 py-12 text-center text-xs text-text-muted"
                    >
                      No employees match the filters.
                    </td>
                  </tr>
                ) : (
                  departmentGroups.map(({ deptName, employees: deptEmps }) => {
                    const isCollapsed = collapsedDepts.has(deptName);
                    return (
                      <Fragment key={deptName}>
                        {/* Collapsible Department Header with Pinned Sticky Title */}
                        <tr
                          onClick={() => toggleDeptCollapse(deptName)}
                          className="bg-surface-muted/50 hover:bg-surface-muted/80 cursor-pointer transition-colors border-y border-border/80"
                        >
                          <td
                            colSpan={currentMonthDate.days.length + 2}
                            className="p-0 bg-surface-muted/40"
                          >
                            <div className="sticky left-0 w-[240px] px-4 py-2.5 flex items-center gap-2 text-xs font-extrabold text-text bg-surface-muted z-20 border-r border-border/80 shadow-[2px_0_6px_-1px_rgba(0,0,0,0.08)]">
                              <span
                                className={`transition-transform duration-200 ${
                                  isCollapsed ? '-rotate-90' : 'rotate-0'
                                }`}
                              >
                                <IconChevronDown className="w-3.5 h-3.5 text-text-muted" />
                              </span>
                              <IconUsers className="w-3.5 h-3.5 text-primary-deep shrink-0" />
                              <span className="truncate">{deptName}</span>
                              <span className="text-text-muted font-normal text-[11px] shrink-0">
                                ({deptEmps.length})
                              </span>
                            </div>
                          </td>
                        </tr>

                        {!isCollapsed &&
                          deptEmps.map((emp) => {
                            let monthlyHours = 0;
                            return (
                              <tr
                                key={emp.id}
                                className="hover:bg-surface-muted/20 transition-colors border-b border-border/40"
                              >
                                {/* Sticky Employee Column */}
                                <td className="px-4 py-2.5 sticky left-0 bg-white z-20 w-[240px] min-w-[240px] max-w-[240px] border-r border-border/80 shadow-[2px_0_6px_-1px_rgba(0,0,0,0.08)]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold text-[11px] flex items-center justify-center shrink-0 border border-border/60">
                                      {emp.firstName[0]}
                                      {emp.lastName[0]}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-bold text-text block truncate text-xs">
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      <span className="text-[10px] text-text-muted block truncate font-medium">
                                        {emp.designation?.title || emp.employeeCode}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Day Cells for Month (Neat rounded pill badges) */}
                                {currentMonthDate.days.map((d) => {
                                  const leave = leaveByEmpDate.get(`${emp.id}__${d.dateStr}`);
                                  const shift = resolveShiftForEmployeeOnDate(emp.id, d.dateStr);
                                  const cellConfig = getShiftCellConfig(
                                    shift,
                                    !!leave,
                                    d.isWeekend,
                                  );

                                  if (!d.isWeekend && !leave) {
                                    const h = shift
                                      ? parseShiftHours(shift.startTime, shift.endTime)
                                      : 8;
                                    monthlyHours += h;
                                  }

                                  return (
                                    <td
                                      key={d.dateStr}
                                      className={`px-1 py-1.5 text-center align-middle border-r border-border/30 w-[68px] min-w-[68px] max-w-[68px] ${
                                        d.isToday
                                          ? 'bg-emerald-50/25 border-x border-emerald-200/40'
                                          : ''
                                      }`}
                                    >
                                      {cellConfig.isOff ? (
                                        <div className="h-[34px] w-[58px] mx-auto rounded-lg flex items-center justify-center text-[10px] font-semibold text-slate-300">
                                          Off
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={!canManageRoster}
                                          onClick={() => {
                                            if (canManageRoster) {
                                              openAssignModal(emp, d.dateStr, shift);
                                            }
                                          }}
                                          title={`${emp.firstName}: ${cellConfig.badge} (${cellConfig.timing || ''}) on ${d.dateStr}`}
                                          className={`h-[34px] w-[58px] mx-auto rounded-lg text-[10px] font-bold flex items-center justify-center transition-all ${
                                            cellConfig.className
                                          } ${
                                            canManageRoster
                                              ? 'cursor-pointer hover:scale-105 hover:shadow-xs'
                                              : 'cursor-default'
                                          }`}
                                        >
                                          {cellConfig.badge.includes('09:00') ||
                                          cellConfig.badge === 'General' ||
                                          cellConfig.badge === 'Standard'
                                            ? '9–7'
                                            : cellConfig.badge}
                                        </button>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Monthly Total Hours */}
                                <td className="px-2 py-2 text-center font-bold text-xs font-mono text-text tabular-nums w-[84px] min-w-[84px] max-w-[84px]">
                                  {Math.round(monthlyHours)}h
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Bottom Legend Bar */}
      <div className="p-4 bg-white rounded-card border border-border/80 shadow-xs flex items-center gap-6 flex-wrap text-xs font-medium text-text">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Day Shift (06:00 – 14:00)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" />
          <span>General (09:00 – 18:00)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
          <span>Night Shift (14:00 – 22:00)</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <span>Off</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span>Leave</span>
        </div>
      </div>

      {/* 5. Create Roster Modal with Full Custom Shift Schedule Support */}
      {isCreateRosterOpen && (
        <Modal
          isOpen={true}
          onClose={closeBulkCreateModal}
          title="Create Roster"
          subtitle="Plan and manage employee shifts for the selected period."
        >
          <form onSubmit={handleBulkCreateSubmit} className="space-y-4 pt-2">
            {createError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-negative-soft border border-border text-xs text-danger font-semibold"
              >
                {createError}
              </div>
            )}

            {/* Scope Selection: Department vs Employee */}
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                Assignment Scope
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateScope('department')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    createScope === 'department'
                      ? 'bg-primary-soft text-primary-deep border-primary-deep'
                      : 'bg-surface border-border text-text hover:bg-surface-muted'
                  }`}
                >
                  Entire Department
                </button>
                <button
                  type="button"
                  onClick={() => setCreateScope('employee')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    createScope === 'employee'
                      ? 'bg-primary-soft text-primary-deep border-primary-deep'
                      : 'bg-surface border-border text-text hover:bg-surface-muted'
                  }`}
                >
                  Individual Employee
                </button>
              </div>
            </div>

            {/* Target Select */}
            {createScope === 'department' ? (
              <div>
                <label
                  htmlFor="target-dept-select"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Select Department
                </label>
                <select
                  id="target-dept-select"
                  value={selectedTargetDept}
                  onChange={(e) => setSelectedTargetDept(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (
                      {
                        employees.filter(
                          (e) => e.department?.id === d.id || e.department?.name === d.name,
                        ).length
                      }{' '}
                      employees)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="target-emp-select"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Select Employee
                </label>
                <select
                  id="target-emp-select"
                  value={selectedTargetEmpId}
                  onChange={(e) => setSelectedTargetEmpId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} ({e.employeeCode}) —{' '}
                      {e.department?.name || 'General'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Shift Schedule with Custom Option */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="create-shift-select"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider"
                >
                  Shift Schedule
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomShift((prev) => !prev)}
                  className="text-xs font-bold text-primary-deep hover:underline"
                >
                  {isCustomShift ? '← Use Standard Shift' : '+ Customize Shift Schedule'}
                </button>
              </div>

              {!isCustomShift ? (
                <select
                  id="create-shift-select"
                  value={createShiftId}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomShift(true);
                    } else {
                      setCreateShiftId(e.target.value);
                    }
                  }}
                  className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)})
                    </option>
                  ))}
                  <option value="custom">⚙️ + Customize Custom Shift...</option>
                </select>
              ) : (
                /* Custom Shift Schedule Form */
                <div className="p-3.5 rounded-xl border border-primary-deep/40 bg-primary-soft/30 space-y-3">
                  <span className="text-xs font-extrabold text-primary-deep block">
                    Custom Shift Schedule Details
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Shift Name
                      </label>
                      <input
                        type="text"
                        required
                        value={customShiftName}
                        onChange={(e) => {
                          setCustomShiftName(e.target.value);
                          setCustomShiftCode(
                            e.target.value.replace(/\s+/g, '_').toUpperCase().slice(0, 10),
                          );
                        }}
                        placeholder="e.g. Early Morning, Flexi Shift"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Shift Code
                      </label>
                      <input
                        type="text"
                        required
                        value={customShiftCode}
                        onChange={(e) => setCustomShiftCode(e.target.value.toUpperCase())}
                        placeholder="e.g. EARLY_MORN"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-surface text-text font-mono uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        required
                        value={customStartTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-surface text-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        required
                        value={customEndTime}
                        onChange={(e) => setCustomEndTime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-surface text-text font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Grace (Mins)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={customGraceMinutes}
                        onChange={(e) => setCustomGraceMinutes(Number(e.target.value))}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-surface text-text"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date Range: Guaranteed YYYY-MM-DD Default Values */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="create-date-start"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Effective From
                </label>
                <input
                  id="create-date-start"
                  type="date"
                  required
                  value={createStartDate}
                  onChange={(e) => setCreateStartDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="create-date-end"
                  className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
                >
                  Effective To (Optional)
                </label>
                <input
                  id="create-date-end"
                  type="date"
                  value={createEndDate}
                  onChange={(e) => setCreateEndDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeBulkCreateModal}
                className="min-h-[40px] text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  isBulkSubmitting || (!isCustomShift && !createShiftId) || !createStartDate
                }
                className="min-h-[40px] text-xs font-bold rounded-xl bg-primary-deep text-white hover:bg-primary-deep/90 shadow-xs"
              >
                {isBulkSubmitting ? 'Creating Roster...' : 'Create Roster Shifts'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 6. Individual Shift Assignment Modal (Quick Edit via Cell Click) */}
      {assigningEmployee && (
        <Modal
          isOpen={true}
          onClose={() => setAssigningEmployee(null)}
          title={`Assign Shift: ${assigningEmployee.firstName} ${assigningEmployee.lastName}`}
          subtitle={`${assigningEmployee.employeeCode} · Target Date: ${assignTargetDate}`}
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-1">
            {assignError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-negative-soft border border-border text-xs text-danger font-semibold"
              >
                {assignError}
              </div>
            )}

            <div>
              <label
                htmlFor="shift-select"
                className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1"
              >
                Shift Schedule
              </label>
              <select
                id="shift-select"
                value={selectedShiftId}
                onChange={(e) => setSelectedShiftId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
              >
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)})
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
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
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
                  className="w-full min-h-[40px] px-3 py-1.5 text-xs font-semibold bg-surface border border-border rounded-xl text-text outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssigningEmployee(null)}
                className="min-h-[40px] text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !selectedShiftId}
                className="min-h-[40px] text-xs font-bold rounded-xl bg-primary-deep text-white hover:bg-primary-deep/90 shadow-xs"
              >
                {isSubmitting ? 'Saving...' : 'Confirm Assignment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
