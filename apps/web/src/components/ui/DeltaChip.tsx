export interface DeltaChipProps {
  /** Text shown in the chip, e.g. "+11.9%" or "−1.5%". */
  label: string;
  direction: 'up' | 'down';
  /** Whether this change is good. Defaults to up = good (set false for costs, refunds, late check-ins). */
  isGood?: boolean;
  className?: string;
}

/** Soft green or red chip with an arrow; the arrow and sign carry the meaning, not only the colour. */
export function DeltaChip({ label, direction, isGood, className = '' }: DeltaChipProps) {
  const good = isGood ?? direction === 'up';
  const tone = good ? 'bg-positive-soft text-positive-ink' : 'bg-negative-soft text-negative-ink';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${tone} ${className}`}
    >
      <svg
        viewBox="0 0 12 12"
        className={`w-3 h-3 ${direction === 'down' ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
      </svg>
      <span className="sr-only">{direction === 'up' ? 'Up' : 'Down'}</span>
      {label}
    </span>
  );
}
