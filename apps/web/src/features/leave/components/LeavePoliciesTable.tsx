import React from 'react';
import type { LeavePolicy } from '../types';
import { DataTable, type Column, Badge, Button, EmptyState } from '../../../components/ui';
import { LeavePolicyCard } from './LeavePolicyCard';

export interface LeavePoliciesTableProps {
  policies: LeavePolicy[];
  isLoading?: boolean;
  onEdit?: (policy: LeavePolicy) => void;
  canManage?: boolean;
}

export const LeavePoliciesTable: React.FC<LeavePoliciesTableProps> = ({
  policies,
  isLoading = false,
  onEdit,
  canManage = false,
}) => {
  if (policies.length === 0 && !isLoading) {
    return (
      <EmptyState
        title="No Leave Policies Defined"
        description="Configure company leave types such as Paid Time Off, Sick Leave, and Casual Leave to initialize employee balances."
      />
    );
  }

  const columns: Column<LeavePolicy>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (policy) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
          {policy.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Policy Name',
      render: (policy) => <span className="font-semibold text-text">{policy.name}</span>,
    },
    {
      key: 'quota',
      header: 'Balance Tracking',
      render: (policy) =>
        policy.hasBalance ? (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep border border-primary/20">
            Quota Managed
          </span>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border">
            Uncredited
          </span>
        ),
    },
    {
      key: 'annualDays',
      header: 'Annual Allotment',
      render: (policy) => (
        <span className="text-sm font-medium text-text">
          {policy.hasBalance ? `${policy.annualDays} days` : '—'}
        </span>
      ),
    },
    {
      key: 'carryForward',
      header: 'Carry Forward Max',
      render: (policy) => (
        <span className="text-sm font-medium text-text">
          {policy.hasBalance ? `${policy.carryForwardMax} days` : '—'}
        </span>
      ),
    },
    {
      key: 'halfDay',
      header: 'Half Day',
      render: (policy) => (
        <span className="text-xs text-text-muted">{policy.allowHalfDay ? 'Allowed' : 'No'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (policy) => (
        <Badge variant={policy.isActive ? 'success' : 'neutral'}>
          {policy.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (policy) =>
        canManage && onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(policy)}
            data-testid={`table-edit-policy-btn-${policy.id}`}
            aria-label={`Edit ${policy.name}`}
            className="min-h-[44px]"
          >
            Edit
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="w-full">
      {/* Desktop view (1024px+) */}
      <div className="hidden lg:block">
        <DataTable
          data={policies}
          columns={columns}
          keyExtractor={(policy) => policy.id}
          isLoading={isLoading}
          ariaLabel="Configured Leave Policies Table"
        />
      </div>

      {/* Mobile & Tablet view (<1024px) */}
      <div className="block lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {policies.map((policy) => (
          <LeavePolicyCard key={policy.id} policy={policy} onEdit={onEdit} canManage={canManage} />
        ))}
      </div>
    </div>
  );
};
