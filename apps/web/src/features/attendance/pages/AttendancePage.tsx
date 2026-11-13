import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { ErrorState, Skeleton } from '../../../components/ui';
import {
  fetchMyAttendanceHistory,
  fetchTeamAttendance,
  fetchTodayAttendance,
} from '../api/attendance';
import { CheckInOutTab } from '../components/CheckInOutTab';
import { LeaveRequestsTab } from '../components/LeaveRequestsTab';
import { MyAttendanceTab } from '../components/MyAttendanceTab';
import { OnDutyTab } from '../components/OnDutyTab';
import { RequestCorrectionModal } from '../components/RequestCorrectionModal';
import { RosterTab } from '../components/RosterTab';
import { TeamCalendarTab } from '../components/TeamCalendarTab';
import { TimesheetsTab } from '../components/TimesheetsTab';
import { useAttendanceCorrections } from '../hooks/useAttendanceCorrections';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import { fetchDepartments, fetchEmployeeDirectory } from '../../employees/api/employees';
import type { DepartmentItem, EmployeeDirectoryItem } from '../../employees/types';
import { fetchLeaveCalendar } from '../../leave/api/leave';
import type { LeaveCalendarEntry } from '../../leave/types';
import { fetchAttendancePolicy, fetchShifts } from '../../shifts/api/shifts';
import type { AttendancePolicy, Shift } from '../../shifts/types';
import type { AttendanceRecord, TodayAttendanceSummary } from '../types';

export type AttendanceManagementTab =
  'my-attendance' | 'check-in' | 'leave-requests' | 'team-calendar';

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
  initialTab?: 'on-duty' | 'roster' | 'timesheets' | AttendanceManagementTab;
}

const SUB_TABS: Array<{ id: AttendanceManagementTab; label: string }> = [
  { id: 'my-attendance', label: 'My Attendance' },
  { id: 'check-in', label: 'Check-In / Check-Out' },
];

