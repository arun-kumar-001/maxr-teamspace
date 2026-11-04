import type { AuditOutcome } from '../types';

interface AuditOutcomeBadgeProps {
  outcome: AuditOutcome;
  className?: string;
}

const OUTCOME_CONFIG: Record<AuditOutcome, { label: string; container: string; dot: string }> = {
  success: {
    label: 'Success',
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  denied: {
    label: 'Denied',
    container: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-600',
  },
  failure: {
    label: 'Failure',
    container: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
  },
};

export function AuditOutcomeBadge({ outcome, className = '' }: AuditOutcomeBadgeProps) {
  const config = OUTCOME_CONFIG[outcome] || {
    label: outcome,
    container: 'bg-surface-muted text-text-muted border-border',
    dot: 'bg-text-subtle',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.container} ${className}`}
      data-testid={`outcome-badge-${outcome}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
