import React from 'react';

export type LeaveStatus = 'Applied' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type TaskStatus = 'To Do' | 'In Progress' | 'In Review' | 'Completed' | 'Blocked';
export type WorkflowStatus = LeaveStatus | TaskStatus;

export interface StatusPillProps {
  status: WorkflowStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusStyleConfig {
  container: string;
  dot: string;
}

const STATUS_MAP: Record<WorkflowStatus, StatusStyleConfig> = {
  // Leave Workflow
  Applied: {
    container: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-600',
  },
  Pending: {
    container: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-600',
  },
  Approved: {
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  Rejected: {
    container: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
  },
  Cancelled: {
    container: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
  },

  // Task Workflow
  'To Do': {
    container: 'bg-slate-50 text-slate-700 border-slate-300',
    dot: 'bg-slate-500',
  },
  'In Progress': {
    container: 'bg-primary-soft text-primary-ink border-primary-soft-border',
    dot: 'bg-primary-strong',
  },
  'In Review': {
    container: 'bg-purple-50 text-purple-800 border-purple-200',
    dot: 'bg-purple-600',
  },
  Completed: {
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  Blocked: {
    container: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
  },
};

export function StatusPill({ status, size = 'md', className = '' }: StatusPillProps) {
  const config = STATUS_MAP[status] || STATUS_MAP['Pending'];
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.container} ${sizeClasses} ${className}`}
      role="status"
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`} aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

export type BadgeVariant =
  'primary' | 'secondary' | 'outline' | 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'primary', className = '' }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, string> = {
    // Soft pill as "Total 282 In-Pipeline" in MaxR Flow. White on the status colours fails AA, so they are soft too.
    primary: 'bg-primary-soft text-primary-ink',
    secondary: 'bg-primary-deep text-white',
    outline: 'border border-primary-soft-border text-primary-ink bg-surface',
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-800',
    warning: 'bg-amber-50 text-amber-800',
    danger: 'bg-rose-50 text-rose-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
