import React from 'react';
import { Skeleton } from './Skeleton.js';
import { DeltaChip, type DeltaChipProps } from './DeltaChip.js';

export interface MetricContentProps {
  label: string;
  value: React.ReactNode;
  /** Decorative icon in the small soft-teal square; hidden from screen readers. */
  icon?: React.ReactNode;
  delta?: Omit<DeltaChipProps, 'className'>;
  /** Comparison next to the delta, e.g. "vs 2,407". */
  comparison?: string;
  /** Plain caption when there is no delta, e.g. "Checked in by 10:00". */
  caption?: string;
  isLoading?: boolean;
}

/** Label row, big number, then delta + comparison (or caption). Shared by StatCard and MetricStrip. */
export function MetricContent({
  label,
  value,
  icon,
  delta,
  comparison,
  caption,
  isLoading = false,
}: MetricContentProps) {
  return (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span
            className="shrink-0 w-8 h-8 rounded-lg bg-primary-soft text-primary-strong flex items-center justify-center"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <span className="text-sm font-medium text-text truncate">{label}</span>
      </div>
      {isLoading ? (
        <Skeleton variant="rectangular" height={32} width="50%" />
      ) : (
        <span className="block font-display text-2xl sm:text-[28px] font-semibold text-text tabular-nums leading-none">
          {value}
        </span>
      )}
      {(delta || comparison) && (
        <span className="flex flex-wrap items-center gap-2">
          {delta && <DeltaChip {...delta} />}
          {comparison && <span className="text-xs text-text-subtle">{comparison}</span>}
        </span>
      )}
      {caption && <span className="text-xs text-text-subtle">{caption}</span>}
    </>
  );
}

export interface StatCardProps extends MetricContentProps {
  className?: string;
}

/** Stand-alone KPI card. */
export function StatCard({ className = '', isLoading = false, ...content }: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 p-5 bg-surface border border-border rounded-card shadow-card min-w-0 ${className}`}
      aria-busy={isLoading}
    >
      <MetricContent {...content} isLoading={isLoading} />
    </div>
  );
}
