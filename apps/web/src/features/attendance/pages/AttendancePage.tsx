import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { fetchTodayAttendance } from '../api/attendance';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { LeaveRequestsTab } from '../components/LeaveRequestsTab';
import { MyAttendanceTab } from '../components/MyAttendanceTab';
import { RequestCorrectionModal } from '../components/RequestCorrectionModal';
import { TeamCalendarTab } from '../components/TeamCalendarTab';
import { useAttendanceCorrections } from '../hooks/useAttendanceCorrections';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import type { TodayAttendanceSummary } from '../types';

export type AttendanceManagementTab =
  'my-attendance' | 'check-in' | 'leave-requests' | 'team-calendar';

const SUB_TABS: Array<{ id: AttendanceManagementTab; label: string }> = [
  { id: 'my-attendance', label: 'My Attendance' },
  { id: 'check-in', label: 'Check-In / Check-Out' },
  { id: 'leave-requests', label: 'Leave Requests' },
  { id: 'team-calendar', label: 'Team Calendar' },
];

export function AttendancePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AttendanceManagementTab>('my-attendance');
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
      className="relative overflow-hidden rounded-[24px] p-4 sm:p-6 md:p-8 border space-y-6"
      style={{
        backgroundColor: 'rgb(17, 24, 25)',
        backgroundImage: [
          'radial-gradient(circle at 12% 10%, rgba(0, 220, 203, 0.22) 0%, transparent 42%)',
          'radial-gradient(circle at 88% 14%, rgba(233, 138, 203, 0.18) 0%, transparent 38%)',
          'radial-gradient(circle at 50% 95%, rgba(73, 53, 72, 0.55) 0%, transparent 52%)',
          'linear-gradient(155deg, rgb(17, 24, 25) 0%, rgb(8, 11, 12) 100%)',
        ].join(', '),
        borderColor: 'rgba(85, 205, 179, 0.22)',
        boxShadow: '0 24px 60px rgba(8, 11, 12, 0.4)',
      }}
      data-testid="attendance-page"
    >
      {/* Top Frosted Header & Sub-Navigation */}
      <div
        className="p-4 sm:p-5 rounded-2xl border space-y-4 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(8, 11, 12, 0.55)',
          borderColor: 'rgba(244, 247, 246, 0.12)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: 'rgb(85, 205, 179)' }}
            >
              MaxR Teamspace Workforce Hub
            </p>
            <h1
              className="text-xl sm:text-2xl font-bold font-display mt-0.5"
              style={{ color: 'rgb(244, 247, 246)' }}
            >
              Attendance Management
            </h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
              Monitor monthly attendance metrics, clock sessions &amp; breaks, manage leave, and
              view team schedules
            </p>
          </div>
        </div>

        {/* 4 Neon-Teal Sub-Navigation Tabs */}
        <nav
          aria-label="Attendance sections"
          className="flex flex-wrap gap-2 pt-1"
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
                        borderColor: 'rgb(0, 220, 203)',
                        color: 'rgb(8, 11, 12)',
                        boxShadow: '0 0 22px rgba(0, 220, 203, 0.35)',
                      }
                    : {
                        backgroundColor: 'rgba(17, 24, 25, 0.75)',
                        borderColor: 'rgba(244, 247, 246, 0.12)',
                        color: 'rgba(244, 247, 246, 0.8)',
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
        <div className="space-y-4" data-testid="check-in-tab-panel">
          <AttendanceWidget
            theme="dark"
            employeeName={user?.name}
            designation={user?.title ?? user?.role}
            onSessionChange={() => {
              void refresh();
              void loadTodaySummary();
            }}
          />
        </div>
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
