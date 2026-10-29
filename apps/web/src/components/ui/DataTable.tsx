import React from 'react';
import { Skeleton } from './Skeleton.js';
import { EmptyState } from './StateCards.js';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  priority?: 'high' | 'medium' | 'low'; // high = always shown; low = hidden on tablet
  sortable?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (newPage: number) => void;
  /** Accessible name of the table (required for screen readers). */
  ariaLabel: string;
  /** Sorting is controlled by the parent so the server can sort the whole result set. */
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (key: string, direction: SortDirection) => void;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyMessage = 'There are no items to display in this list.',
  page = 1,
  pageSize = 10,
  total,
  onPageChange,
  ariaLabel,
  sortKey,
  sortDirection = 'asc',
  onSortChange,
  className = '',
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-surface border border-border rounded-card p-4 space-y-3">
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={50} />
        <Skeleton variant="rectangular" height={50} />
        <Skeleton variant="rectangular" height={50} />
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  const totalPages = total ? Math.ceil(total / pageSize) : undefined;

  return (
    <div
      className={`w-full flex flex-col bg-surface border border-border rounded-card overflow-hidden ${className}`}
    >
      {/* Mobile Card Layout (Shown on phone: < 640px) */}
      <div className="block sm:hidden divide-y divide-border" data-testid="datatable-mobile-cards">
        {data.map((row) => (
          <div key={keyExtractor(row)} className="p-4 space-y-2">
            {columns.map((col) => (
              <div key={col.key} className="flex justify-between items-center text-xs">
                <span className="font-semibold text-text-muted">{col.header}:</span>
                <span className="text-text text-right">
                  {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Desktop & Tablet Table (Hidden on phone: >= 640px) */}
      <div className="hidden sm:block overflow-x-auto" data-testid="datatable-desktop-table">
        <table className="w-full text-left text-sm" aria-label={ariaLabel}>
          <thead className="bg-surface-muted border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
            <tr>
              {columns.map((col) => {
                const isSorted = col.sortable && sortKey === col.key;
                const nextDirection: SortDirection =
                  isSorted && sortDirection === 'asc' ? 'desc' : 'asc';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      col.sortable
                        ? isSorted
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    className={`px-4 py-3.5 ${col.priority === 'low' ? 'hidden lg:table-cell' : ''}`}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key, nextDirection)}
                        className="inline-flex items-center gap-1 min-h-[44px] uppercase tracking-wider font-semibold"
                      >
                        {col.header}
                        <span aria-hidden="true">
                          {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text">
            {data.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-slate-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 ${
                      col.priority === 'low' ? 'hidden lg:table-cell' : ''
                    }`}
                  >
                    {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 bg-surface-muted border-t border-border text-xs text-text-muted">
          <div>
            Page <span className="font-semibold text-text">{page}</span> of{' '}
            <span className="font-semibold text-text">{totalPages}</span>
            {total && <span> ({total} total)</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 min-h-[44px] sm:min-h-[36px] bg-surface border border-border rounded-input text-text disabled:opacity-50 disabled:pointer-events-none hover:bg-surface-muted"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 min-h-[44px] sm:min-h-[36px] bg-surface border border-border rounded-input text-text disabled:opacity-50 disabled:pointer-events-none hover:bg-surface-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
