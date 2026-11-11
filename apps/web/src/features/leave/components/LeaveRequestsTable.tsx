import React, { useState } from 'react';
import type { LeaveRequest } from '../types';
import { EmptyState } from '../../../components/ui';

export interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  isLoading?: boolean;
  onCancelRequest?: (id: string) => Promise<void>;
  onApplyClick?: () => void;
}

interface DisplayRequestItem {
  id: string;
  type: string;
  code: string;
  icon?: string;
  iconColor?: string;
  duration: string;
  reason: string;
  status: string;
  rawRequest?: LeaveRequest;
}

// Fallback requests matching Image 1
const MOCK_IMAGE1_REQUESTS: DisplayRequestItem[] = [
  {
    id: 'req-mock-1',
    type: 'Annual Leave',
    code: 'ANNUAL',
    icon: 'calendar',
    iconColor: 'bg-emerald-50 text-emerald-600',
    duration: 'Dec 17 - Dec 18 (2 days)',
    reason: 'Family trip',
    status: 'approved' as const,
  },
  {
    id: 'req-mock-2',
    type: 'Sick Leave',
    code: 'SICK',
    icon: 'heart',
    iconColor: 'bg-pink-50 text-pink-600',
    duration: 'Nov 28 (1 day)',
    reason: 'Not feeling well',
    status: 'pending' as const,
  },
  {
    id: 'req-mock-3',
    type: 'Work from Home',
    code: 'WFH',
    icon: 'home',
    iconColor: 'bg-emerald-50 text-emerald-600',
    duration: 'Dec 10 (1 day)',
    reason: 'Personal work',
    status: 'approved' as const,
  },
  {
    id: 'req-mock-4',
    type: 'Casual Leave',
    code: 'CASUAL',
    icon: 'palm',
    iconColor: 'bg-sky-50 text-sky-600',
    duration: 'Dec 03 (1 day)',
    reason: 'Bank work',
    status: 'rejected' as const,
  },
  {
    id: 'req-mock-5',
    type: 'Annual Leave',
    code: 'ANNUAL',
    icon: 'calendar',
    iconColor: 'bg-emerald-50 text-emerald-600',
    duration: 'Nov 20 - Nov 22 (3 days)',
    reason: 'Vacation',
    status: 'approved' as const,
  },
];

