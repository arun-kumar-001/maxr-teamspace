import React from 'react';

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the group, e.g. "Date range". */
  ariaLabel: string;
  className?: string;
}

/** Single-choice pill group (the "7 Days / 30 Days / 90 Days" switch in MaxR Flow). */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps) {
  const select = (index: number, e: React.KeyboardEvent) => {
    const next = options[(index + options.length) % options.length];
    if (!next) return;
    e.preventDefault();
    onChange(next.value);
    (
      e.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined
    )?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') select(index + 1, e);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') select(index - 1, e);
    else if (e.key === 'Home') select(0, e);
    else if (e.key === 'End') select(options.length - 1, e);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 p-1 bg-surface border border-border-strong rounded-full shadow-card ${className}`}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`min-h-[44px] sm:min-h-[36px] px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong ${
              checked
                ? 'bg-primary-deep text-white'
                : 'text-text-muted hover:text-text hover:bg-primary-soft'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
