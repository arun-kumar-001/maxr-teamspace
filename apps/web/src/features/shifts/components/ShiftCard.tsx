import React from 'react';
import { Button } from '../../../components/ui/Button';
import type { Shift } from '../types';

export interface ShiftCardProps {
  shift: Shift;
  isDefault?: boolean;
  onEdit?: (shift: Shift) => void;
  canEdit?: boolean;
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  isDefault = false,
  onEdit,
  canEdit = true,
}) => {
  return (
    <div
      className={`p-4 rounded-card border bg-surface shadow-card flex flex-col justify-between space-y-4 ${
        isDefault ? 'border-primary ring-1 ring-primary/30' : 'border-border'
      }`}
      data-testid={`shift-card-${shift.id}`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
              {shift.code}
            </span>
            {isDefault && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-soft text-primary-ink border border-teal-200">
                Default
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                shift.isActive
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {shift.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <h4 className="text-base font-semibold text-text mt-1.5">{shift.name}</h4>
        </div>
      </div>

      {/* Timing Details */}
      <div className="space-y-2 py-1 text-sm border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-subtle">Working Hours:</span>
          <span className="font-semibold text-text tabular-nums">
            {shift.startTime} &ndash; {shift.endTime}
            {shift.crossesMidnight && (
              <span className="text-xs text-warning ml-1.5 font-normal">(+1 day)</span>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-text-subtle">
          <span>Grace Period:</span>
          <span className="text-text font-medium">{shift.graceMinutes} mins</span>
        </div>
        {shift.crossesMidnight && (
          <div className="text-[11px] text-warning bg-amber-50 px-2 py-1 rounded border border-amber-200">
            Overnight shift (crosses midnight)
          </div>
        )}
      </div>

      {/* Action Footer */}
      {canEdit && onEdit && (
        <div className="pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full min-h-[44px]"
            onClick={() => onEdit(shift)}
            data-testid={`edit-shift-btn-${shift.id}`}
          >
            Edit Shift
          </Button>
        </div>
      )}
    </div>
  );
};