function EmployeeAttendanceWorkspace({
  defaultTab = 'my-attendance',
}: {
  defaultTab?: AttendanceManagementTab;
}) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AttendanceManagementTab>(defaultTab);
  const [todaySummary, setTodaySummary] = useState<TodayAttendanceSummary | null>(null);

  const canViewTeam = Boolean(
    user &&
    (user.role === ROLES.TEAM_LEAD || user.role === ROLES.HR_MANAGER || user.role === ROLES.ADMIN),
  );

  const loadTodaySummary = useCallback(async () => {
    try {
      const summary = await fetchTodayAttendance();
      setTodaySummary(summary);
    } catch {
      // Non-fatal on summary banner; widget handles explicit session errors
    }
  }, []);

  useEffect(() => {
    void loadTodaySummary();
  }, [loadTodaySummary]);

  const {
    records,
    meta,
    isLoading,
    error,
    scope,
    setScope,
    displayMode,
    setDisplayMode,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    status,
    setStatus,
    page,
    setPage,
    sortBy,
    sortOrder,
    setSorting,
    resetFilters,
    refresh,
  } = useAttendanceHistory({
    initialScope: 'own',
    initialDisplayMode: 'list',
    pageSize: 10,
  });

  const {
    corrections,
    meta: correctionsMeta,
    isLoading: isCorrectionsLoading,
    error: correctionsError,
    page: correctionsPage,
    setPage: setCorrectionsPage,
    refetch: refetchCorrections,
    isRequestModalOpen,
    selectedRecord,
    openRequestModal,
    closeRequestModal,
    handleCancel,
  } = useAttendanceCorrections();

  return (
    <div
      className="relative rounded-[24px] p-4 sm:p-6 md:p-7 border space-y-5 bg-white"
      style={{
        backgroundColor: 'rgb(255, 255, 255)',
        borderColor: 'rgb(229, 231, 235)',
        boxShadow: '0 4px 24px rgba(8, 11, 12, 0.04)',
      }}
      data-testid="attendance-page"
    >
      {/* Top Clean White Header & Sub-Navigation */}
      <div
        className="pb-4 border-b space-y-4"
        style={{
          borderColor: 'rgb(229, 231, 235)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'rgb(13, 148, 136)' }}
            >
              MAXR TEAMSPACE WORKFORCE HUB
            </p>
            <h1
              className="text-xl sm:text-2xl font-bold font-display mt-0.5"
              style={{ color: 'rgb(8, 11, 12)' }}
            >
              Attendance Management
            </h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'rgb(79, 92, 90)' }}>
              Track your attendance, manage check-in/out, leaves and view team attendance.
            </p>
          </div>
        </div>

        {/* 4 Mint-Teal Sub-Navigation Tabs */}
        <nav
          aria-label="Attendance sections"
          className="flex flex-wrap gap-2"
          data-testid="attendance-subnav"
        >
          {SUB_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold min-h-[42px] transition-all cursor-pointer border"
                style={
                  active
                    ? {
                        backgroundColor: 'rgb(85, 205, 179)',
                        borderColor: 'rgb(85, 205, 179)',
                        color: 'rgb(8, 11, 12)',
                        boxShadow: '0 2px 8px rgba(85, 205, 179, 0.25)',
                      }
                    : {
                        backgroundColor: 'rgb(255, 255, 255)',
                        borderColor: 'rgb(229, 231, 235)',
                        color: 'rgb(8, 11, 12)',
                      }
                }
                aria-current={active ? 'page' : undefined}
                data-testid={`attendance-tab-${tab.id}`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'my-attendance' && (
        <MyAttendanceTab
          records={records}
          meta={meta}
          isLoading={isLoading}
          error={error}
          scope={scope}
          setScope={setScope}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          status={status}
          setStatus={setStatus}
          page={page}
          setPage={setPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          setSorting={setSorting}
          resetFilters={resetFilters}
          refresh={refresh}
          canViewTeam={canViewTeam}
          todaySummary={todaySummary}
          corrections={corrections}
          correctionsMeta={correctionsMeta}
          isCorrectionsLoading={isCorrectionsLoading}
          correctionsError={correctionsError}
          correctionsPage={correctionsPage}
          setCorrectionsPage={setCorrectionsPage}
          onCancelCorrection={handleCancel}
          onRefetchCorrections={refetchCorrections}
          onOpenCorrectionModal={openRequestModal}
          onGoToCheckIn={() => setActiveTab('check-in')}
        />
      )}

      {activeTab === 'check-in' && (
        <CheckInOutTab
          employeeName={user?.name}
          designation={user?.title ?? user?.role}
          records={records}
          onSessionChange={() => {
            void refresh();
            void loadTodaySummary();
          }}
          onViewAllHistory={() => setActiveTab('my-attendance')}
        />
      )}

      {activeTab === 'leave-requests' && <LeaveRequestsTab />}

      {activeTab === 'team-calendar' && <TeamCalendarTab />}

      {/* Correction Request Modal */}
      <RequestCorrectionModal
        isOpen={isRequestModalOpen}
        onClose={closeRequestModal}
        record={selectedRecord}
        onSuccess={() => {
          refetchCorrections();
          void refresh();
        }}
      />
    </div>
  );
}

function AttendanceOpsWorkspace({
  initialTab = 'on-duty',
}: {
  initialTab: 'on-duty' | 'roster' | 'timesheets';
}) {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const isHr = role === ROLES.HR_MANAGER;
  const isLead = role === ROLES.TEAM_LEAD;
  const canManage = isAdmin || isHr || isLead;

  const [activeTab, setActiveTab] = useState<'on-duty' | 'roster' | 'timesheets'>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalTodayIso());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  const {
    isRequestModalOpen,
    selectedRecord,
    openRequestModal,
    closeRequestModal,
    refetch: refetchCorrections,
  } = useAttendanceCorrections();

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

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
  }, [canManage, selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData, role]);

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
      if (canManage) return 'Today \u2013 Company-wide employee attendance.';
      return 'Today \u2013 My attendance records and session details.';
    }
    if (activeTab === 'roster') {
      return 'Weekly shift schedules and employee assignments.';
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="text-xs text-text-muted flex items-center gap-1.5 font-medium">
            <span>Attendance</span>
            <span>&gt;</span>
            <span className="text-text font-semibold">{tabBreadcrumb}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display tracking-tight">
            Attendance
          </h1>
          <p className="text-xs sm:text-sm text-text-muted">{tabSubtitle}</p>
        </div>

        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-surface/90 border border-border/80 shadow-xs text-xs font-semibold text-text flex items-center gap-2 hover:bg-surface transition-colors"
          >
            <span>{formattedSelectedDate}</span>
            <span className="text-text-muted text-[10px]">&#9660;</span>
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
      </div>

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

      {isLoading ? (
        <div className="p-6 bg-surface border border-border rounded-card space-y-4">
          <Skeleton variant="rectangular" height={36} className="w-1/3" />
          <Skeleton variant="rectangular" height={100} className="w-full" />
          <Skeleton variant="rectangular" height={240} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Could not load attendance data"
          message={error}
          onRetry={() => void loadData()}
        />
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
              onRefresh={() => void loadData()}
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

      {selectedRecord && (
        <RequestCorrectionModal
          isOpen={isRequestModalOpen}
          onClose={closeRequestModal}
          record={selectedRecord}
          onSuccess={() => {
            refetchCorrections();
            void loadData();
          }}
        />
      )}
    </div>
  );
}

export function AttendancePage({ initialTab }: AttendancePageProps = {}) {
  const { role } = useAuth();
  const isOpsView =
    role !== ROLES.STAFF &&
    (initialTab === 'on-duty' || initialTab === 'roster' || initialTab === 'timesheets');

  if (isOpsView) {
    return <AttendanceOpsWorkspace initialTab={initialTab} />;
  }

  const defaultTab: AttendanceManagementTab =
    initialTab === 'check-in' ||
    initialTab === 'leave-requests' ||
    initialTab === 'team-calendar' ||
    initialTab === 'my-attendance'
      ? initialTab
      : 'my-attendance';

  return <EmployeeAttendanceWorkspace defaultTab={defaultTab} />;
}

export default AttendancePage;
