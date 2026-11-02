import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { ApprovalStagePill } from './ApprovalStagePill';
import type { Approval } from '../types';

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
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-rose-50 text-rose-800'
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
