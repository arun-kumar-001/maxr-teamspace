import React from 'react';
import type { CorrectionStatus } from '../types';
import { StatusPill, type LeaveStatus } from '../../../components/ui/StatusPill';

const STATUS_MAP: Record<CorrectionStatus, LeaveStatus> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface CorrectionStatusBadgeProps {
  status: CorrectionStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const CorrectionStatusBadge: React.FC<CorrectionStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const mappedStatus = STATUS_MAP[status] ?? 'Pending';
  return <StatusPill status={mappedStatus} size={size} className={className} />;
};
