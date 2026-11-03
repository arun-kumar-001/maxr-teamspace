import { RSVP_LABELS, type Rsvp } from '../types';

export interface RsvpBadgeProps {
  rsvp: Rsvp | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function RsvpBadge({ rsvp, size = 'sm', className = '' }: RsvpBadgeProps) {
  if (!rsvp) return null;

  const label = RSVP_LABELS[rsvp] || rsvp;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  let toneClasses = 'bg-surface-muted text-text-subtle border-border';
  let dotClass = 'bg-text-subtle';

  if (rsvp === 'accepted') {
    toneClasses = 'bg-positive-soft text-positive-ink border-border';
    dotClass = 'bg-positive-ink';
  } else if (rsvp === 'declined') {
    toneClasses = 'bg-negative-soft text-danger border-border';
    dotClass = 'bg-danger';
  } else if (rsvp === 'tentative') {
    toneClasses = 'bg-tile-yellow text-warning border-border';
    dotClass = 'bg-warning';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${toneClasses} ${className}`}
      data-testid={`rsvp-badge-${rsvp}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}
