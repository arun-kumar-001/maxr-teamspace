import { MEETING_STATUS_LABELS, type MeetingStatus } from '../types';

export interface MeetingStatusBadgeProps {
  status: MeetingStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function MeetingStatusBadge({
  status,
  size = 'sm',
  className = '',
}: MeetingStatusBadgeProps) {
  const isScheduled = status === 'scheduled';
  const label = MEETING_STATUS_LABELS[status] || status;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  const toneClasses = isScheduled
    ? 'bg-primary-soft text-primary-ink border-primary-soft-border'
    : 'bg-negative-soft text-danger border-border';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${sizeClasses} ${toneClasses} ${className}`}
      data-testid={`meeting-status-badge-${status}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isScheduled ? 'bg-primary-strong' : 'bg-danger'}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
