import React from 'react';
import type { LeaveRequest } from '../types';
import { Badge, Button } from '../../../components/ui';

export interface LeaveRequestCardProps {
  request: LeaveRequest;
  onCancel?: (id: string) => Promise<void>;
  isCancelling?: boolean;
}

export const LeaveRequestCard: React.FC<LeaveRequestCardProps> = ({
  request,
  onCancel,
  isCancelling = false,
}) => {
  const statusVariantMap = {
    applied: 'primary' as const,
    pending: 'warning' as const,
    approved: 'success' as const,
    rejected: 'danger' as const,
    cancelled: 'neutral' as const,
  };

  const statusLabelMap = {
    applied: 'Applied',
    pending: 'Pending Approval',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  };

  const isCancellable =
    (request.status === 'applied' ||
      request.status === 'pending' ||
      request.status === 'approved') &&
    Boolean(onCancel);

  return (
    <div
      className="p-5 bg-surface border border-border rounded-tile shadow-card flex flex-col justify-between gap-4"
      data-testid={`leave-request-card-${request.id}`}
    >
      <div>
        {/* Header & Status */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
                {request.leaveTypeCode}
              </span>
              <span className="text-sm font-bold text-text font-display">
                {request.leaveTypeName}
              </span>
            </div>
            <p className="text-xs text-text-subtle mt-1 font-mono">
              Applied on {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>

          <Badge variant={statusVariantMap[request.status]}>{statusLabelMap[request.status]}</Badge>
        </div>

        {/* Dates & Duration */}
        <div className="mt-4 p-3 rounded-control bg-surface-muted/60 border border-border space-y-1 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-text-subtle">Dates:</span>
            <span className="font-medium text-text font-mono">
              {request.startDate}{' '}
              {request.startDate !== request.endDate ? `to ${request.endDate}` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-subtle">Duration:</span>
            <span className="font-bold text-primary-deep font-mono">
              {request.halfDay
                ? '0.5 day (Half Day)'
                : `${request.days} ${request.days === 1 ? 'day' : 'days'}`}
            </span>
          </div>
        </div>

        {/* Reason if available */}
        {request.reason && (
          <div className="mt-3 text-xs text-text bg-surface-muted/30 p-2.5 rounded border border-border/60">
            <span className="text-text-subtle block font-semibold mb-0.5">Reason:</span>
            <p className="italic">{request.reason}</p>
          </div>
        )}
      </div>

      {/* Cancel Action */}
      {isCancellable && onCancel && (
        <div className="flex justify-end pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  `Cancel leave request for ${request.leaveTypeName} (${request.startDate})?`,
                )
              ) {
                onCancel(request.id);
              }
            }}
            disabled={isCancelling}
            data-testid={`cancel-leave-btn-${request.id}`}
            className="min-h-[44px] hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
          >
            Cancel Request
          </Button>
        </div>
      )}
    </div>
  );
};
