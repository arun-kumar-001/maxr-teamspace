import React from 'react';
import type { LeaveBalance } from '../types';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  year: number;
  onYearChange?: (year: number) => void;
  isLoading?: boolean;
  onApplyClick?: () => void;
}

function totalOf(balance: LeaveBalance): number {
  return balance.allotted + balance.carriedForward;
}

function remainingOf(balance: LeaveBalance): number {
  return Math.max(0, totalOf(balance) - balance.used);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

const YearArrow: React.FC<{ direction: 'prev' | 'next' }> = ({ direction }) => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d={direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
    />
  </svg>
);

/**
 * Every number here comes from the server's balances, which exist only for leave types created in
 * Leave Setup. Nothing is invented: no balances means an honest empty state.
 */
export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  year,
  onYearChange,
  isLoading = false,
  onApplyClick,
}) => {
  const totalDays = balances.reduce((sum, b) => sum + totalOf(b), 0);
  const usedDays = balances.reduce((sum, b) => sum + b.used, 0);
  const availableDays = balances.reduce((sum, b) => sum + remainingOf(b), 0);

  return (
    <div className="space-y-6" data-testid="leave-balances-summary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            My Leave Balances
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Leave types come from Leave Setup. Check what is left for {year}.
          </p>
        </div>

        {onYearChange && (
          <div className="flex items-center border border-border rounded-xl bg-surface p-1 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              data-testid="balance-prev-year-btn"
              aria-label="Previous year"
              className="p-2 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <YearArrow direction="prev" />
            </button>
            <span
              className="px-2.5 text-xs font-bold text-text font-mono"
              data-testid="balance-current-year"
            >
              Year: {year}
            </span>
            <button
              type="button"
              onClick={() => onYearChange(year + 1)}
              data-testid="balance-next-year-btn"
              aria-label="Next year"
              className="p-2 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <YearArrow direction="next" />
            </button>
          </div>
        )}
      </div>

      {isLoading && balances.length === 0 ? (
        <p role="status" className="text-sm text-text-muted" data-testid="leave-balances-loading">
          Loading your leave balances…
        </p>
      ) : balances.length === 0 ? (
        <div
          className="p-8 bg-surface rounded-card border border-dashed border-border text-center space-y-2"
          data-testid="leave-balances-empty"
        >
          <h3 className="text-base font-bold text-text font-display">No leave balances yet</h3>
          <p className="text-sm text-text-muted max-w-prose mx-auto">
            Balances appear here for each leave type with a yearly allowance set up in Leave Setup.
            Nothing has been set up for {year} yet.
          </p>
          {onApplyClick && (
            <button
              type="button"
              onClick={onApplyClick}
              className="mt-2 min-h-[44px] px-4 rounded-control bg-primary-deep text-white text-sm font-semibold"
            >
              Apply for leave
            </button>
          )}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="leave-balances-totals">
            {[
              { label: 'Total entitlement', value: totalDays },
              { label: 'Used', value: usedDays },
              { label: 'Available', value: availableDays },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 bg-surface rounded-card border border-border shadow-card"
              >
                <dt className="text-xs font-bold text-text-muted">{item.label}</dt>
                <dd className="text-2xl font-extrabold text-text font-display mt-1">
                  {item.value} <span className="text-sm font-semibold text-text-muted">days</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="pt-4 border-t border-border/80">
            <h3 className="text-base font-bold text-text font-display mb-3">
              Leave Entitlements & Balances
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {balances.map((balance) => {
                const total = totalOf(balance);
                const usedPercent = percent(balance.used, total);
                return (
                  <div
                    key={balance.leaveTypeId}
                    className="p-4 bg-surface rounded-tile border border-border shadow-xs space-y-2"
                    data-testid={`leave-balance-card-${balance.code}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-text">{balance.name}</span>
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                        {balance.code}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-primary-ink font-mono">
                      {remainingOf(balance)} days left
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${balance.name} used`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={usedPercent}
                      className="h-2 rounded-full bg-surface-muted overflow-hidden"
                    >
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${usedPercent}%` }}
                        data-testid={`leave-balance-bar-${balance.code}`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-text-muted pt-1 border-t border-border/60">
                      <span>Used: {balance.used}d</span>
                      <span>Total: {total}d</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
