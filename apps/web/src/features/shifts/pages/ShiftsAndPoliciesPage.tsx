import React from 'react';
import { PageContainer } from '../../../components/ui/PageContainer';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ErrorState } from '../../../components/ui/StateCards';
import { AttendancePolicyCard } from '../components/AttendancePolicyCard';
import { ShiftCard } from '../components/ShiftCard';
import { ShiftFormModal } from '../components/ShiftFormModal';
import { useShifts } from '../hooks/useShifts';
import type { Shift } from '../types';

export const ShiftsAndPoliciesPage: React.FC = () => {
  const {
    shifts,
    policy,
    isLoading,
    error,
    refetch,
    isShiftModalOpen,
    selectedShift,
    openCreateShift,
    openEditShift,
    closeShiftModal,
    handleSaveShift,
    handleUpdatePolicy,
  } = useShifts();

  const columns: Column<Shift>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
          {row.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Shift Name',
      render: (row) => (
        <div>
          <span className="font-semibold text-text block">{row.name}</span>
          {policy?.defaultShiftId === row.id && (
            <span className="text-[11px] text-primary-ink font-medium">Default Fallback</span>
          )}
        </div>
      ),
    },
    {
      key: 'hours',
      header: 'Hours',
      render: (row) => (
        <span className="font-medium text-text tabular-nums text-xs">
          {row.startTime} &ndash; {row.endTime}
          {row.crossesMidnight && (
            <span className="text-xs text-warning ml-1.5 font-normal">(Overnight)</span>
          )}
        </span>
      ),
    },
    {
      key: 'grace',
      header: 'Grace',
      render: (row) => <span className="text-xs text-text-muted">{row.graceMinutes}m</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            row.isActive
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => openEditShift(row)}
          data-testid={`table-edit-shift-${row.id}`}
          className="text-xs min-h-[44px]"
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-8" data-testid="shifts-policies-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-text tracking-tight">
              Shift & Attendance Policies
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Configure shift schedules, grace periods, full/half day thresholds, and default
              assignments.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={openCreateShift}
            className="self-start sm:self-auto min-h-[44px]"
            data-testid="add-shift-btn"
          >
            Create New Shift
          </Button>
        </div>

        {/* Global Attendance Policy */}
        {isLoading ? (
          <div
            className="p-6 bg-surface border border-border rounded-card space-y-4"
            data-testid="shifts-loading"
          >
            <Skeleton className="h-6 w-1/4 rounded-control" />
            <Skeleton className="h-12 w-full rounded-control" />
            <Skeleton className="h-12 w-full rounded-control" />
          </div>
        ) : error ? (
          <ErrorState title="Unable to load shifts and policy" message={error} onRetry={refetch} />
        ) : (
          <>
            <AttendancePolicyCard
              policy={policy}
              shifts={shifts}
              onUpdate={handleUpdatePolicy}
              isLoading={isLoading}
            />

            {/* Shifts Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text font-display">Configured Shifts</h3>
                  <p className="text-xs text-text-muted">
                    Total {shifts.length} shift schedule{shifts.length !== 1 ? 's' : ''} defined.
                  </p>
                </div>
              </div>

              {/* Desktop Table View (≥ 1024px) */}
              <div className="hidden lg:block bg-surface rounded-card border border-border overflow-hidden shadow-card">
                <DataTable
                  columns={columns}
                  data={shifts}
                  keyExtractor={(row) => row.id}
                  ariaLabel="Configured Shifts Table"
                />
              </div>

              {/* Mobile Card Grid (< 1024px) */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4"
                data-testid="shifts-mobile-cards"
              >
                {shifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    isDefault={policy?.defaultShiftId === shift.id}
                    onEdit={openEditShift}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Shift Create / Edit Modal */}
        <ShiftFormModal
          isOpen={isShiftModalOpen}
          onClose={closeShiftModal}
          shift={selectedShift}
          onSubmit={handleSaveShift}
        />
      </div>
    </PageContainer>
  );
};
