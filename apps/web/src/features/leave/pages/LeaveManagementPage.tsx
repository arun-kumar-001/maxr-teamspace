import React, { useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import { useLeave } from '../hooks/useLeave';
import type { LeavePolicy } from '../types';
import { Button, SegmentedControl } from '../../../components/ui';
import { LeavePoliciesTable } from '../components/LeavePoliciesTable';
import { LeavePolicyFormModal } from '../components/LeavePolicyFormModal';
import { HolidayCalendar } from '../components/HolidayCalendar';
import { AddHolidayModal } from '../components/AddHolidayModal';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
import { RunAccrualModal } from '../components/RunAccrualModal';
import { ApplyLeaveModal } from '../components/ApplyLeaveModal';
import { LeaveRequestsTable } from '../components/LeaveRequestsTable';
import { LeaveCalendarView } from '../components/LeaveCalendarView';
import { LeaveApprovalsTab } from '../components/LeaveApprovalsTab';

export interface LeaveManagementPageProps {
  initialTab?: 'requests' | 'approvals' | 'balances' | 'calendar' | 'holidays' | 'policies';
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({
  initialTab = 'requests',
}) => {
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
    cancelRequest,
    createPolicy,
    updatePolicy,
    createHoliday,
    deleteHoliday,
    runAccrual,
  } = useLeave();

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState<LeavePolicy | null>(null);

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isAccrualModalOpen, setIsAccrualModalOpen] = useState(false);

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
    ...(canReviewApprovals ? [{ value: 'approvals', label: 'Team Approvals' }] : []),
    { value: 'balances', label: 'My Balances' },
    { value: 'calendar', label: 'Team Calendar' },
    { value: 'holidays', label: 'Holiday Calendar' },
    ...(canManage ? [{ value: 'policies', label: 'Leave Policies' }] : []),
  ];

  return (
    <div
      className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6"
      data-testid="leave-management-page"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display">
            Leave & Holiday Management
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Apply for leave, track requests and approvals, check balances, and review team
            schedules.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Apply for Leave Button - Accessible to all staff */}
          <Button
            type="button"
            variant="primary"
            onClick={() => setIsApplyModalOpen(true)}
            data-testid="apply-leave-btn"
            className="min-h-[44px]"
          >
            Apply for Leave
          </Button>

          {canManage && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAccrualModalOpen(true)}
              data-testid="open-accrual-modal-btn"
              className="min-h-[44px]"
            >
              Yearly Accrual
            </Button>
          )}

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
            setActiveTab(val as 'requests' | 'balances' | 'calendar' | 'holidays' | 'policies')
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
          isLoading={isLoadingRequests}
          onCancelRequest={async (id) => {
            await cancelRequest(id);
          }}
          onApplyClick={() => setIsApplyModalOpen(true)}
        />
      )}

      {activeTab === 'approvals' && canReviewApprovals && <LeaveApprovalsTab />}

      {activeTab === 'balances' && (
        <LeaveBalancesSummary
          balances={balances}
          year={selectedYear}
          onYearChange={setSelectedYear}
          isLoading={isLoadingBalances}
        />
      )}

      {activeTab === 'calendar' && (
        <LeaveCalendarView entries={calendarEntries} isLoading={isLoadingCalendar} />
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
        onClose={() => setIsApplyModalOpen(false)}
        policies={policies}
        balances={balances}
        holidays={holidays}
        onSubmit={async (payload) => {
          await applyLeave(payload);
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

      <RunAccrualModal
        isOpen={isAccrualModalOpen}
        onClose={() => setIsAccrualModalOpen(false)}
        onRunAccrual={runAccrual}
        defaultYear={selectedYear}
      />
    </div>
  );
};
