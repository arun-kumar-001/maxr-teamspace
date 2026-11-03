import { Button } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../../components/ui/StateCards';
import type { ReportColumn, ReportPreviewMeta, ReportRow } from '../types';

export interface ReportDataTableProps {
  columns: ReportColumn[];
  rows: ReportRow[];
  loading: boolean;
  meta: ReportPreviewMeta;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  error?: string | null;
  onRetry?: () => void;
}

function formatCell(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') {
    return <span className="text-text-subtle italic">—</span>;
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (key === 'percentComplete') {
    const pct = typeof value === 'number' ? Math.round(value) : Number(value);
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-2 bg-surface-muted rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-primary-deep rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-text">{pct}%</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return <span className="tabular-nums font-medium text-text">{value.toLocaleString()}</span>;
  }

  return <span className="text-text">{String(value)}</span>;
}

export function ReportDataTable({
  columns,
  rows,
  loading,
  meta,
  page,
  pageSize,
  onPageChange,
  error,
  onRetry,
}: ReportDataTableProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        title="No data matches these report criteria"
        description="Try broadening your date range or adjusting the filters above to view report records."
      />
    );
  }

  const startRecord = (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, meta.total);

  return (
    <div
      className="bg-surface border border-border rounded-card shadow-card overflow-hidden"
      data-testid="report-data-table-container"
    >
      {/* Table horizontal scrolling container */}
      <div className="overflow-x-auto min-w-full">
        <table
          className="w-full text-left text-xs divide-y divide-border"
          data-testid="report-table"
        >
          <thead className="bg-surface-muted select-none">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 font-semibold text-text uppercase tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {loading
              ? Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={`skel-row-${rIdx}`} data-testid="report-loading-skeleton">
                    {columns.map((_, cIdx) => (
                      <td key={`skel-cell-${cIdx}`} className="px-4 py-3">
                        <Skeleton variant="text" width="80%" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row, rIdx) => (
                  <tr
                    key={`row-${rIdx}`}
                    className="hover:bg-surface-muted/50 transition-colors"
                    data-testid={`report-row-${rIdx}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-3 whitespace-nowrap text-text"
                        data-testid={`cell-${col.key}`}
                      >
                        {formatCell(col.key, row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && meta.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-surface border-t border-border text-xs text-text-muted">
          <div>
            Showing <span className="font-semibold text-text">{startRecord}</span> to{' '}
            <span className="font-semibold text-text">{endRecord}</span> of{' '}
            <span className="font-semibold text-text">{meta.total}</span> records
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="min-h-[36px] text-xs"
              data-testid="prev-page-btn"
            >
              &larr; Previous
            </Button>
            <span className="px-2 font-medium text-text">
              Page {page} of {meta.totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= meta.totalPages}
              className="min-h-[36px] text-xs"
              data-testid="next-page-btn"
            >
              Next &rarr;
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
