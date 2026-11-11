import { useMemo, useState } from 'react';
import { Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui';
import { ApplyLeaveModal, useLeave } from '../../leave';
import type { LeaveRequestStatus } from '../../leave/types';

function formatStatusChip(status: LeaveRequestStatus) {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        bg: 'rgba(85, 205, 179, 0.16)',
        border: 'rgba(85, 205, 179, 0.4)',
        text: 'rgb(85, 205, 179)',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        bg: 'rgba(233, 138, 203, 0.16)',
        border: 'rgba(233, 138, 203, 0.45)',
        text: 'rgb(233, 138, 203)',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        bg: 'rgba(148, 163, 184, 0.16)',
        border: 'rgba(148, 163, 184, 0.35)',
        text: 'rgb(203, 213, 225)',
      };
    default:
      return {
        label: status === 'applied' ? 'Applied' : 'Pending',
        bg: 'rgba(245, 158, 11, 0.16)',
        border: 'rgba(245, 158, 11, 0.4)',
        text: 'rgb(251, 191, 36)',
      };
  }
}

export function LeaveRequestsTab() {
  const {
    policies,
    holidays,
    balances,
    requests,
    isLoadingBalances,
    isLoadingRequests,
    requestsError,
    applyLeave,
    cancelRequest,
    loadMyRequests,
    loadBalances,
    selectedYear,
  } = useLeave();

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const req of requests) {
      if (req.status === 'pending' || req.status === 'applied') pending += 1;
      else if (req.status === 'approved') approved += 1;
      else if (req.status === 'rejected') rejected += 1;
    }
    return { pending, approved, rejected };
  }, [requests]);

  const handleCancel = async (id: string) => {
    try {
      setCancellingId(id);
      await cancelRequest(id);
      setBannerMsg('Leave request cancelled.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="leave-requests-tab">
      {/* Header + Apply CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className="text-lg sm:text-xl font-bold font-display"
            style={{ color: 'rgb(244, 247, 246)' }}
          >
            Leave Balances &amp; Requests ({selectedYear})
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
            Track your Annual, Sick, Casual, and Work From Home balances and submit new requests
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsApplyOpen(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-bold min-h-[44px] transition-all cursor-pointer shrink-0"
          style={{
            backgroundColor: 'rgb(85, 205, 179)',
            color: 'rgb(8, 11, 12)',
            boxShadow: '0 0 22px rgba(0, 220, 203, 0.3)',
          }}
          data-testid="attendance-apply-leave-btn"
        >
          + Apply for Leave
        </button>
      </div>

      {bannerMsg && (
        <div
          role="status"
          className="p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(85, 205, 179, 0.14)',
            borderColor: 'rgba(0, 220, 203, 0.35)',
            color: 'rgb(0, 220, 203)',
          }}
        >
          <span>{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="font-bold px-2"
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      )}

      {/* Request Status Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: 'rgba(17, 24, 25, 0.82)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
            Pending Approval
          </p>
          <p
            className="text-2xl font-bold font-display mt-1"
            style={{ color: 'rgb(251, 191, 36)' }}
          >
            {counts.pending}
          </p>
        </div>
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: 'rgba(17, 24, 25, 0.82)',
            borderColor: 'rgba(85, 205, 179, 0.32)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
            Approved Leaves
          </p>
          <p
            className="text-2xl font-bold font-display mt-1"
            style={{ color: 'rgb(85, 205, 179)' }}
          >
            {counts.approved}
          </p>
        </div>
        <div
          className="p-4 rounded-2xl border"
          style={{
            backgroundColor: 'rgba(17, 24, 25, 0.82)',
            borderColor: 'rgba(233, 138, 203, 0.32)',
          }}
        >
          <p className="text-xs font-medium" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
            Rejected Requests
          </p>
          <p
            className="text-2xl font-bold font-display mt-1"
            style={{ color: 'rgb(233, 138, 203)' }}
          >
            {counts.rejected}
          </p>
        </div>
      </div>

      {/* Leave Balances */}
      <div>
        <h3
          className="text-xs font-bold uppercase tracking-wider mb-3"
          style={{ color: 'rgba(244, 247, 246, 0.65)' }}
        >
          Leave Balances
        </h3>
        {isLoadingBalances ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Skeleton variant="rectangular" height={92} />
            <Skeleton variant="rectangular" height={92} />
            <Skeleton variant="rectangular" height={92} />
            <Skeleton variant="rectangular" height={92} />
          </div>
        ) : balances.length === 0 ? (
          <div
            className="p-4 rounded-2xl border text-xs sm:text-sm"
            style={{
              backgroundColor: 'rgba(17, 24, 25, 0.75)',
              borderColor: 'rgba(244, 247, 246, 0.14)',
              color: 'rgba(244, 247, 246, 0.75)',
            }}
          >
            No leave balances accrued yet for {selectedYear}.
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            data-testid="leave-balances-grid"
          >
            {balances.map((bal) => {
              const totalAvail = bal.allotted + bal.carriedForward;
              const pct =
                totalAvail > 0 ? Math.min(100, Math.round((bal.remaining / totalAvail) * 100)) : 0;
              return (
                <div
                  key={bal.leaveTypeId}
                  className="p-4 rounded-2xl border space-y-2.5"
                  style={{
                    backgroundColor: 'rgba(17, 24, 25, 0.85)',
                    borderColor: 'rgba(85, 205, 179, 0.24)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'rgb(244, 247, 246)' }}>
                      {bal.name}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'rgba(85, 205, 179, 0.15)',
                        color: 'rgb(85, 205, 179)',
                      }}
                    >
                      {bal.code}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="text-2xl font-bold font-display"
                      style={{ color: 'rgb(0, 220, 203)' }}
                    >
                      {bal.remaining}
                    </span>
                    <span className="text-xs" style={{ color: 'rgba(244, 247, 246, 0.65)' }}>
                      of {totalAvail} days left ({bal.used} used)
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(244, 247, 246, 0.1)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: 'rgb(85, 205, 179)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request History */}
      <div
        className="p-4 sm:p-5 rounded-2xl border space-y-4"
        style={{
          backgroundColor: 'rgba(17, 24, 25, 0.86)',
          borderColor: 'rgba(244, 247, 246, 0.12)',
        }}
      >
        <h3
          className="text-sm sm:text-base font-bold font-display"
          style={{ color: 'rgb(244, 247, 246)' }}
        >
          My Leave Request History
        </h3>

        {isLoadingRequests ? (
          <div className="space-y-3">
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
          </div>
        ) : requestsError ? (
          <ErrorState
            title="Could not load leave requests"
            message={requestsError}
            onRetry={() => void loadMyRequests()}
          />
        ) : requests.length === 0 ? (
          <div className="rounded-xl bg-surface p-4">
            <EmptyState
              title="No leave requests submitted"
              description="Submit a leave request whenever you need time off or plan to work remotely."
              actionLabel="Apply for Leave"
              onAction={() => setIsApplyOpen(true)}
            />
          </div>
        ) : (
          <div className="space-y-2.5" data-testid="attendance-leave-history-list">
            {requests.map((req) => {
              const chip = formatStatusChip(req.status);
              const canCancel = req.status === 'applied' || req.status === 'pending';
              return (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    backgroundColor: 'rgba(8, 11, 12, 0.55)',
                    borderColor: 'rgba(244, 247, 246, 0.1)',
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'rgb(244, 247, 246)' }}
                      >
                        {req.leaveTypeName}
                      </span>
                      <span
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: chip.bg,
                          borderColor: chip.border,
                          color: chip.text,
                        }}
                      >
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
                      {req.startDate} &rarr; {req.endDate} &middot; {req.days}{' '}
                      {req.days === 1 ? 'day' : 'days'}
                      {req.halfDay ? ' (Half day)' : ''}
                    </p>
                    {req.reason && (
                      <p className="text-xs italic" style={{ color: 'rgba(244, 247, 246, 0.6)' }}>
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    )}
                  </div>

                  {canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={cancellingId === req.id}
                      onClick={() => void handleCancel(req.id)}
                      className="text-xs min-h-[38px] self-start sm:self-center"
                      style={{
                        borderColor: 'rgba(233, 138, 203, 0.4)',
                        color: 'rgb(233, 138, 203)',
                        backgroundColor: 'rgba(233, 138, 203, 0.08)',
                      }}
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ApplyLeaveModal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        policies={policies}
        balances={balances}
        holidays={holidays}
        onSubmit={async (payload) => {
          await applyLeave(payload);
          setBannerMsg('Leave request submitted and pending approval.');
          await Promise.all([loadMyRequests(), loadBalances(selectedYear)]);
        }}
      />
    </div>
  );
}
