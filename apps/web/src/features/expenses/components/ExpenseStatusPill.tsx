import React from 'react';
import type { ExpenseStatus } from '../types';

interface ExpenseStatusPillProps {
  status: ExpenseStatus;
  size?: 'sm' | 'md';
  className?: string;
}

interface StatusConfig {
  label: string;
  container: string;
  dot: string;
}

const STATUS_CONFIG: Record<ExpenseStatus, StatusConfig> = {
  submitted: {
    label: 'Submitted',
    container: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-600',
  },
  approved: {
    label: 'Approved',
    container: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600',
  },
  rejected: {
    label: 'Rejected',
    container: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600',
  },
  reimbursed: {
    label: 'Reimbursed',
    container: 'bg-teal-50 text-teal-800 border-teal-200',
    dot: 'bg-teal-600',
  },
  cancelled: {
    label: 'Cancelled',
    container: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
  },
};

export const ExpenseStatusPill: React.FC<ExpenseStatusPillProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    container: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
  };

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1.5' : 'px-2.5 py-1 text-xs font-medium gap-2';

  return (
    <span
      className={`inline-flex items-center rounded-full border ${config.container} ${sizeClasses} ${className}`}
      data-testid={`expense-status-pill-${status}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};