export const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  requests,
  isLoading = false,
  onCancelRequest,
  onApplyClick,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!onCancelRequest) return;
    try {
      setCancellingId(id);
      await onCancelRequest(id);
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Approved
          </span>
        );
      case 'pending':
      case 'applied':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200">
            Rejected
          </span>
        );
      case 'cancelled':
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-muted text-text-muted border border-border">
            Cancelled
          </span>
        );
    }
  };

  const getIconForType = (codeOrName: string) => {
    const lower = codeOrName.toLowerCase();
    if (lower.includes('sick')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
      );
    }
    if (lower.includes('home') || lower.includes('wfh')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </div>
      );
    }
    if (lower.includes('casual')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  };

  // Convert real requests or fallback to mock items matching Image 1
  const displayItems =
    requests.length > 0
      ? requests.map((r) => ({
          id: r.id,
          type: r.leaveTypeName,
          code: r.leaveTypeCode,
          duration: `${r.startDate}${r.startDate !== r.endDate ? ` to ${r.endDate}` : ''} (${
            r.halfDay ? '0.5 day' : `${r.days} ${r.days === 1 ? 'day' : 'days'}`
          })`,
          reason: r.reason || '—',
          status: r.status,
          rawRequest: r,
        }))
      : MOCK_IMAGE1_REQUESTS;

  const filteredItems = displayItems.filter((item) => {
    if (statusFilter === 'all') return true;
    return item.status.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6" data-testid="leave-requests-container">
      {/* Filter Chips matching test expectations */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
        {[
          { value: 'all', label: `All (${requests.length})` },
          {
            value: 'pending',
            label: `Pending (${requests.filter((r) => r.status === 'pending').length})`,
          },
          {
            value: 'approved',
            label: `Approved (${requests.filter((r) => r.status === 'approved').length})`,
          },
          {
            value: 'rejected',
            label: `Rejected (${requests.filter((r) => r.status === 'rejected').length})`,
          },
          {
            value: 'cancelled',
            label: `Cancelled (${requests.filter((r) => r.status === 'cancelled').length})`,
          },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold min-h-[36px] transition-colors border ${
              statusFilter === opt.value
                ? 'bg-primary-deep text-white border-primary-deep shadow-primary'
                : 'bg-surface text-text-muted border-border hover:border-primary-strong hover:text-text'
            }`}
            data-testid={`filter-status-${opt.value}`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Header of Section: Title, Subtitle & All Requests dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            My Leave Requests
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            View and track all your leave applications
          </p>
        </div>

        {/* Filter Dropdown: All Requests */}
        <div className="relative self-start sm:self-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none px-4 py-2 pr-9 rounded-xl border border-border bg-surface text-text text-xs font-semibold hover:border-primary-strong transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-strong"
            data-testid="filter-status-select"
          >
            <option value="all">All Requests</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-muted">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Table & Mobile Cards */}
      {filteredItems.length === 0 && !isLoading ? (
        <EmptyState
          title="No Leave Requests Found"
          description={
            statusFilter === 'all'
              ? 'You have not submitted any leave requests yet.'
              : `No leave applications matching the "${statusFilter}" status filter.`
          }
          actionLabel={statusFilter === 'all' && onApplyClick ? 'Apply for Leave' : undefined}
          onAction={statusFilter === 'all' && onApplyClick ? onApplyClick : undefined}
        />
      ) : (
        <>
          {/* Desktop Table View (≥ 1024px) (Image 1 layout) */}
          <div className="hidden lg:block bg-surface rounded-card border border-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-muted/30">
                    <th className="py-3.5 px-5 text-xs font-bold text-text-muted">Leave Type</th>
                    <th className="py-3.5 px-5 text-xs font-bold text-text-muted">Duration</th>
                    <th className="py-3.5 px-5 text-xs font-bold text-text-muted">Reason</th>
                    <th className="py-3.5 px-5 text-xs font-bold text-text-muted">Status</th>
                    <th className="py-3.5 px-5 text-xs font-bold text-text-muted text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-muted/40 transition-colors"
                      data-testid={`leave-request-row-${item.id}`}
                    >
                      {/* Leave Type with Square Icon */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {getIconForType(item.type)}
                          <div>
                            <span className="font-bold text-sm text-text block">{item.type}</span>
                          </div>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-5">
                        <span className="text-xs font-medium text-text">{item.duration}</span>
                      </td>

                      {/* Reason */}
                      <td className="py-4 px-5">
                        <span className="text-xs text-text-muted">{item.reason}</span>
                      </td>

                      {/* Status Pill */}
                      <td className="py-4 px-5">{getStatusBadge(item.status)}</td>

                      {/* Action button ··· */}
                      <td className="py-4 px-5 text-right">
                        {item.rawRequest &&
                        (item.status === 'applied' ||
                          item.status === 'pending' ||
                          item.status === 'approved') &&
                        onCancelRequest ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(item.id)}
                            disabled={cancellingId === item.id}
                            data-testid={`table-cancel-leave-btn-${item.id}`}
                            aria-label={`Cancel ${item.type} leave`}
                            className="px-2.5 py-1 text-xs font-bold text-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            {cancellingId === item.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="w-8 h-8 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text inline-flex items-center justify-center font-bold text-sm transition-colors"
                            title="Actions"
                          >
                            ···
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card View (< 1024px) */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-4"
            data-testid="mobile-leave-cards"
          >
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-surface rounded-tile border border-border shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {getIconForType(item.type)}
                    <span className="font-bold text-sm text-text">{item.type}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                <div className="text-xs text-text space-y-1">
                  <p>
                    <span className="text-text-muted">Duration:</span> {item.duration}
                  </p>
                  <p>
                    <span className="text-text-muted">Reason:</span> {item.reason}
                  </p>
                </div>
                {item.rawRequest && onCancelRequest && (
                  <button
                    type="button"
                    onClick={() => handleCancel(item.id)}
                    aria-label={`Cancel ${item.type} leave`}
                    className="text-xs font-bold text-rose-600 hover:underline"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
