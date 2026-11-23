import React from 'react';
import type { LeaveBalance, LeavePolicy } from '../types';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  /** The leave types set up in Leave Setup. Each active one gets a card, with or without a balance. */
  policies?: LeavePolicy[];
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

/** One colour per leave type, in the order of the cards. Full class names so Tailwind keeps them. */
const TYPE_COLORS = [
  { fill: 'bg-chart-1', ink: 'text-chart-ink-1' },
  { fill: 'bg-chart-2', ink: 'text-chart-ink-2' },
  { fill: 'bg-chart-3', ink: 'text-chart-ink-3' },
  { fill: 'bg-chart-4', ink: 'text-chart-ink-4' },
  { fill: 'bg-chart-5', ink: 'text-chart-ink-5' },
  { fill: 'bg-chart-6', ink: 'text-chart-ink-6' },
  { fill: 'bg-chart-7', ink: 'text-chart-ink-7' },
] as const;

const colorAt = (index: number) =>
  TYPE_COLORS[index % TYPE_COLORS.length] as (typeof TYPE_COLORS)[number];

const DONUT_RADIUS = 40;
const DONUT_LENGTH = 2 * Math.PI * DONUT_RADIUS;

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

interface LeaveCard {
  key: string;
  code: string;
  name: string;
  balance: LeaveBalance | null;
  note: string | null;
}

/**
 * One card per active leave type from Leave Setup. A type with no yearly balance (a short
 * permission, unpaid leave) still shows, so the page matches what can be applied for. A type that
 * was switched off stays only while some of it was used.
 */
function buildCards(balances: LeaveBalance[], policies?: LeavePolicy[]): LeaveCard[] {
  const fromBalance = (b: LeaveBalance): LeaveCard => ({
    key: b.leaveTypeId,
    code: b.code,
    name: b.name,
    balance: b,
    note: null,
  });
  if (!policies) return balances.map(fromBalance);

  const cards: LeaveCard[] = [];
  const seen = new Set<string>();
  for (const policy of policies.filter((p) => p.isActive)) {
    const balance = balances.find((b) => b.leaveTypeId === policy.id || b.code === policy.code);
    seen.add(policy.code);
    if (balance) cards.push(fromBalance(balance));
    else
      cards.push({
        key: policy.id,
        code: policy.code,
        name: policy.name,
        balance: null,
        note: policy.hasBalance
          ? 'No balance allotted for this year yet'
          : 'No yearly limit. Apply when needed; approval is required.',
      });
  }
  for (const balance of balances) {
    if (!seen.has(balance.code) && balance.used > 0) cards.push(fromBalance(balance));
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every number here comes from the server's balances, which exist only for leave types created in
 * Leave Setup. Nothing is invented: no balances means an honest empty state.
 */
export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  policies,
  year,
  onYearChange,
  isLoading = false,
  onApplyClick,
}) => {
  const cards = buildCards(balances, policies);
  const counted = cards.flatMap((c) => (c.balance ? [c.balance] : []));
  const totalDays = counted.reduce((sum, b) => sum + totalOf(b), 0);
  const usedDays = counted.reduce((sum, b) => sum + b.used, 0);
  const availableDays = counted.reduce((sum, b) => sum + remainingOf(b), 0);

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

      {isLoading && cards.length === 0 ? (
        <p role="status" className="text-sm text-text-muted" data-testid="leave-balances-loading">
          Loading your leave balances…
        </p>
      ) : cards.length === 0 ? (
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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-4">
            <section
              className="p-5 bg-surface rounded-card border border-border shadow-card"
              aria-label="Leave overview"
              data-testid="leave-balances-donut"
            >
              <h3 className="text-base font-bold text-text font-display mb-4">Leave overview</h3>
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-40 h-40 shrink-0">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-40 h-40 -rotate-90"
                    role="img"
                    aria-label={`${usedDays} days used, ${availableDays} days balance, of ${totalDays}`}
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r={DONUT_RADIUS}
                      fill="none"
                      strokeWidth="12"
                      className="stroke-chart-2"
                      strokeOpacity={totalDays > 0 ? 1 : 0.2}
                    />
                    {totalDays > 0 && usedDays > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r={DONUT_RADIUS}
                        fill="none"
                        strokeWidth="12"
                        strokeLinecap="butt"
                        className="stroke-chart-5"
                        strokeDasharray={`${Math.min(1, usedDays / totalDays) * DONUT_LENGTH} ${DONUT_LENGTH}`}
                        data-testid="leave-donut-used"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-extrabold font-display text-text leading-none">
                      {availableDays}
                    </span>
                    <span className="text-[11px] font-semibold text-text-muted mt-1">
                      days balance
                    </span>
                  </div>
                </div>
                <dl className="w-full space-y-2.5" data-testid="leave-balances-totals">
                  {[
                    { label: 'Used', value: usedDays, dot: 'bg-chart-5' },
                    { label: 'Balance', value: availableDays, dot: 'bg-chart-2' },
                    { label: 'Total entitlement', value: totalDays, dot: 'bg-border-strong' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-2 text-sm text-text-muted">
                        <span
                          aria-hidden="true"
                          className={`w-2.5 h-2.5 rounded-full ${item.dot}`}
                        />
                        {item.label}
                      </dt>
                      <dd className="text-sm font-extrabold text-text font-display">
                        {item.value} <span className="font-semibold text-text-muted">days</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section
              className="p-5 bg-surface rounded-card border border-border shadow-card"
              aria-label="Leave by type"
              data-testid="leave-balances-bars"
            >
              <h3 className="text-base font-bold text-text font-display mb-4">Leave by type</h3>
              <ul className="space-y-4">
                {cards.map((card, index) => {
                  const color = colorAt(index);
                  const { balance } = card;
                  const total = balance ? totalOf(balance) : 0;
                  return (
                    <li key={card.key} data-testid={`leave-type-bar-${card.code}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-semibold text-text min-w-0">
                          <span
                            aria-hidden="true"
                            className={`w-3 h-3 rounded-full shrink-0 ${color.fill}`}
                          />
                          <span className="truncate">{card.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-text-muted">
                          {balance
                            ? `${balance.used} used · ${remainingOf(balance)} left of ${total}`
                            : card.note}
                        </span>
                      </div>
                      {balance && (
                        <div
                          className="mt-1.5 h-3 rounded-full bg-surface-muted overflow-hidden"
                          role="progressbar"
                          aria-label={`${card.name} used`}
                          aria-valuemin={0}
                          aria-valuemax={total}
                          aria-valuenow={balance.used}
                        >
                          <div
                            className={`h-full rounded-full ${color.fill}`}
                            style={{ width: `${percent(balance.used, total)}%` }}
                            data-testid={`leave-type-fill-${card.code}`}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
