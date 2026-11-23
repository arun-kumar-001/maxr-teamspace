import type { AttendanceStatus } from '../types';

export interface AttendanceStatusBadgeProps {
  status: AttendanceStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  label: string;
  container: string;
  dot: string;
}

const STATUS_CONFIGS: Record<AttendanceStatus, StatusConfig> = {
  present: {
    label: 'Present',
    container: 'bg-positive-soft text-positive-ink border border-positive-ink/20',
    dot: 'bg-positive-ink',
  },
  late: {
    label: 'Late',
    container: 'bg-amber-50 text-amber-800 border border-amber-200',
    dot: 'bg-amber-600',
  },
  half_day: {
    label: 'Half Day',
    container: 'bg-orange-50 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
  },
  absent: {
    label: 'Absent',
    container: 'bg-negative-soft text-negative-ink border border-negative-ink/20',
    dot: 'bg-negative-ink',
  },
  on_leave: {
    label: 'On Leave',
    container: 'bg-blue-50 text-blue-800 border border-blue-200',
    dot: 'bg-blue-600',
  },
  holiday: {
    label: 'Holiday',
    container: 'bg-purple-50 text-purple-800 border border-purple-200',
    dot: 'bg-purple-600',
  },
  weekend: {
    label: 'Weekend',
    container: 'bg-surface-muted text-text-muted border border-border',
    dot: 'bg-text-subtle',
  },
};

export function AttendanceStatusBadge({
  status,
  size = 'md',
  className = '',
}: AttendanceStatusBadgeProps) {
  const config = STATUS_CONFIGS[status] ?? {
    label: status,
    container: 'bg-surface-muted text-text-muted border border-border',
    dot: 'bg-text-subtle',
  };

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1.5' : 'px-2.5 py-1 text-xs sm:text-sm gap-2';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.container} ${sizeClasses} ${className}`}
      data-testid={`attendance-status-${status}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
}
