import { isDemoDataEnabled } from '@/lib/demo-data';
import React, { useState, useEffect } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import { useLeave } from '../hooks/useLeave';
import { Button, PrimaryActionButton, SegmentedControl } from '../../../components/ui';
import { HolidayCalendar } from '../components/HolidayCalendar';
import { AddHolidayModal } from '../components/AddHolidayModal';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
import { ApplyLeaveModal } from '../components/ApplyLeaveModal';
import { LeaveRequestsTable, type DisplayLeaveItem } from '../components/LeaveRequestsTable';
import { LeaveCalendarView } from '../components/LeaveCalendarView';
import { LeaveApprovalsTab } from '../components/LeaveApprovalsTab';

type LeaveTab = 'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays';

export interface LeaveManagementPageProps {
  initialTab?: LeaveTab;
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({
  initialTab = 'requests',
}) => {
  const inRouter = useInRouterContext();
  const navigate = inRouter ? useNavigate() : null;
  const location = inRouter ? useLocation() : null;

  const { role, user } = useAuth();
  const canManage = role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  const canReviewApprovals =
    role === ROLES.TEAM_LEAD || role === ROLES.HR_MANAGER || role === ROLES.ADMIN;

  const allowedTab = (tab: LeaveTab): LeaveTab =>
    tab === 'approvals' && !canReviewApprovals ? 'requests' : tab;

  const [activeTab, setActiveTab] = useState<LeaveTab>(allowedTab(initialTab));

  useEffect(() => {
    setActiveTab(initialTab === 'approvals' && !canReviewApprovals ? 'requests' : initialTab);
  }, [initialTab, canReviewApprovals]);

  // Synchronize active tab from route pathname changes
  useEffect(() => {
    if (location?.pathname) {
      const path = location.pathname;
      if (path === '/leave/approvals' && canReviewApprovals) {
        setActiveTab('approvals');
      } else if (path === '/leave/balances') {
        setActiveTab('balances');
      } else if (path === '/leave/calendar') {
        setActiveTab('calendar');
      } else if (path === '/leave/holidays' || path === '/hr/holidays') {
        setActiveTab('holidays');
      } else if (path === '/leave' || path === '/leave/requests' || path === '/staff/leave') {
        setActiveTab('requests');
      }
    }
  }, [location?.pathname, canManage, canReviewApprovals]);

  const handleTabChange = (tab: LeaveTab) => {
    setActiveTab(tab);
    if (navigate) {
      const targetPath = tab === 'requests' ? '/leave/requests' : `/leave/${tab}`;
      if (location?.pathname !== targetPath) {
        navigate(targetPath);
      }
    }
  };

  const {
    policies,
    holidays,
    balances,
    requests,
    calendarEntries,
    todayEntries,
    todayError,
    selectedYear,
    setSelectedYear,
    isLoadingHolidays,
    isLoadingBalances,
    isLoadingRequests,
    isLoadingCalendar,
    holidayError,
    balanceError,
    requestsError,
    calendarError,
    loadCalendar,
    applyLeave,
    editLeave,
    cancelRequest,
    createHoliday,
    deleteHoliday,
  } = useLeave();

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<DisplayLeaveItem | null>(null);
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  const tabOptions = [
    { value: 'requests', label: 'My Requests' },
    ...(canReviewApprovals ? [{ value: 'approvals', label: 'Leave Approvals' }] : []),
    { value: 'balances', label: 'My Balances' },
    { value: 'calendar', label: 'Leave Calendar' },
    { value: 'holidays', label: 'Holiday Calendar' },
  ];

  return (
    <div className="space-y-6 w-full min-w-0" data-testid="leave-management-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display">
            {canReviewApprovals ? 'Leave Management' : 'My Leave'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {canReviewApprovals
              ? 'Review team leave and manage your own requests and balances'
              : 'Apply for leave and track your requests and balances'}
          </p>
          <span className="sr-only">Leave & Holiday Management</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Apply for Leave Button - Accessible to all staff */}
          <PrimaryActionButton
            type="button"
            onClick={() => setIsApplyModalOpen(true)}
            data-testid="apply-leave-btn"
          >
            Apply Leave
          </PrimaryActionButton>

          {canManage && activeTab === 'holidays' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsHolidayModalOpen(true)}
              data-testid="top-add-holiday-btn"
              className="min-h-[44px]"
            >
              Add Holiday
            </Button>
          )}
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="border-b border-border pb-4 overflow-x-auto max-w-full">
        <SegmentedControl
          value={activeTab}
          onChange={(val) => handleTabChange(val as LeaveTab)}
          options={tabOptions}
          ariaLabel="Leave and holiday navigation tabs"
        />
      </div>

      {/* Error Banners */}
      {requestsError && activeTab === 'requests' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="requests-error-banner"
        >
          {requestsError}
        </div>
      )}

      {balanceError && activeTab === 'balances' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="balance-error-banner"
        >
          {balanceError}
        </div>
      )}

      {calendarError && activeTab === 'calendar' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="calendar-error-banner"
        >
          {calendarError}
        </div>
      )}

      {holidayError && activeTab === 'holidays' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="holiday-error-banner"
        >
          {holidayError}
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'requests' && (
        <LeaveRequestsTable
          requests={requests}
          balances={balances}
          isLoading={isLoadingRequests}
          onCancelRequest={async (id) => {
            await cancelRequest(id);
          }}
          onEditRequest={
            isDemoDataEnabled()
              ? (req) => {
                  setEditingRequest(req);
                  setIsApplyModalOpen(true);
                }
              : undefined
          }
          onApplyClick={() => {
            setEditingRequest(null);
            setIsApplyModalOpen(true);
          }}
        />
      )}

      {activeTab === 'approvals' && canReviewApprovals && <LeaveApprovalsTab />}

      {activeTab === 'balances' && (
        <LeaveBalancesSummary
          balances={balances}
          policies={policies}
          year={selectedYear}
          onYearChange={setSelectedYear}
          isLoading={isLoadingBalances}
          onApplyClick={() => setIsApplyModalOpen(true)}
        />
      )}

      {activeTab === 'calendar' && (
        <LeaveCalendarView
          entries={calendarEntries}
          isLoading={isLoadingCalendar}
          onRangeChange={loadCalendar}
          todayEntries={todayEntries}
          todayError={todayError}
          holidays={holidays}
          myEmployeeId={user?.employeeId}
        />
      )}

      {activeTab === 'holidays' && (
        <HolidayCalendar
          holidays={holidays}
          year={selectedYear}
          onYearChange={setSelectedYear}
          onAddHoliday={() => setIsHolidayModalOpen(true)}
          onDeleteHoliday={deleteHoliday}
          canManage={canManage}
          isLoading={isLoadingHolidays}
        />
      )}

      {/* Modals */}
      <ApplyLeaveModal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setEditingRequest(null);
        }}
        policies={policies}
        balances={balances}
        holidays={holidays}
        initialRequest={editingRequest}
        mode={editingRequest ? 'edit' : 'create'}
        onSubmit={async (payload) => {
          if (editingRequest) {
            await editLeave(editingRequest.id, payload);
          } else {
            await applyLeave(payload);
          }
        }}
      />

      <AddHolidayModal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        onSubmit={async (data) => {
          await createHoliday(data);
        }}
        defaultYear={selectedYear}
      />
    </div>
  );
};
