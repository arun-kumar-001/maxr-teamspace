import { useMemo, useState } from 'react';
import { Button, EmptyState, ErrorState, Skeleton } from '../../../components/ui';
import { ApplyLeaveModal, useLeave } from '../../leave';
import type { LeaveRequestStatus } from '../../leave/types';

function formatStatusChip(status: LeaveRequestStatus) {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-rose-50 border-rose-200 text-rose-800',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        className: 'bg-slate-100 border-slate-200 text-slate-700',
      };
    default:
      return {
        label: status === 'applied' ? 'Applied' : 'Pending',
        className: 'bg-amber-50 border-amber-200 text-amber-800',
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
            style={{ color: 'rgb(8, 11, 12)' }}
          >
            Leave Balances &amp; Requests ({selectedYear})
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'rgb(79, 92, 90)' }}>
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
        <div className="p-4 rounded-card border border-border/80 bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-semibold text-text-muted">
            Pending Approval
          </p>
          <p className="text-2xl font-bold font-display mt-1 text-amber-600">
            {counts.pending}
          </p>
        </div>
        <div className="p-4 rounded-card border border-border/80 bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-semibold text-text-muted">
            Approved Leaves
          </p>
          <p className="text-2xl font-bold font-display mt-1 text-emerald-600">
            {counts.approved}
          </p>
        </div>
        <div className="p-4 rounded-card border border-border/80 bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-semibold text-text-muted">
            Rejected Requests
          </p>
          <p className="text-2xl font-bold font-display mt-1 text-rose-600">
            {counts.rejected}
          </p>
        </div>
      </div>

      {/* Leave Balances */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-text-muted">
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
          <div className="p-4 rounded-card border border-border/80 bg-white text-xs sm:text-sm text-text-muted shadow-xs">
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
                  className="p-4 rounded-card border border-border/80 bg-white shadow-xs hover:shadow-card hover:-translate-y-0.5 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-text">
                      {bal.name}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep border border-primary/20">
                      {bal.code}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-display text-primary-deep">
                      {bal.remaining}
                    </span>
                    <span className="text-xs text-text-muted">
                      of {totalAvail} days left ({bal.used} used)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full overflow-hidden bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Request History */}
      <div className="p-4 sm:p-5 rounded-card border border-border/80 bg-white shadow-xs space-y-4">
        <h3 className="text-sm sm:text-base font-bold font-display text-text">
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
          <div className="rounded-xl bg-surface-muted/50 p-4">
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
                  className="p-3.5 rounded-xl border border-border/80 bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-text">
                        {req.leaveTypeName}
                      </span>
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${chip.className}`}>
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      {req.startDate} &rarr; {req.endDate} &middot; {req.days}{' '}
                      {req.days === 1 ? 'day' : 'days'}
                      {req.halfDay ? ' (Half day)' : ''}
                    </p>
                    {req.reason && (
                      <p className="text-xs italic text-text-subtle">
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
