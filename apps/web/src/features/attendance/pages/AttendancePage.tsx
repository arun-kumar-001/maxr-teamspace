import { useState, useEffect } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { ErrorState, Skeleton } from '../../../components/ui';
import { OnDutyTab } from '../components/OnDutyTab';
import { RosterTab } from '../components/RosterTab';
import { TimesheetsTab } from '../components/TimesheetsTab';
import { RequestCorrectionModal } from '../components/RequestCorrectionModal';
import { useAttendanceCorrections } from '../hooks/useAttendanceCorrections';
import { fetchTeamAttendance, fetchMyAttendanceHistory } from '../api/attendance';
import { fetchEmployeeDirectory, fetchDepartments } from '../../employees/api/employees';
import { fetchShifts, fetchAttendancePolicy } from '../../shifts/api/shifts';
import { fetchLeaveCalendar } from '../../leave/api/leave';
import type { AttendanceRecord } from '../types';
import type { EmployeeDirectoryItem, DepartmentItem } from '../../employees/types';
import type { AttendancePolicy, Shift } from '../../shifts/types';
import type { LeaveCalendarEntry } from '../../leave/types';

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysIso(baseIso: string, offsetDays: number): string {
  const dt = new Date(`${baseIso}T00:00:00`);
  dt.setDate(dt.getDate() + offsetDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface AttendancePageProps {
  initialTab?: 'on-duty' | 'roster' | 'timesheets';
}

export function AttendancePage({ initialTab = 'on-duty' }: AttendancePageProps) {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const isHr = role === ROLES.HR_MANAGER;
  const isLead = role === ROLES.TEAM_LEAD;
  const canManage = isAdmin || isHr || isLead;

  const [activeTab, setActiveTab] = useState<'on-duty' | 'roster' | 'timesheets'>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayIso());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isCreateRosterOpen, setIsCreateRosterOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  // Data states
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy | null>(null);
  const [leaveEntries, setLeaveEntries] = useState<LeaveCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Corrections hook
  const {
    isRequestModalOpen,
    selectedRecord,
    openRequestModal,
    closeRequestModal,
    refetch: refetchCorrections,
  } = useAttendanceCorrections();

  // Load all necessary real data
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch attendance records (Team/Company for Admin/HR/Lead, Me for Staff)
      const fetchRecordsPromise = canManage
        ? fetchTeamAttendance({ startDate: selectedDate, endDate: selectedDate })
        : fetchMyAttendanceHistory({ startDate: selectedDate, endDate: selectedDate });

      // 2. Auxiliary data (employees, departments, shifts, policy, leave)
      const [recRes, empRes, deptRes, shiftRes, policyRes, leaveRes] = await Promise.allSettled([
        fetchRecordsPromise,
        fetchEmployeeDirectory({ pageSize: 100 }),
        fetchDepartments(),
        fetchShifts(),
        fetchAttendancePolicy(),
        fetchLeaveCalendar(selectedDate, selectedDate),
      ]);

      if (recRes.status === 'fulfilled') {
        setRecords(recRes.value.data || []);
      }
      if (empRes.status === 'fulfilled') {
        setEmployees(empRes.value.data || []);
      }
      if (deptRes.status === 'fulfilled') {
        setDepartments(deptRes.value || []);
      }
      if (shiftRes.status === 'fulfilled') {
        setShifts(shiftRes.value || []);
      }
      if (policyRes.status === 'fulfilled') {
        setAttendancePolicy(policyRes.value || null);
      }
      if (leaveRes.status === 'fulfilled') {
        setLeaveEntries(leaveRes.value || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load attendance records';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, role]);

  // Format date display (e.g. Tue, 03 Nov 2026)
  const formattedSelectedDate = (() => {
    try {
      const d = new Date(`${selectedDate}T00:00:00`);
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  })();

  const tabSubtitle = (() => {
    if (activeTab === 'on-duty') {
      if (canManage) return 'Today – Company-wide employee attendance.';
      return 'Today – My attendance records and session details.';
    }
    if (activeTab === 'roster') {
      return 'Plan and manage employee shifts for the selected period.';
    }
    return 'Review and approve employee working hours and overtime.';
  })();

  const tabBreadcrumb = (() => {
    if (activeTab === 'on-duty') return 'On Duty';
    if (activeTab === 'roster') return 'Roster';
    return 'Timesheets';
  })();

  return (
    <div
      className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6 font-sans select-none"
      data-testid="attendance-page"
    >
      {/* 1. Header Area with Breadcrumbs, Title, Subtitle, and Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="text-xs text-text-muted flex items-center gap-1.5 font-medium">
            <span>Attendance</span>
            <span>&gt;</span>
            <span className="text-text font-semibold">{tabBreadcrumb}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display tracking-tight">
            {activeTab === 'roster'
              ? 'Roster'
              : activeTab === 'timesheets'
                ? 'Timesheets'
                : 'Attendance'}
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">{tabSubtitle}</p>
        </div>

        {activeTab === 'roster' && canManage ? (
          <button
            type="button"
            onClick={() => setIsCreateRosterOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 bg-primary-deep text-white hover:bg-primary-deep/90 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
          >
            <span className="text-base leading-none font-bold">+</span>
            <span>Create Roster</span>
          </button>
        ) : (
          /* Date Selector Dropdown */
          <div className="relative self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-surface/90 border border-border/80 shadow-xs text-xs font-semibold text-text flex items-center gap-2 hover:bg-surface transition-colors"
            >
              <span>📅</span>
              <span>{formattedSelectedDate}</span>
              <span className="text-text-muted text-[10px]">▼</span>
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 mt-2 z-20 w-56 p-2.5 bg-surface border border-border rounded-xl shadow-lg space-y-1.5">
                <span className="text-[11px] font-bold text-text-muted px-2 block">
                  Quick Date Select
                </span>
                {[
                  { label: 'Today', val: getLocalTodayIso() },
                  { label: 'Yesterday', val: addDaysIso(getLocalTodayIso(), -1) },
                  { label: '2 Days Ago', val: addDaysIso(getLocalTodayIso(), -2) },
                  { label: '3 Days Ago', val: addDaysIso(getLocalTodayIso(), -3) },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d.val);
                      setIsDatePickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedDate === d.val
                        ? 'bg-primary-soft text-primary-deep font-bold'
                        : 'text-text hover:bg-surface-muted'
                    }`}
                  >
                    <span>{d.label}</span>
                    <span className="font-mono text-[10px] text-text-muted">{d.val}</span>
                  </button>
                ))}
                <div className="pt-1.5 border-t border-border">
                  <label className="text-[10px] font-semibold text-text-muted px-1 block mb-1">
                    Pick Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedDate(e.target.value);
                        setIsDatePickerOpen(false);
                      }
                    }}
                    aria-label="Pick attendance date"
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-surface text-text"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Navigation Tabs (Exact 3 tabs: On Duty, Roster, Timesheets) */}
      <div className="border-b border-border/80 flex items-center gap-6 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('on-duty')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'on-duty'
              ? 'text-emerald-700 font-bold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <span>On Duty</span>
          {activeTab === 'on-duty' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'roster'
              ? 'text-emerald-700 font-bold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <span>Roster</span>
          {activeTab === 'roster' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('timesheets')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'timesheets'
              ? 'text-emerald-700 font-bold'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <span>Timesheets</span>
          {activeTab === 'timesheets' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}
      {isLoading ? (
        <div className="p-6 bg-surface border border-border rounded-card space-y-4">
          <Skeleton variant="rectangular" height={36} className="w-1/3" />
          <Skeleton variant="rectangular" height={100} className="w-full" />
          <Skeleton variant="rectangular" height={240} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState title="Could not load attendance data" message={error} onRetry={loadData} />
      ) : (
        <>
          {activeTab === 'on-duty' && (
            <OnDutyTab
              records={records}
              employees={employees}
              departments={departments}
              shifts={shifts}
              leaveEntries={leaveEntries}
              selectedDate={selectedDate}
              canManageAttendance={canManage}
              onRequestCorrection={(rec) => openRequestModal(rec)}
            />
          )}

          {activeTab === 'roster' && (
            <RosterTab
              employees={employees}
              departments={departments}
              shifts={shifts}
              attendancePolicy={attendancePolicy}
              selectedDate={selectedDate}
              initialRecords={records}
              initialLeaves={leaveEntries}
              canManageRoster={canManage}
              onRefresh={loadData}
              openCreateModal={isCreateRosterOpen}
              onCloseCreateModal={() => setIsCreateRosterOpen(false)}
            />
          )}

          {activeTab === 'timesheets' && (
            <TimesheetsTab
              records={records}
              employees={employees}
              departments={departments}
              canApproveTimesheets={canManage}
            />
          )}
        </>
      )}

      {/* Correction Request Modal */}
      {selectedRecord && (
        <RequestCorrectionModal
          isOpen={isRequestModalOpen}
          onClose={closeRequestModal}
          record={selectedRecord}
          onSuccess={() => {
            refetchCorrections();
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default AttendancePage;
