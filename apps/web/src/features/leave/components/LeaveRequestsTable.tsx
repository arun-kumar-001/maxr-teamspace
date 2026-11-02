import React, { useState } from 'react';
import type { LeaveRequest } from '../types';
import { DataTable, type Column, Badge, Button, EmptyState } from '../../../components/ui';
import { LeaveRequestCard } from './LeaveRequestCard';

export interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  isLoading?: boolean;
  onCancelRequest?: (id: string) => Promise<void>;
  onApplyClick?: () => void;
}

export const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  requests,
  isLoading = false,
  onCancelRequest,
  onApplyClick,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const handleCancel = async (id: string) => {
    if (!onCancelRequest) return;
    try {
      setCancellingId(id);
      await onCancelRequest(id);
    } finally {
      setCancellingId(null);
    }
  };

  const statusVariantMap = {
    applied: 'primary' as const,
    pending: 'warning' as const,
    approved: 'success' as const,
    rejected: 'danger' as const,
    cancelled: 'neutral' as const,
  };

  const statusLabelMap = {
    applied: 'Applied',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'type',
      header: 'Leave Type',
      render: (req) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
            {req.leaveTypeCode}
          </span>
          <span className="font-semibold text-text">{req.leaveTypeName}</span>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Date Range',
      render: (req) => (
        <span className="font-mono text-xs font-medium text-text">
          {req.startDate}
          {req.startDate !== req.endDate ? ` to ${req.endDate}` : ''}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (req) => (
        <span className="text-sm font-bold text-primary-deep font-mono">
          {req.halfDay ? '0.5 day (Half Day)' : `${req.days} ${req.days === 1 ? 'day' : 'days'}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (req) => (
        <Badge variant={statusVariantMap[req.status]}>{statusLabelMap[req.status]}</Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (req) => (
        <span className="text-xs text-text-muted truncate max-w-xs block" title={req.reason ?? ''}>
          {req.reason || '—'}
        </span>
      ),
    },
    {
      key: 'appliedAt',
      header: 'Applied On',
      render: (req) => (
        <span className="text-xs text-text-subtle font-mono">
          {new Date(req.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (req) => {
        const isCancellable =
          (req.status === 'applied' || req.status === 'pending' || req.status === 'approved') &&
          Boolean(onCancelRequest);

        if (!isCancellable) return null;

        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                window.confirm(`Cancel leave request for ${req.leaveTypeName} (${req.startDate})?`)
              ) {
                handleCancel(req.id);
              }
            }}
            disabled={cancellingId === req.id}
            data-testid={`table-cancel-leave-btn-${req.id}`}
            aria-label={`Cancel ${req.leaveTypeName} leave`}
            className="min-h-[44px] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
          >
            {cancellingId === req.id ? 'Cancelling...' : 'Cancel'}
          </Button>
        );
      },
    },
  ];

  const filterOptions: { value: string; label: string }[] = [
    { value: 'all', label: `All (${requests.length})` },
    {
      value: 'pending',
      label: `Pending (${requests.filter((r) => r.status === 'pending').length})`,
    },
    {
      value: 'approved',
      label: `Approved (${requests.filter((r) => r.status === 'approved').length})`,
    },
    {
      value: 'rejected',
      label: `Rejected (${requests.filter((r) => r.status === 'rejected').length})`,
    },
    {
      value: 'cancelled',
      label: `Cancelled (${requests.filter((r) => r.status === 'cancelled').length})`,
    },
  ];

  return (
    <div className="space-y-4" data-testid="leave-requests-container">
      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] transition-colors border ${
              statusFilter === opt.value
                ? 'bg-primary-deep text-white border-primary-deep shadow-primary'
                : 'bg-surface text-text-muted border-border hover:border-primary-strong hover:text-text'
            }`}
            data-testid={`filter-status-${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 && !isLoading ? (
        <EmptyState
          title="No Leave Requests Found"
          description={
            statusFilter === 'all'
              ? 'You have not submitted any leave requests yet.'
              : `No leave applications matching the "${statusFilter}" status filter.`
          }
          actionLabel={statusFilter === 'all' && onApplyClick ? 'Apply for Leave' : undefined}
          onAction={statusFilter === 'all' && onApplyClick ? onApplyClick : undefined}
        />
      ) : (
        <>
          {/* Desktop Table View (≥ 1024px) */}
          <div className="hidden lg:block bg-surface rounded-card border border-border overflow-hidden shadow-card">
            <DataTable
              data={filteredRequests}
              columns={columns}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
              ariaLabel="My Leave Requests Table"
            />
          </div>

          {/* Mobile & Tablet Card View (< 1024px) */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4"
            data-testid="mobile-leave-cards"
          >
            {filteredRequests.map((req) => (
              <LeaveRequestCard
                key={req.id}
                request={req}
                onCancel={handleCancel}
                isCancelling={cancellingId === req.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
