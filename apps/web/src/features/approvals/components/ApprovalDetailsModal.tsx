import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { ApprovalStagePill } from './ApprovalStagePill';
import type { Approval } from '../types';
import { fetchLeaveRequest } from '../../leave/api/leave';
import type { LeaveRequest } from '../../leave/types';

export interface ApprovalDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: Approval | null;
  onApproveClick?: (approval: Approval) => void;
  onRejectClick?: (approval: Approval) => void;
  canDecide?: boolean;
}

export const ApprovalDetailsModal: React.FC<ApprovalDetailsModalProps> = ({
  isOpen,
  onClose,
  approval,
  onApproveClick,
  onRejectClick,
  canDecide = false,
}) => {
  const [leaveDetails, setLeaveDetails] = useState<LeaveRequest | null>(null);
  const [isLoadingLeave, setIsLoadingLeave] = useState(false);

  useEffect(() => {
    if (!isOpen || !approval || approval.subjectType !== 'leave_request') {
      setLeaveDetails(null);
      return;
    }

    let isMounted = true;
    setIsLoadingLeave(true);
    fetchLeaveRequest(approval.subjectId)
      .then((res) => {
        if (isMounted) setLeaveDetails(res);
      })
      .catch(() => {
        if (isMounted) setLeaveDetails(null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLeave(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, approval]);

  if (!isOpen || !approval) return null;

  const currentStageName = approval.stages[approval.currentStage];
  const isPending = approval.status === 'pending';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Approval Request Details"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {isPending && canDecide && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  onClose();
                  onRejectClick?.(approval);
                }}
                data-testid="modal-reject-button"
              >
                Reject
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onClose();
                  onApproveClick?.(approval);
                }}
                data-testid="modal-approve-button"
              >
                Approve
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6 py-2" data-testid="approval-details-content">
        {/* Header Summary Card */}
        <div className="p-4 rounded-card bg-surface-muted border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-text">{approval.requesterName}</h3>
              <ApprovalStatusBadge status={approval.status} size="sm" />
            </div>
            <p className="text-sm text-text-muted capitalize mt-0.5">
              Subject: {approval.subjectType.replace(/_/g, ' ')}
            </p>
          </div>
          <div className="text-right sm:text-left">
            <span className="text-xs text-text-subtle block">Workflow Route</span>
            <div className="flex items-center gap-1.5 mt-1">
              {approval.stages.map((stg, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    idx < approval.currentStage
                      ? 'bg-positive-soft text-positive-ink border border-positive-ink/20'
                      : idx === approval.currentStage && isPending
                        ? 'bg-primary-soft text-primary-ink border border-teal-200 ring-1 ring-primary'
                        : 'bg-surface text-text-subtle border border-border'
                  }`}
                >
                  {idx + 1}. {stg === 'manager' ? 'Manager' : 'HR'}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Leave Request Specifics (When Subject is Leave Request) */}
        {approval.subjectType === 'leave_request' && (
          <div
            className="p-4 rounded-tile bg-surface-muted border border-border space-y-3"
            data-testid="leave-approval-specifics"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-sm font-bold text-text font-display flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Leave Request Details
              </h4>
              {leaveDetails && (
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface border border-border text-primary-deep">
                  {leaveDetails.leaveTypeCode}
                </span>
              )}
            </div>

            {isLoadingLeave ? (
              <div className="py-2 text-xs text-text-muted">Loading leave request data...</div>
            ) : leaveDetails ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 bg-surface rounded-control border border-border">
                    <span className="text-text-subtle block">Leave Type</span>
                    <span className="font-semibold text-text mt-0.5 block">
                      {leaveDetails.leaveTypeName}
                    </span>
                  </div>
                  <div className="p-2.5 bg-surface rounded-control border border-border">
                    <span className="text-text-subtle block">Requested Period</span>
                    <span className="font-semibold text-text font-mono mt-0.5 block">
                      {leaveDetails.startDate}
                      {leaveDetails.startDate !== leaveDetails.endDate
                        ? ` to ${leaveDetails.endDate}`
                        : ''}
                    </span>
                  </div>
                  <div className="p-2.5 bg-surface rounded-control border border-border">
                    <span className="text-text-subtle block">Duration</span>
                    <span className="font-bold text-primary-deep font-mono mt-0.5 block">
                      {leaveDetails.halfDay
                        ? '0.5 day (Half Day)'
                        : `${leaveDetails.days} ${leaveDetails.days === 1 ? 'day' : 'days'}`}
                    </span>
                  </div>
                </div>

                {leaveDetails.reason && (
                  <div className="p-2.5 bg-surface rounded-control border border-border">
                    <span className="text-text-subtle block font-semibold mb-0.5">
                      Requester Reason:
                    </span>
                    <p className="text-text italic">{leaveDetails.reason}</p>
                  </div>
                )}

                {isPending && (
                  <div className="p-2.5 rounded-control bg-primary-soft/50 border border-primary/20 text-primary-deep text-xs flex items-start gap-2">
                    <svg
                      className="w-4 h-4 shrink-0 mt-0.5 text-primary-strong"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
                      <strong>Atomic Balance Update:</strong> Approving this request will
                      immediately deduct <strong>{leaveDetails.days} day(s)</strong> from the
                      employee's balance and commit in a single database transaction.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-text-subtle italic">
                Leave request ID: {approval.subjectId}
              </div>
            )}
          </div>
        )}

        {/* Request Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-surface rounded-tile border border-border">
            <span className="text-xs text-text-subtle block">Request ID</span>
            <span className="font-mono text-xs text-text break-all mt-0.5 block">
              {approval.id}
            </span>
          </div>
          <div className="p-3 bg-surface rounded-tile border border-border">
            <span className="text-xs text-text-subtle block">Subject ID</span>
            <span className="font-mono text-xs text-text break-all mt-0.5 block">
              {approval.subjectId}
            </span>
          </div>
          <div className="p-3 bg-surface rounded-tile border border-border">
            <span className="text-xs text-text-subtle block">Date Submitted</span>
            <span className="text-text mt-0.5 block">
              {new Date(approval.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          <div className="p-3 bg-surface rounded-tile border border-border">
            <span className="text-xs text-text-subtle block">Current Stage</span>
            <div className="mt-1">
              <ApprovalStagePill
                stage={currentStageName}
                stageIndex={approval.currentStage}
                totalStages={approval.stages.length}
                isComplete={!isPending}
              />
            </div>
          </div>
        </div>

        {/* Decision History & Audit Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-text mb-3">Decision History</h4>

          {approval.decisions.length === 0 ? (
            <div className="p-4 rounded-tile bg-surface border border-dashed border-border text-center text-sm text-text-subtle">
              No decisions recorded yet. This request is waiting for{' '}
              {currentStageName === 'manager' ? 'Manager' : 'HR'} review.
            </div>
          ) : (
            <div className="space-y-3">
              {approval.decisions.map((dec, i) => (
                <div
                  key={i}
                  className="p-3.5 bg-surface rounded-tile border border-border space-y-1.5"
                  data-testid={`decision-entry-${i}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text capitalize">
                      Stage {dec.stage + 1} ({approval.stages[dec.stage] ?? 'Review'})
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        dec.outcome === 'approved'
                          ? 'bg-positive-soft text-positive-ink border border-positive-ink/20'
                          : 'bg-negative-soft text-negative-ink border border-negative-ink/20'
                      }`}
                    >
                      {dec.outcome === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                  <div className="text-xs text-text-subtle">
                    Decided at{' '}
                    {new Date(dec.decidedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </div>
                  {dec.comment && (
                    <div className="mt-2 text-sm text-text bg-surface-muted p-2 rounded-control border border-border">
                      <span className="text-xs text-text-subtle block mb-0.5">Comment:</span>
                      {dec.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
