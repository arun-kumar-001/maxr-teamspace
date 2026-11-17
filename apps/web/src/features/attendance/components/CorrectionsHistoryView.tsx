import React from 'react';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Button } from '../../../components/ui/Button';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import { Skeleton } from '../../../components/ui/Skeleton';
import { CorrectionStatusBadge } from './CorrectionStatusBadge';
import type { AttendanceCorrection, AttendancePaginationMeta } from '../types';

export interface CorrectionsHistoryViewProps {
  corrections: AttendanceCorrection[];
  meta: AttendancePaginationMeta;
  isLoading?: boolean;
  error?: string | null;
  onCancelCorrection: (id: string) => Promise<void>;
  onRetry?: () => void;
  page: number;
  onPageChange: (newPage: number) => void;
}

export const CorrectionsHistoryView: React.FC<CorrectionsHistoryViewProps> = ({
  corrections,
  meta,
  isLoading = false,
  error = null,
  onCancelCorrection,
  onRetry,
  page,
  onPageChange,
}) => {
  const formatTime = (isoTime: string | null) => {
    if (!isoTime) return '—';
    return new Date(isoTime).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  const columns: Column<AttendanceCorrection>[] = [
    {
      key: 'workDate',
      header: 'Work Date',
      render: (row) => <span className="font-medium text-text">{row.workDate}</span>,
    },
    {
      key: 'requestedTimes',
      header: 'Requested Session (UTC)',
      render: (row) => (
        <span className="text-xs text-text-muted">
          {formatTime(row.requestedCheckIn)} - {formatTime(row.requestedCheckOut)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <p className="text-xs text-text max-w-xs truncate" title={row.reason}>
          {row.reason}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <CorrectionStatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-text-muted">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        if (row.status !== 'pending') return <span className="text-xs text-text-subtle">—</span>;
        return (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCancelCorrection(row.id)}
            data-testid={`cancel-correction-button-${row.id}`}
            className="text-xs min-h-[44px]"
          >
            Cancel Request
          </Button>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div
        className="space-y-3 p-4 bg-surface rounded-card border border-border"
        data-testid="corrections-loading"
      >
        <Skeleton className="h-8 w-1/4 rounded-control" />
        <Skeleton className="h-12 w-full rounded-control" />
        <Skeleton className="h-12 w-full rounded-control" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load corrections" message={error} onRetry={onRetry} />;
  }

  if (corrections.length === 0) {
    return (
      <EmptyState
        title="No correction requests"
        description="You have not submitted any attendance correction requests."
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="corrections-history-view">
      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-card border border-border/80 overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={corrections}
          keyExtractor={(row) => row.id}
          ariaLabel="Attendance Corrections Table"
        />
      </div>

      {/* Mobile Card Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4"
        data-testid="corrections-mobile-cards"
      >
        {corrections.map((corr) => (
          <div
            key={corr.id}
            className="p-4 bg-white rounded-card border border-border/80 shadow-xs space-y-3"
            data-testid={`correction-card-${corr.id}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text text-sm">{corr.workDate}</span>
              <CorrectionStatusBadge status={corr.status} size="sm" />
            </div>

            <div className="space-y-1 text-xs text-text-muted">
              <div>
                <span className="text-text-subtle">Requested: </span>
                {formatTime(corr.requestedCheckIn)} - {formatTime(corr.requestedCheckOut)}
              </div>
              <div>
                <span className="text-text-subtle">Submitted: </span>
                {new Date(corr.createdAt).toLocaleDateString()}
              </div>
              <div className="mt-2 bg-surface-muted p-2 rounded-control text-text border border-border">
                <span className="text-text-subtle block mb-0.5">Reason:</span>
                {corr.reason}
              </div>
            </div>

            {corr.status === 'pending' && (
              <div className="pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full min-h-[44px]"
                  onClick={() => onCancelCorrection(corr.id)}
                  data-testid={`mobile-cancel-correction-${corr.id}`}
                >
                  Cancel Request
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {meta.total > meta.pageSize && (
        <div className="flex items-center justify-between p-4 bg-surface rounded-card border border-border text-sm">
          <span className="text-text-muted">
            Showing {(page - 1) * meta.pageSize + 1} to {Math.min(page * meta.pageSize, meta.total)}{' '}
            of {meta.total} requests
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="min-h-[44px]"
            >
              Previous
            </Button>
            <span className="px-2 text-text font-medium">Page {page}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page * meta.pageSize >= meta.total}
              onClick={() => onPageChange(page + 1)}
              className="min-h-[44px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
