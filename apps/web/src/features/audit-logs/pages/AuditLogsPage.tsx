import { useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { StatCard } from '../../../components/ui/StatCard';
import { ErrorState, ForbiddenState, EmptyState } from '../../../components/ui/StateCards';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { useCompanyTimezone, formatInTimezone } from '../hooks/useCompanyTimezone';
import { AuditLogFilters } from '../components/AuditLogFilters';
import { AuditLogCard } from '../components/AuditLogCard';
import { AuditLogDetailModal } from '../components/AuditLogDetailModal';
import { AuditOutcomeBadge } from '../components/AuditOutcomeBadge';
import type { AuditLogItem } from '../types';

export function AuditLogsPage() {
  const { role, isLoading: authLoading } = useAuth();
  const { timezone } = useCompanyTimezone();
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { items, meta, isLoading, error, query, setPage, updateFilters, resetFilters, refetch } =
    useAuditLogs();

  // Role Gate: Only Admin is authorized
  if (!authLoading && role !== ROLES.ADMIN) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <ForbiddenState
          title="Access Denied"
          message="You do not have permission to view the audit trail. Only Administrators can inspect system audit logs."
        />
      </div>
    );
  }

  const handleOpenDetails = (log: AuditLogItem) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  // Metrics for overview
  const totalCount = meta.total;
  const successCount = items.filter((i) => i.outcome === 'success').length;
  const deniedCount = items.filter((i) => i.outcome === 'denied').length;
  const failureCount = items.filter((i) => i.outcome === 'failure').length;

  const columns: Column<AuditLogItem>[] = [
    {
      key: 'occurredAt',
      header: `Timestamp (${timezone})`,
      priority: 'high',
      render: (row) => (
        <span className="text-xs text-text-muted font-mono whitespace-nowrap">
          {formatInTimezone(row.occurredAt, timezone, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      priority: 'high',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-primary-ink">{row.action}</span>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      priority: 'high',
      render: (row) => <AuditOutcomeBadge outcome={row.outcome} />,
    },
    {
      key: 'actor',
      header: 'Actor',
      priority: 'medium',
      render: (row) => (
        <div className="text-xs truncate max-w-[140px]">
          <span className="font-medium text-text block truncate">
            {row.actor?.name || 'System'}
          </span>
          {row.actor?.role && (
            <span className="text-text-subtle text-[11px] block">{row.actor.role}</span>
          )}
        </div>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity',
      priority: 'medium',
      render: (row) => (
        <div className="text-xs truncate max-w-[130px]">
          <span className="font-mono text-text block truncate">{row.entityType}</span>
          {row.entityId && (
            <span className="font-mono text-text-subtle text-[11px] truncate block">
              {row.entityId}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Details',
      priority: 'high',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          className="text-xs min-h-[36px]"
          onClick={() => handleOpenDetails(row)}
          data-testid={`row-details-${row.id}`}
        >
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-text">Audit Logs</h1>
          <p className="text-sm text-text-muted mt-1">
            Immutable append-only record of security events, administrative changes, and user
            activity.
          </p>
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-border text-text-muted shadow-card">
            <span
              className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
              aria-hidden="true"
            />
            Audit Trail Active
          </span>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Logged"
          value={totalCount}
          isLoading={isLoading}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
        <StatCard
          label="Page Success"
          value={successCount}
          isLoading={isLoading}
          icon={
            <svg
              className="w-4 h-4 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          }
        />
        <StatCard
          label="Page Denied"
          value={deniedCount}
          isLoading={isLoading}
          icon={
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          }
        />
        <StatCard
          label="Page Failure"
          value={failureCount}
          isLoading={isLoading}
          icon={
            <svg
              className="w-4 h-4 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          }
        />
      </div>

      {/* Filter Toolbar */}
      <AuditLogFilters
        query={query}
        onUpdateFilters={updateFilters}
        onResetFilters={resetFilters}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      {error ? (
        <ErrorState title="Failed to Load Audit Logs" message={error} onRetry={refetch} />
      ) : !isLoading && items.length === 0 ? (
        <EmptyState
          title="No Audit Records Found"
          description="There are no audit log events matching the selected criteria or time range."
          actionLabel="Clear Filters"
          onAction={resetFilters}
        />
      ) : (
        <>
          {/* Desktop & Tablet Table (sm and up) */}
          <div className="hidden sm:block">
            <DataTable<AuditLogItem>
              data={items}
              columns={columns}
              keyExtractor={(row) => row.id}
              isLoading={isLoading}
              page={meta.page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={setPage}
              ariaLabel="Audit logs table"
            />
          </div>

          {/* Mobile Card List (< sm / 640px) */}
          <div className="sm:hidden space-y-3">
            {items.map((log) => (
              <AuditLogCard
                key={log.id}
                log={log}
                timezone={timezone}
                onViewDetails={handleOpenDetails}
              />
            ))}

            {/* Mobile Pagination */}
            {meta.total > meta.pageSize && (
              <div className="flex items-center justify-between p-4 bg-surface border border-border rounded-card shadow-card mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1 || isLoading}
                  onClick={() => setPage(meta.page - 1)}
                  className="min-h-[44px]"
                >
                  Previous
                </Button>
                <span className="text-xs text-text-muted">
                  Page {meta.page} of {Math.max(1, Math.ceil(meta.total / meta.pageSize))}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page * meta.pageSize >= meta.total || isLoading}
                  onClick={() => setPage(meta.page + 1)}
                  className="min-h-[44px]"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Modal */}
      <AuditLogDetailModal
        log={selectedLog}
        isOpen={isModalOpen}
        onClose={handleCloseDetails}
        timezone={timezone}
      />
    </div>
  );
}
