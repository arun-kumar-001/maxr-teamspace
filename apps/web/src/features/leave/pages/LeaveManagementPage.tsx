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

export interface LeaveManagementPageProps {
  initialTab?: 'balances' | 'policies' | 'holidays';
}

export const LeaveManagementPage: React.FC<LeaveManagementPageProps> = ({
  initialTab = 'balances',
}) => {
  const { role } = useAuth();
  const canManage = role === ROLES.HR_MANAGER || role === ROLES.ADMIN;

  const [activeTab, setActiveTab] = useState<'balances' | 'policies' | 'holidays'>(
    initialTab === 'policies' && !canManage ? 'balances' : initialTab,
  );

  const {
    policies,
    holidays,
    balances,
    selectedYear,
    setSelectedYear,
    isLoadingPolicies,
    isLoadingHolidays,
    isLoadingBalances,
    policyError,
    holidayError,
    balanceError,
    createPolicy,
    updatePolicy,
    createHoliday,
    deleteHoliday,
    runAccrual,
  } = useLeave();

  // Modals
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
    { value: 'balances', label: 'My Balances' },
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
            Track annual leave balances, explore company holidays, and configure organizational
            leave quotas.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
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
              variant="primary"
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
              variant="primary"
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
      <div className="border-b border-border pb-4">
        <SegmentedControl
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'balances' | 'policies' | 'holidays')}
          options={tabOptions}
          ariaLabel="Leave and holiday navigation tabs"
        />
      </div>

      {/* Errors */}
      {policyError && activeTab === 'policies' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="policy-error-banner"
        >
          {policyError}
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

      {balanceError && activeTab === 'balances' && (
        <div
          className="p-4 rounded-tile bg-rose-50 border border-rose-200 text-sm text-rose-800"
          role="alert"
          data-testid="balance-error-banner"
        >
          {balanceError}
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'balances' && (
        <LeaveBalancesSummary
          balances={balances}
          year={selectedYear}
          onYearChange={setSelectedYear}
          isLoading={isLoadingBalances}
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
