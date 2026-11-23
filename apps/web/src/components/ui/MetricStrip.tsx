import React from 'react';
import { MetricContent, type MetricContentProps } from './StatCard.js';

export interface MetricOption extends MetricContentProps {
  id: string;
}

export interface MetricStripProps {
  metrics: MetricOption[];
  /** Selected metric, e.g. the one the chart below shows. */
  selected: string;
  onSelect: (id: string) => void;
  /** Accessible name, e.g. "Metric shown in the chart". */
  ariaLabel: string;
  className?: string;
}

/** Row of selectable KPI tiles on a tinted track; the selected tile is raised and white. */
export function MetricStrip({
  metrics,
  selected,
  onSelect,
  ariaLabel,
  className = '',
}: MetricStripProps) {
  const move = (index: number, e: React.KeyboardEvent) => {
    const target = (index + metrics.length) % metrics.length;
    const next = metrics[target];
    if (!next) return;
    e.preventDefault();
    onSelect(next.id);
    (e.currentTarget.parentElement?.children[target] as HTMLElement | undefined)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-1 p-1.5 bg-surface-muted border border-border rounded-[20px] ${className}`}
    >
      {metrics.map(({ id, ...content }, index) => {
        const checked = id === selected;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(index + 1, e);
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(index - 1, e);
              else if (e.key === 'Home') move(0, e);
              else if (e.key === 'End') move(metrics.length - 1, e);
            }}
            className={`flex flex-col items-start gap-3 p-4 text-left rounded-tile min-w-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong ${
              checked ? 'bg-surface-raised shadow-raised' : 'hover:bg-surface-raised'
            }`}
          >
            <MetricContent {...content} />
          </button>
        );
      })}
    </div>
  );
}
