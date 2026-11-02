import React from 'react';
import type { ApprovalStatus } from '../types';
import { StatusPill, type LeaveStatus } from '../../../components/ui/StatusPill';

const STATUS_TO_LEAVE_MAP: Record<ApprovalStatus, LeaveStatus> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const ApprovalStatusBadge: React.FC<ApprovalStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const leaveStatus = STATUS_TO_LEAVE_MAP[status] ?? 'Pending';
  return <StatusPill status={leaveStatus} size={size} className={className} />;
};
