import type { ReactNode } from 'react';

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(diffSeconds)) return dateString;
    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateString;
  }
}

export interface NotificationTypeStyle {
  label: string;
  badgeClass: string;
  iconBgClass: string;
  iconTextClass: string;
  icon: ReactNode;
}

export function getNotificationTypeStyle(type: string): NotificationTypeStyle {
  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'w-4 h-4',
  };

  if (type.startsWith('approval.')) {
    if (type === 'approval.approved') {
      return {
        label: 'Approved',
        badgeClass: 'bg-positive-soft text-positive-ink border-positive-ink/20',
        iconBgClass: 'bg-positive-soft',
        iconTextClass: 'text-positive-ink',
        icon: (
          <svg viewBox="0 0 24 24" {...strokeProps}>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ),
      };
    }
    if (type === 'approval.rejected') {
      return {
        label: 'Rejected',
        badgeClass: 'bg-negative-soft text-negative-ink border-negative-ink/20',
        iconBgClass: 'bg-negative-soft',
        iconTextClass: 'text-negative-ink',
        icon: (
          <svg viewBox="0 0 24 24" {...strokeProps}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ),
      };
    }
    return {
      label: 'Approval',
      badgeClass: 'bg-primary-soft text-primary-deep border-primary-ink/20',
      iconBgClass: 'bg-primary-soft',
      iconTextClass: 'text-primary-deep',
      icon: (
        <svg viewBox="0 0 24 24" {...strokeProps}>
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    };
  }

  if (type.startsWith('task.')) {
    return {
      label: 'Task',
      badgeClass: 'bg-tile-blue text-primary-deep border-border',
      iconBgClass: 'bg-tile-blue',
      iconTextClass: 'text-primary-deep',
      icon: (
        <svg viewBox="0 0 24 24" {...strokeProps}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
        </svg>
      ),
    };
  }

  if (type.startsWith('leave.')) {
    return {
      label: 'Leave',
      badgeClass: 'bg-tile-green text-primary-deep border-border',
      iconBgClass: 'bg-tile-green',
      iconTextClass: 'text-primary-deep',
      icon: (
        <svg viewBox="0 0 24 24" {...strokeProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    };
  }

  if (type.startsWith('meeting.')) {
    return {
      label: 'Meeting',
      badgeClass: 'bg-tile-peach text-text border-border',
      iconBgClass: 'bg-tile-peach',
      iconTextClass: 'text-text',
      icon: (
        <svg viewBox="0 0 24 24" {...strokeProps}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    };
  }

  if (type === 'announcement') {
    return {
      label: 'Announcement',
      badgeClass: 'bg-tile-yellow text-text border-border',
      iconBgClass: 'bg-tile-yellow',
      iconTextClass: 'text-text',
      icon: (
        <svg viewBox="0 0 24 24" {...strokeProps}>
          <path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 8a3 3 0 0 0-3-3H7.5A4.5 4.5 0 0 0 3 9.5v0a4.5 4.5 0 0 0 4.5 4.5H15a3 3 0 0 0 3-3V8z" />
        </svg>
      ),
    };
  }

  // Default / System notification
  return {
    label: 'Notice',
    badgeClass: 'bg-surface-muted text-text-muted border-border',
    iconBgClass: 'bg-surface-muted',
    iconTextClass: 'text-text-muted',
    icon: (
      <svg viewBox="0 0 24 24" {...strokeProps}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  };
}
