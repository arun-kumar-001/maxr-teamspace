import React, { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Column, DataTable } from '../../../components/ui/DataTable';
import { PageContainer } from '../../../components/ui/PageContainer';
import { StatCard } from '../../../components/ui/StatCard';
import { ErrorState } from '../../../components/ui/StateCards';
import { Tabs } from '../../../components/ui/Tabs';
import {
  listCategories,
  listClaims,
  listMyClaims,
} from '../api/expensesApi';
import { ExpenseClaimDetailDrawer } from '../components/ExpenseClaimDetailDrawer';
import { ExpenseClaimFormModal } from '../components/ExpenseClaimFormModal';
import { ExpenseStatusPill } from '../components/ExpenseStatusPill';
import type { ExpenseCategory, ExpenseClaim, ExpenseStatus } from '../types';
import { formatPaiseToInr } from '../types';

export const ExpensesPage: React.FC = () => {
  const { user, role } = useAuth();
  const isApproverOrAdmin =
    role === ROLES.ADMIN || role === ROLES.HR_MANAGER || role === ROLES.TEAM_LEAD;
  const isHrOrAdmin = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;

  // Active tab: 'mine' or 'team'
  const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);

  // Modals & Drawers
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);

  // Load categories once
  useEffect(() => {
    listCategories()
      .then((cats) => setCategories(cats))
      .catch((err) => {
        // Non-blocking fallback
        console.warn('Failed to load categories', err);
      });
  }, []);

  // Fetch claims
  const fetchClaims = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        status: statusFilter === 'all' ? undefined : (statusFilter as ExpenseStatus),
      };

      const res =
        activeTab === 'mine'
          ? await listMyClaims(params)
          : await listClaims(params);

      setClaims(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expense claims');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, pageSize, statusFilter]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleClaimCreated = (newClaim: ExpenseClaim) => {
    setClaims((prev) => [newClaim, ...prev]);
    setTotal((t) => t + 1);
  };

  const handleClaimUpdated = (updated: ExpenseClaim) => {
    setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedClaim?.id === updated.id) {
      setSelectedClaim(updated);
    }
  };

  // Metrics calculation
  const totalAmount = claims.reduce((acc, c) => acc + c.amountPaise, 0);
  const pendingCount = claims.filter((c) => c.status === 'submitted').length;
  const reimbursedCount = claims.filter((c) => c.status === 'reimbursed').length;

  const columns: Column<ExpenseClaim & Record<string, unknown>>[] = [
    {
      key: 'expenseDate',
      header: 'Date',
      priority: 'high',
      render: (row) => (
        <span className="font-mono text-xs text-text">{row.expenseDate}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      priority: 'high',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text truncate max-w-xs sm:max-w-md">
            {row.description}
          </span>
          <span className="text-xs text-text-muted flex items-center gap-1.5 mt-0.5">
            {activeTab === 'team' && row.employeeName && (
              <span className="font-medium text-primary-deep">{row.employeeName} • </span>
            )}
            <span>{row.categoryName || 'General'}</span>
            {row.receiptStorageKey && (
              <span className="inline-flex items-center text-primary-strong" title="Has receipt">
                📎
              </span>
            )}
          </span>
        </div>
      ),
    },
    {
      key: 'amountPaise',
      header: 'Amount',
      priority: 'high',
      render: (row) => (
        <span className="font-semibold text-sm text-text font-display">
          {formatPaiseToInr(row.amountPaise)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'high',
      render: (row) => <ExpenseStatusPill status={row.status} size="sm" />,
    },
    {
      key: 'actions',
      header: '',
      priority: 'high',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedClaim(row)}
          aria-label={`View claim for ${row.description}`}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-text tracking-tight">
              Expenses & Claims
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Submit business expense claims with receipts and track approval progress.
            </p>
          </div>
          <div>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsSubmitModalOpen(true)}
              data-testid="submit-claim-button"
            >
              + Submit Claim
            </Button>
          </div>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Claims Count" value={String(total)} />
          <StatCard label="Total Amount" value={formatPaiseToInr(totalAmount)} />
          <StatCard label="Awaiting Approval" value={String(pendingCount)} />
          <StatCard label="Reimbursed" value={String(reimbursedCount)} />
        </div>

        {/* Controls: Scope Tabs & Status Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {isApproverOrAdmin ? (
            <Tabs
              tabs={[
                { id: 'mine', label: 'My Claims' },
                {
                  id: 'team',
                  label: role === ROLES.TEAM_LEAD ? 'Team Claims' : 'All Claims',
                },
              ]}
              activeTab={activeTab}
              onChange={(tabId) => {
                setActiveTab(tabId as 'mine' | 'team');
                setPage(1);
              }}
            />
          ) : (
            <div className="text-sm font-medium text-text-muted">My Claims</div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-text-subtle mr-1">Status:</span>
            {['all', 'submitted', 'approved', 'reimbursed', 'rejected', 'cancelled'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-primary-deep text-white shadow-sm'
                    : 'bg-surface text-text-muted hover:bg-surface-raised border border-border'
                }`}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content / Error / Table */}
        {error ? (
          <ErrorState
            title="Unable to load claims"
            message={error}
            onRetry={fetchClaims}
          />
        ) : (
          <div className="bg-surface border border-border rounded-card shadow-card overflow-hidden">
            <DataTable
              data={claims as (ExpenseClaim & Record<string, unknown>)[]}
              columns={columns}
              keyExtractor={(c) => c.id}
              isLoading={isLoading}
              emptyTitle="No expense claims found"
              emptyMessage={
                activeTab === 'mine'
                  ? "You haven't submitted any expense claims matching the filter criteria."
                  : 'No team or company claims found matching the filter criteria.'
              }
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              ariaLabel="Expense claims table"
            />
          </div>
        )}

        {/* Submit Claim Modal */}
        <ExpenseClaimFormModal
          isOpen={isSubmitModalOpen}
          onClose={() => setIsSubmitModalOpen(false)}
          categories={categories}
          onSuccess={handleClaimCreated}
        />

        {/* Claim Details Drawer */}
        <ExpenseClaimDetailDrawer
          claim={selectedClaim}
          isOpen={!!selectedClaim}
          onClose={() => setSelectedClaim(null)}
          currentUserEmployeeId={user?.employeeId}
          isHrOrAdmin={isHrOrAdmin}
          onClaimUpdated={handleClaimUpdated}
        />
      </div>
    </PageContainer>
  );
};
