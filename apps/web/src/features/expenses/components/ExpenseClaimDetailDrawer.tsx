import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { cancelClaim, getReceiptDownloadLink, reimburseClaim } from '../api/expensesApi';
import type { ExpenseClaim } from '../types';
import { formatPaiseToInr } from '../types';
import { ExpenseStatusPill } from './ExpenseStatusPill';

interface ExpenseClaimDetailDrawerProps {
  claim: ExpenseClaim | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserEmployeeId?: string;
  isHrOrAdmin?: boolean;
  onClaimUpdated: (updated: ExpenseClaim) => void;
}

export const ExpenseClaimDetailDrawer: React.FC<ExpenseClaimDetailDrawerProps> = ({
  claim,
  isOpen,
  onClose,
  currentUserEmployeeId,
  isHrOrAdmin,
  onClaimUpdated,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReimbursing, setIsReimbursing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!claim) return null;

  const isOwner = currentUserEmployeeId === claim.employeeId;
  const canCancel = claim.status === 'submitted' && isOwner;
  const canReimburse = claim.status === 'approved' && isHrOrAdmin;

  const handleDownloadReceipt = async () => {
    if (!claim.receiptStorageKey) return;
    setIsDownloading(true);
    setError(null);
    try {
      const link = await getReceiptDownloadLink(claim.id);
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download receipt');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelClaim = async () => {
    if (!window.confirm('Are you sure you want to cancel this expense claim?')) return;
    setIsCancelling(true);
    setError(null);
    try {
      const updated = await cancelClaim(claim.id);
      onClaimUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel claim');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReimburseClaim = async () => {
    setIsReimbursing(true);
    setError(null);
    try {
      const updated = await reimburseClaim(claim.id);
      onClaimUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reimburse claim');
    } finally {
      setIsReimbursing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Expense Claim Details"
      maxWidth="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3 w-full">
          <div>
            {canCancel && (
              <Button
                variant="danger"
                onClick={handleCancelClaim}
                isLoading={isCancelling}
                disabled={isCancelling}
              >
                Cancel Claim
              </Button>
            )}
            {canReimburse && (
              <Button
                variant="primary"
                onClick={handleReimburseClaim}
                isLoading={isReimbursing}
                disabled={isReimbursing}
              >
                Mark Reimbursed
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-1">
        {error && (
          <div
            className="p-3 text-sm text-negative-ink bg-negative-soft border border-negative-soft-border rounded-control"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-muted rounded-card border border-border">
          <div>
            <span className="text-xs font-semibold text-text-subtle tracking-wider uppercase">
              Amount
            </span>
            <div className="text-2xl sm:text-3xl font-display font-semibold text-text">
              {formatPaiseToInr(claim.amountPaise)}
            </div>
          </div>
          <div>
            <ExpenseStatusPill status={claim.status} size="md" />
          </div>
        </div>

        {/* Claim Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-text-muted">Claimant</span>
            <p className="font-medium text-text mt-0.5">
              {claim.employeeName || 'Unknown Employee'}
              {claim.employeeCode && (
                <span className="text-xs text-text-muted ml-1.5">
                  ({claim.employeeCode})
                </span>
              )}
            </p>
          </div>

          <div>
            <span className="text-xs text-text-muted">Category</span>
            <p className="font-medium text-text mt-0.5">
              {claim.categoryName || 'General'}
            </p>
          </div>

          <div>
            <span className="text-xs text-text-muted">Expense Date</span>
            <p className="font-medium text-text mt-0.5">{claim.expenseDate}</p>
          </div>

          <div>
            <span className="text-xs text-text-muted">Submitted At</span>
            <p className="font-medium text-text mt-0.5">
              {new Date(claim.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <span className="text-xs text-text-muted">Business Purpose & Notes</span>
          <div className="mt-1 p-3 bg-surface-raised border border-border rounded-control text-sm text-text whitespace-pre-wrap">
            {claim.description}
          </div>
        </div>

        {/* Rejection / Reimbursement Banners */}
        {claim.status === 'rejected' && claim.rejectionReason && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-control text-sm text-rose-800">
            <span className="font-semibold block mb-0.5">Rejection Reason:</span>
            {claim.rejectionReason}
          </div>
        )}

        {claim.status === 'reimbursed' && (
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-control text-sm text-teal-800">
            <span className="font-semibold block mb-0.5">Reimbursement Info:</span>
            Reimbursed on {claim.reimbursedAt ? new Date(claim.reimbursedAt).toLocaleDateString() : '—'}
            {claim.reimbursedByName && ` by ${claim.reimbursedByName}`}.
          </div>
        )}

        {/* Receipt Section */}
        <div className="pt-2 border-t border-border">
          <span className="text-xs text-text-muted">Attached Receipt</span>
          <div className="mt-2 flex items-center justify-between p-3 bg-surface-raised border border-border rounded-tile">
            {claim.receiptStorageKey ? (
              <>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-text truncate">
                      {claim.receiptFilename || 'Receipt document'}
                    </p>
                    {claim.receiptFileSize && (
                      <p className="text-xs text-text-muted">
                        {(claim.receiptFileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadReceipt}
                  isLoading={isDownloading}
                  disabled={isDownloading}
                >
                  View Receipt
                </Button>
              </>
            ) : (
              <p className="text-sm text-text-muted italic">No receipt attached</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
