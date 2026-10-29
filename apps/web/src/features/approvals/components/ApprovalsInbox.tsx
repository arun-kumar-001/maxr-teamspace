import { useEffect, useState, useCallback } from 'react';
import { Button } from '../../../components/ui/Button';
import { StatusPill, WorkflowStatus } from '../../../components/ui/StatusPill';
import { ApprovalsApiClient, HttpApprovalsApi } from '../api/approvalsApi';
import { Approval, ApprovalStatus, ApprovalSubjectType } from '../types/approvals';

export interface ApprovalsInboxProps {
  api?: ApprovalsApiClient;
  onDecisionComplete?: (approval: Approval) => void;
}

const statusToWorkflowMap: Record<ApprovalStatus, WorkflowStatus> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const subjectLabels: Record<ApprovalSubjectType, string> = {
  LEAVE: 'Leave Request',
  ATTENDANCE_CORRECTION: 'Attendance Correction',
  EXPENSE: 'Expense Claim',
};

export function ApprovalsInbox({
  api = new HttpApprovalsApi(),
  onDecisionComplete,
}: ApprovalsInboxProps) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('PENDING');

  // Decision Modal State
  const [activeItem, setActiveItem] = useState<{ id: string; action: 'approve' | 'reject' } | null>(
    null,
  );
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = selectedStatus === 'ALL' ? {} : { status: selectedStatus as ApprovalStatus };
      const response = await api.list(filter);
      setApprovals(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [api, selectedStatus]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDecision = async () => {
    if (!activeItem) return;
    setSubmitting(true);
    setActionError(null);
    try {
      let updated: Approval;
      if (activeItem.action === 'approve') {
        updated = await api.approve(activeItem.id, {
          comment: decisionComment.trim() || undefined,
        });
      } else {
        updated = await api.reject(activeItem.id, {
          comment: decisionComment.trim() || undefined,
        });
      }
      setActiveItem(null);
      setDecisionComment('');
      onDecisionComplete?.(updated);
      await fetchApprovals();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Decision action failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold text-text">Approvals Inbox</h2>
          <p className="text-sm text-text-muted">
            Review and decide pending leave, attendance corrections, and expense requests.
          </p>
        </div>

        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Filter approvals by status"
        >
          {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`min-h-[44px] px-3.5 py-1.5 text-xs font-semibold rounded-input transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                selectedStatus === st
                  ? 'bg-teal-500 text-white'
                  : 'bg-surface border border-border text-text hover:bg-surface-muted'
              }`}
            >
              {st === 'ALL' ? 'All' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content States */}
      {loading ? (
        <div className="p-8 text-center text-text-muted animate-pulse" role="status">
          Loading approval requests...
        </div>
      ) : error ? (
        <div
          className="p-4 rounded-card bg-red-50 border border-danger text-danger text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : approvals.length === 0 ? (
        <div className="p-12 text-center rounded-card bg-surface border border-border">
          <p className="text-base font-medium text-text">No approval requests found</p>
          <p className="text-sm text-text-muted mt-1">
            {selectedStatus === 'PENDING'
              ? 'Your queue is completely clear. All pending requests have been decided.'
              : 'There are no records matching your current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Card List & Desktop Responsive Table */}
          <div className="grid grid-cols-1 gap-3 sm:hidden" role="list" aria-label="Approvals list">
            {approvals.map((item) => (
              <div
                key={item.id}
                role="listitem"
                className="p-4 rounded-card bg-surface border border-border space-y-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-text">
                      {subjectLabels[item.subjectType] || item.subjectType}
                    </span>
                    <p className="text-xs text-text-muted font-mono mt-1">
                      ID: {item.id.slice(0, 8)}...
                    </p>
                  </div>
                  <StatusPill status={statusToWorkflowMap[item.status]} size="sm" />
                </div>

                <div className="text-xs text-text-muted space-y-1">
                  <p>
                    <span className="font-medium text-text">Requester:</span>{' '}
                    {item.requesterId.slice(0, 8)}...
                  </p>
                  <p>
                    <span className="font-medium text-text">Requested:</span>{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                  {item.comment && (
                    <p className="italic text-text bg-surface-muted p-2 rounded-input border border-border">
                      &quot;{item.comment}&quot;
                    </p>
                  )}
                </div>

                {item.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => setActiveItem({ id: item.id, action: 'approve' })}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => setActiveItem({ id: item.id, action: 'reject' })}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-left text-sm" aria-label="Approvals Table">
              <thead className="bg-surface-muted text-xs font-semibold text-text uppercase border-b border-border">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Requester
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Submitted
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Notes
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approvals.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/50 transition-colors">
                    <td className="px-4 py-3.5 font-medium text-text">
                      {subjectLabels[item.subjectType] || item.subjectType}
                    </td>
                    <td className="px-4 py-3.5 text-text-muted font-mono text-xs">
                      {item.requesterId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3.5 text-text-muted text-xs">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={statusToWorkflowMap[item.status]} size="sm" />
                    </td>
                    <td className="px-4 py-3.5 text-text-muted text-xs max-w-xs truncate">
                      {item.comment || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      {item.status === 'PENDING' ? (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setActiveItem({ id: item.id, action: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setActiveItem({ id: item.id, action: 'reject' })}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Decided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decision-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-card bg-surface border border-border p-6 shadow-xl space-y-4">
            <h3 id="decision-modal-title" className="text-lg font-bold text-text">
              {activeItem.action === 'approve' ? 'Approve Request' : 'Reject Request'}
            </h3>
            <p className="text-sm text-text-muted">
              {activeItem.action === 'approve'
                ? 'Confirm your approval for this request. You can optionally add a note for the requester.'
                : 'Confirm rejection of this request. Please provide reasoning if necessary.'}
            </p>

            {actionError && (
              <div
                className="p-3 rounded-input bg-red-50 border border-danger text-danger text-xs"
                role="alert"
              >
                {actionError}
              </div>
            )}

            <div>
              <label
                htmlFor="decision-comment"
                className="block text-xs font-semibold text-text mb-1"
              >
                Reason / Comment (optional)
              </label>
              <textarea
                id="decision-comment"
                rows={3}
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="e.g. Approved per team scheduling agreement"
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                disabled={submitting}
                onClick={() => {
                  setActiveItem(null);
                  setActionError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant={activeItem.action === 'approve' ? 'primary' : 'danger'}
                size="md"
                isLoading={submitting}
                onClick={handleDecision}
              >
                {activeItem.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
