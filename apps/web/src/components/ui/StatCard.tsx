import React from 'react';
import { Skeleton } from './Skeleton.js';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Short context under the number, e.g. "Last 7 days". */
  caption?: string;
  /** Decorative icon shown in the soft teal chip; hidden from screen readers. */
  icon?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

/** KPI tile from the MaxR Flow dashboard: label and icon chip on top, large number, caption. */
export function StatCard({
  label,
  value,
  caption,
  icon,
  isLoading = false,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`flex flex-col gap-3 p-5 bg-surface border border-border rounded-card shadow-card min-w-0 ${className}`}
      aria-busy={isLoading}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-muted">{label}</p>
        {icon && (
          <span
            className="shrink-0 w-10 h-10 rounded-full bg-primary-soft text-primary-strong flex items-center justify-center"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton variant="rectangular" height={32} width="40%" />
      ) : (
        <p className="font-display text-2xl sm:text-3xl font-bold text-text tabular-nums leading-none">
          {value}
        </p>
      )}
      {caption && <p className="text-xs text-text-subtle">{caption}</p>}
    </div>
  );
}
