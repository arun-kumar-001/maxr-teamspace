import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import type { Approval, ApprovalOutcome } from '../types';

export interface ApprovalDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  approval: Approval | null;
  outcome: ApprovalOutcome | null;
  onConfirm: (comment: string) => Promise<void>;
}

export const ApprovalDecisionModal: React.FC<ApprovalDecisionModalProps> = ({
  isOpen,
  onClose,
  approval,
  outcome,
  onConfirm,
}) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !approval || !outcome) return null;

  const isReject = outcome === 'rejected';
  const title = isReject ? 'Reject Request' : 'Approve Request';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReject && !comment.trim()) {
      setError('Please provide a reason for rejecting this request.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onConfirm(comment);
      setComment('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedSubject = approval.subjectType.replace(/_/g, ' ');

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          setComment('');
          setError(null);
          onClose();
        }
      }}
      title={title}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setComment('');
              setError(null);
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={isReject ? 'danger' : 'primary'}
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-testid="confirm-decision-button"
          >
            {isSubmitting ? 'Submitting...' : isReject ? 'Confirm Rejection' : 'Confirm Approval'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="rounded-tile bg-surface-muted p-3.5 border border-border text-sm">
          <p className="text-text font-medium">{approval.requesterName}</p>
          <p className="text-text-muted capitalize">{formattedSubject}</p>
          <p className="text-xs text-text-subtle mt-1">
            Submitted on{' '}
            {new Date(approval.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        {isReject ? (
          <p className="text-sm text-text-muted">
            Provide a mandatory rejection reason to inform the requester why this request could not
            be approved.
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            You are approving this request. You may optionally include a note or instruction below.
          </p>
        )}

        <FormField
          label={isReject ? 'Rejection Reason (Required)' : 'Note / Comment (Optional)'}
          htmlFor="approval-comment"
          required={isReject}
          error={error ?? undefined}
        >
          <textarea
            id="approval-comment"
            data-testid="approval-comment-input"
            rows={3}
            maxLength={500}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong transition-colors min-h-[88px]"
            placeholder={
              isReject ? 'Explain why this request is being rejected...' : 'Optional comment...'
            }
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
          />
        </FormField>
      </form>
    </Modal>
  );
};
