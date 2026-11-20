import { useState, useEffect } from 'react';
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import { useLeave } from '../hooks/useLeave';
import type { LeavePolicy } from '../types';
import { Button, PrimaryActionButton, SegmentedControl } from '../../../components/ui';
import { LeavePoliciesTable } from '../components/LeavePoliciesTable';
import { LeavePolicyFormModal } from '../components/LeavePolicyFormModal';
import { HolidayCalendar } from '../components/HolidayCalendar';
import { AddHolidayModal } from '../components/AddHolidayModal';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
import { ApplyLeaveModal } from '../components/ApplyLeaveModal';
import { LeaveRequestsTable, type DisplayLeaveItem } from '../components/LeaveRequestsTable';
import { LeaveCalendarView } from '../components/LeaveCalendarView';
import { LeaveApprovalsTab } from '../components/LeaveApprovalsTab';

export interface LeaveManagementPageProps {
  initialTab?: 'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays' | 'policies';
  onNavigate?: (path: string) => void;
}

interface LeaveManagementPageContentProps extends LeaveManagementPageProps {
  navigate?: (path: string) => void;
}

function LeaveManagementPageContent({
  initialTab = 'requests',
  navigate: propNavigate,
}: LeaveManagementPageContentProps) {
  const inRouter = useInRouterContext();
  const routerNavigate = inRouter ? useNavigate() : null;
  const location = inRouter ? useLocation() : null;
  const navigate = propNavigate || routerNavigate;
  const { role } = useAuth();
  const canManage = role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  const canReviewApprovals =
    role === ROLES.TEAM_LEAD || role === ROLES.HR_MANAGER || role === ROLES.ADMIN;

  const [activeTab, setActiveTab] = useState<
    'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays' | 'policies'
  >(
    initialTab === 'policies' && !canManage
      ? 'requests'
      : initialTab === 'approvals' && !canReviewApprovals
        ? 'requests'
        : initialTab,
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(
        initialTab === 'policies' && !canManage
          ? 'requests'
          : initialTab === 'approvals' && !canReviewApprovals
            ? 'requests'
            : initialTab,
      );
    }
  }, [initialTab, canManage, canReviewApprovals]);

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
      } else if ((path === '/leave/policies' || path === '/hr/leave') && canManage) {
        setActiveTab('policies');
      } else if (path === '/leave' || path === '/leave/requests' || path === '/staff/leave') {
        setActiveTab('requests');
      }
    }
  }, [location?.pathname, canManage, canReviewApprovals]);

  const handleTabChange = (
    tab: 'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays' | 'policies',
  ) => {
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
    selectedYear,
    setSelectedYear,
    isLoadingPolicies,
    isLoadingHolidays,
    isLoadingBalances,
    isLoadingRequests,
    isLoadingCalendar,
    policyError,
    holidayError,
    balanceError,
    requestsError,
    calendarError,
    applyLeave,
    editLeave,
    cancelRequest,
    createPolicy,
    updatePolicy,
    createHoliday,
    deleteHoliday,
  } = useLeave();

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<DisplayLeaveItem | null>(null);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState<LeavePolicy | null>(null);

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  const handleOpenCreatePolicy = () => {
    setSelectedPolicyForEdit(null);
    setIsPolicyModalOpen(true);
  };

  const handleOpenEditPolicy = (policy: LeavePolicy) => {
    setSelectedPolicyForEdit(policy);
    setIsPolicyModalOpen(true);
  };

  const tabOptions = [
    { value: 'requests', label: 'My Requests' },
    ...(canReviewApprovals ? [{ value: 'approvals', label: 'Leave Approvals' }] : []),
    { value: 'balances', label: 'My Balances' },
    { value: 'calendar', label: 'Leave Calendar' },
    { value: 'holidays', label: 'Holiday Calendar' },
    ...(canManage ? [{ value: 'policies', label: 'Leave Policies' }] : []),
  ];

  return (
    <div className="space-y-6 w-full min-w-0" data-testid="leave-management-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display">
            Employee Leave
          </h1>
          <p className="text-sm text-text-muted mt-1">Plan, track, and manage team leaves</p>
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

          {canManage && activeTab === 'policies' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenCreatePolicy}
              data-testid="create-policy-btn"
              className="min-h-[44px]"
            >
              New Policy
            </Button>
          )}

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
onChange={(val) =>
            handleTabChange(
              val as 'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays' | 'policies',
            )
          }
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

      {policyError && activeTab === 'policies' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="policy-error-banner"
        >
          {policyError}
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
onEditRequest={(req) => {
            setEditingRequest(req);
            setIsApplyModalOpen(true);
          }}
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
          onApplyClick={() => setIsApplyModalOpen(true)}
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

      {activeTab === 'policies' && canManage && (
        <div className="space-y-4">
          <div className="p-4 bg-surface border border-border rounded-card">
            <h2 className="text-lg font-bold text-text font-display">Configured Leave Policies</h2>
            <p className="text-xs text-text-muted mt-0.5">
              Defines annual allotment, carry-forward caps, backdating limits, and half-day rules
              for each leave type.
            </p>
          </div>
          <LeavePoliciesTable
            policies={policies}
            isLoading={isLoadingPolicies}
            onEdit={handleOpenEditPolicy}
            canManage={canManage}
          />
        </div>
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

      <LeavePolicyFormModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        policy={selectedPolicyForEdit}
        onSubmit={async (data) => {
          if ('id' in data) {
            await updatePolicy(data.id, data);
          } else {
            await createPolicy(data);
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
}

function RouterLeaveManagementPage(props: LeaveManagementPageProps) {
  const routerNavigate = useNavigate();
  const navigate = props.onNavigate || routerNavigate;
  return <LeaveManagementPageContent {...props} navigate={navigate} />;
}

function StaticLeaveManagementPage(props: LeaveManagementPageProps) {
  return <LeaveManagementPageContent {...props} navigate={props.onNavigate} />;
}

export function LeaveManagementPage(props: LeaveManagementPageProps) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterLeaveManagementPage {...props} />;
  }
  return <StaticLeaveManagementPage {...props} />;
}
