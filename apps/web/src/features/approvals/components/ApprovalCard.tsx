import React from 'react';
import { Button } from '../../../components/ui/Button';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { ApprovalStagePill } from './ApprovalStagePill';
import type { Approval } from '../types';

export interface ApprovalCardProps {
  approval: Approval;
  onApprove: (approval: Approval) => void;
  onReject: (approval: Approval) => void;
  onViewDetails: (approval: Approval) => void;
  canDecide?: boolean;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  onApprove,
  onReject,
  onViewDetails,
  canDecide = true,
}) => {
  const isPending = approval.status === 'pending';
  const currentStageName = approval.stages[approval.currentStage];
  const formattedSubject = approval.subjectType.replace(/_/g, ' ');

  return (
    <div
      className="bg-surface rounded-card p-4 border border-border shadow-card flex flex-col justify-between space-y-4"
      data-testid={`approval-card-${approval.id}`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs uppercase tracking-wider text-text-subtle font-medium">
            {formattedSubject}
          </span>
          <h4 className="text-base font-semibold text-text mt-0.5">{approval.requesterName}</h4>
        </div>
        <ApprovalStatusBadge status={approval.status} size="sm" />
      </div>

      {/* Middle Stage & Date Information */}
      <div className="space-y-2 py-1 text-sm border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-subtle">Workflow Stage:</span>
          <ApprovalStagePill
            stage={currentStageName}
            stageIndex={approval.currentStage}
            totalStages={approval.stages.length}
            isComplete={!isPending}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-text-subtle">
          <span>Submitted:</span>
          <span className="text-text">
            {new Date(approval.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 min-h-[44px]"
          onClick={() => onViewDetails(approval)}
          data-testid={`card-details-button-${approval.id}`}
        >
          Details
        </Button>
        {isPending && canDecide && (
          <>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="flex-1 min-h-[44px]"
              onClick={() => onReject(approval)}
              data-testid={`card-reject-button-${approval.id}`}
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="flex-1 min-h-[44px]"
              onClick={() => onApprove(approval)}
              data-testid={`card-approve-button-${approval.id}`}
            >
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
