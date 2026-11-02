import React from 'react';
import type { LeavePolicy } from '../types';
import { Badge, Button } from '../../../components/ui';

export interface LeavePolicyCardProps {
  policy: LeavePolicy;
  onEdit?: (policy: LeavePolicy) => void;
  canManage?: boolean;
}

export const LeavePolicyCard: React.FC<LeavePolicyCardProps> = ({
  policy,
  onEdit,
  canManage = false,
}) => {
  return (
    <div
      className="p-5 bg-surface border border-border rounded-tile shadow-card hover:border-primary transition-colors flex flex-col justify-between gap-4"
      data-testid={`leave-policy-card-${policy.id}`}
    >
      {/* Header & Badges */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
              {policy.code}
            </span>
            <Badge variant={policy.isActive ? 'success' : 'neutral'}>
              {policy.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {policy.hasBalance ? (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep border border-primary/20">
                Quota Managed
              </span>
            ) : (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border">
                Uncredited / Unlimited
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-text mt-2 font-display">{policy.name}</h3>
        </div>

        {canManage && onEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(policy)}
            data-testid={`edit-policy-btn-${policy.id}`}
            aria-label={`Edit ${policy.name} policy`}
            className="min-h-[44px]"
          >
            Edit
          </Button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border text-xs">
        <div className="p-2 rounded bg-surface-muted/60">
          <span className="text-text-subtle block">Annual Quota</span>
          <span className="font-semibold text-text text-sm">
            {policy.hasBalance ? `${policy.annualDays} days` : 'N/A'}
          </span>
        </div>
        <div className="p-2 rounded bg-surface-muted/60">
          <span className="text-text-subtle block">Carry Forward</span>
          <span className="font-semibold text-text text-sm">
            {policy.hasBalance ? `${policy.carryForwardMax} days` : 'N/A'}
          </span>
        </div>
        <div className="p-2 rounded bg-surface-muted/60">
          <span className="text-text-subtle block">Half Day</span>
          <span className="font-semibold text-text text-sm">
            {policy.allowHalfDay ? 'Permitted' : 'Full Day Only'}
          </span>
        </div>
        <div className="p-2 rounded bg-surface-muted/60">
          <span className="text-text-subtle block">Max Backdate</span>
          <span className="font-semibold text-text text-sm">
            {policy.maxBackdateDays > 0 ? `${policy.maxBackdateDays} days` : 'None (Prior only)'}
          </span>
        </div>
      </div>
    </div>
  );
};
