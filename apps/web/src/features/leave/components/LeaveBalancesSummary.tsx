import React from 'react';
import type { LeaveBalance } from '../types';
import { EmptyState } from '../../../components/ui';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  year: number;
  onYearChange?: (year: number) => void;
  isLoading?: boolean;
}

export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  year,
  onYearChange,
  isLoading = false,
}) => {
  if (balances.length === 0 && !isLoading) {
    return (
      <EmptyState
        title={`No Leave Balances Found for ${year}`}
        description="Your leave entitlements will appear here once allocated for the current calendar year."
      />
    );
  }

  return (
    <div className="space-y-6" data-testid="leave-balances-summary">
      {/* Header & Year control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface border border-border rounded-card">
        <div>
          <h2 className="text-lg font-bold text-text font-display">
            Leave Entitlements & Balances
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Annual allocated quotas, carried forward balances, and consumed leave days for calendar
            year {year}.
          </p>
        </div>

        {onYearChange && (
          <div className="flex items-center border border-border rounded-control bg-surface-muted p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              data-testid="balance-prev-year-btn"
              aria-label="Previous year"
              className="p-1.5 hover:bg-surface rounded text-text min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span
              className="px-3 text-sm font-bold text-text font-mono"
              data-testid="balance-current-year"
            >
              {year}
            </span>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              data-testid="balance-next-year-btn"
              aria-label="Next year"
              className="p-1.5 hover:bg-surface rounded text-text min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {balances.map((balance) => {
          const totalAllotted = balance.allotted + balance.carriedForward;
          const percentageUsed =
            totalAllotted > 0 ? Math.min(100, Math.round((balance.used / totalAllotted) * 100)) : 0;
          const percentageRemaining = 100 - percentageUsed;

          return (
            <div
              key={balance.leaveTypeId}
              className="p-5 bg-surface border border-border rounded-tile shadow-card flex flex-col justify-between gap-4"
              data-testid={`leave-balance-card-${balance.code}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
                    {balance.code}
                  </span>
                  <span className="text-xs font-bold text-primary-deep font-mono">
                    {balance.remaining} days left
                  </span>
                </div>
                <h3 className="text-base font-bold text-text mt-2 font-display">{balance.name}</h3>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-text-subtle font-medium">
                  <span>Used: {balance.used}d</span>
                  <span>Total: {totalAllotted}d</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-muted overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary-deep transition-all duration-300"
                    style={{ width: `${percentageRemaining}%` }}
                    aria-valuenow={balance.remaining}
                    aria-valuemin={0}
                    aria-valuemax={totalAllotted}
                    role="progressbar"
                  />
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-center text-xs">
                <div className="p-2 rounded bg-surface-muted/60">
                  <span className="text-text-subtle block">Allotted</span>
                  <span className="font-semibold text-text mt-0.5 block">{balance.allotted}</span>
                </div>
                <div className="p-2 rounded bg-surface-muted/60">
                  <span className="text-text-subtle block">Carried</span>
                  <span className="font-semibold text-text mt-0.5 block">
                    {balance.carriedForward}
                  </span>
                </div>
                <div className="p-2 rounded bg-surface-muted/60">
                  <span className="text-text-subtle block">Used</span>
                  <span className="font-semibold text-text mt-0.5 block">{balance.used}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
