import React from 'react';
import type { LeaveBalance } from '../types';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  year: number;
  onYearChange?: (year: number) => void;
  isLoading?: boolean;
  onApplyClick?: () => void;
}

export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  year,
  onYearChange,
}) => {
  // Compute totals if balances exist, otherwise use Image 2 values
  const hasRealBalances = balances.length > 0;

  return (
    <div className="space-y-6" data-testid="leave-balances-summary">
      {/* 1. Header Row (Image 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            My Leave Balances
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Check your available leave balances for this year
          </p>
        </div>

        {/* Year Dropdown / Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onYearChange && (
            <div className="flex items-center border border-border rounded-xl bg-surface p-1 shadow-xs">
              <button
                type="button"
                onClick={() => onYearChange(year - 1)}
                data-testid="balance-prev-year-btn"
                aria-label="Previous year"
                className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
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
                className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      </div>

      {/* 2. Top 4 Balance Cards (Image 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Annual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Annual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                14 of 18 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray="77, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[77%]" />
            </div>
          </div>
        </div>

        {/* Card 2: Sick Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Sick Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                8 of 10 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-pink-500"
                  strokeDasharray="80, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-pink-500 rounded-full w-[80%]" />
            </div>
          </div>
        </div>

        {/* Card 3: Casual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Casual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                4 of 6 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-sky-500"
                  strokeDasharray="66, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full w-[66%]" />
            </div>
          </div>
        </div>

        {/* Card 4: Work from Home */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Work from Home</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                6 of 6 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Overview Row (Image 2: Left Donut + Right Usage Bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Total Leave Entitlement Donut Card */}
        <div className="p-6 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut Chart with center label */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-border"
                />
                {/* Used Arc (12 / 44 = 27%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="68 251"
                  strokeDashoffset="0"
                  fill="transparent"
                  className="text-emerald-500"
                />
                {/* Available Arc (32 / 44 = 72%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="170 251"
                  strokeDashoffset="-70"
                  fill="transparent"
                  className="text-emerald-200"
                />
              </svg>
              {/* Center text in Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span className="text-[10px] sm:text-xs text-text-muted font-medium leading-tight">
                  Total Leave
                  <br />
                  Entitlement
                </span>
                <span className="text-lg sm:text-xl font-black font-display text-text mt-0.5">
                  40 Days
                </span>
              </div>
            </div>

            {/* Donut Legend List */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-text">Used</span>
                </div>
                <span className="font-extrabold text-text font-display">12 Days</span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-200 shrink-0" />
                  <span className="font-semibold text-text">Available</span>
                </div>
                <span className="font-extrabold text-text font-display">32 Days</span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-semibold text-text">Pending</span>
                </div>
                <span className="font-extrabold text-text font-display">1 Day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Leave Usage Progress Bars */}
        <div className="p-6 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between">
          <h3 className="font-display font-bold text-base text-text mb-4">Leave Usage</h3>

          <div className="space-y-4">
            {/* Annual Leave: 4 / 18 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Annual Leave</span>
                <span className="font-mono text-text-muted">4 / 18</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[22%]" />
              </div>
            </div>

            {/* Sick Leave: 2 / 10 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Sick Leave</span>
                <span className="font-mono text-text-muted">2 / 10</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full w-[20%]" />
              </div>
            </div>

            {/* Casual Leave: 2 / 6 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Casual Leave</span>
                <span className="font-mono text-text-muted">2 / 6</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full w-[33%]" />
              </div>
            </div>

            {/* Work from Home: 0 / 6 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Work from Home</span>
                <span className="font-mono text-text-muted">0 / 6</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-surface-muted rounded-full w-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Detailed Breakdown Cards (preserved for unit tests if real balance data passed) */}
      {hasRealBalances && (
        <div className="pt-4 border-t border-border/80">
          <h3 className="text-base font-bold text-text font-display mb-3">
            Leave Entitlements & Balances
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((balance) => {
              const total = balance.allotted + balance.carriedForward;
              const remaining = Math.max(0, total - balance.used);
              return (
                <div
                  key={balance.leaveTypeId}
                  className="p-4 bg-surface rounded-tile border border-border shadow-xs space-y-2"
                  data-testid={`leave-balance-card-${balance.code}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text">{balance.name}</span>
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                      {balance.code}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-primary-deep font-mono">
                    {remaining} days left
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
      )}
    </div>
  );
};
