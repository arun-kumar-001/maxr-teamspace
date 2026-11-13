import React, { useMemo, useState } from 'react';
import type { LeaveBalance, LeaveRequest } from '../types';
import { EmptyState } from '../../../components/ui';

export interface LeaveRequestsTableProps {
  requests: LeaveRequest[];
  balances?: LeaveBalance[];
  isLoading?: boolean;
  onCancelRequest?: (id: string) => Promise<void>;
  onApplyClick?: () => void;
}

interface DisplayLeaveItem {
  id: string;
  requestCode: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  days: number;
  halfDay: boolean;
  appliedDate: string;
  reason: string;
  status: string;
  rawRequest?: LeaveRequest;
}

const DEV_SAMPLE_REQUESTS: DisplayLeaveItem[] = [
  {
    id: 'LR-0268',
    requestCode: 'LR-0268',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-11-20',
    endDate: '2026-11-24',
    days: 3,
    halfDay: false,
    appliedDate: '2026-11-12',
    reason: 'Family function',
    status: 'approved',
  },
  {
    id: 'LR-0267',
    requestCode: 'LR-0267',
    leaveTypeName: 'Casual Leave',
    leaveTypeCode: 'CASUAL',
    startDate: '2026-11-14',
    endDate: '2026-11-14',
    days: 1,
    halfDay: false,
    appliedDate: '2026-11-10',
    reason: 'Personal work',
    status: 'pending',
  },
  {
    id: 'LR-0266',
    requestCode: 'LR-0266',
    leaveTypeName: 'Sick Leave',
    leaveTypeCode: 'SICK',
    startDate: '2026-11-05',
    endDate: '2026-11-06',
    days: 2,
    halfDay: false,
    appliedDate: '2026-11-04',
    reason: 'Not feeling well',
    status: 'approved',
  },
  {
    id: 'LR-0265',
    requestCode: 'LR-0265',
    leaveTypeName: 'Work From Home',
    leaveTypeCode: 'WFH',
    startDate: '2026-10-30',
    endDate: '2026-10-30',
    days: 1,
    halfDay: false,
    appliedDate: '2026-10-29',
    reason: 'Doctor appointment',
    status: 'rejected',
  },
  {
    id: 'LR-0264',
    requestCode: 'LR-0264',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'ANNUAL',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
    days: 2,
    halfDay: false,
    appliedDate: '2026-10-10',
    reason: 'Out of station',
    status: 'approved',
  },
];

const PAGE_SIZE = 5;

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '—';
  const datePart = isoDate.split('T')[0] ?? isoDate;
  const parsed = new Date(`${datePart}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getMonthKey(isoDate: string): string {
  const datePart = isoDate.split('T')[0] ?? '';
  return datePart.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  if (!year || monthIdx < 0 || monthIdx > 11) return monthKey;
  return new Date(year, monthIdx, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatRequestCode(id: string): string {
  if (id.toUpperCase().startsWith('LR-')) return id.toUpperCase();
  const trailingDigits = id.match(/(\d+)$/);
  if (trailingDigits && trailingDigits[1]) {
    return `LR-${trailingDigits[1].padStart(4, '0')}`;
  }
  const clean = id
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-4)
    .toUpperCase();
  return `LR-${clean || '0001'}`;
}

function getLeaveTypePillStyle(codeOrName: string): { bg: string; color: string } {
  const lower = codeOrName.toLowerCase();
  if (lower.includes('casual')) {
    return { bg: 'rgb(254, 240, 219)', color: 'rgb(180, 83, 9)' };
  }
  if (lower.includes('sick')) {
    return { bg: 'rgb(240, 232, 255)', color: 'rgb(109, 40, 217)' };
  }
  if (lower.includes('home') || lower.includes('wfh')) {
    return { bg: 'rgb(224, 242, 254)', color: 'rgb(3, 105, 161)' };
  }
  return { bg: 'rgb(214, 248, 238)', color: 'rgb(15, 118, 110)' };
}

export const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  requests,
  balances: _balances = [],
  isLoading = false,
  onCancelRequest,
  onApplyClick,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<DisplayLeaveItem | null>(null);

  const isDevMockMode = import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH !== 'false';
  const usingDevFallback = requests.length === 0 && isDevMockMode;

  const displayItems: DisplayLeaveItem[] = useMemo(() => {
    if (requests.length > 0) {
      return requests.map((r) => ({
        id: r.id,
        requestCode: formatRequestCode(r.id),
        leaveTypeName: r.leaveTypeName,
        leaveTypeCode: r.leaveTypeCode,
        startDate: r.startDate,
        endDate: r.endDate,
        days: r.days,
        halfDay: r.halfDay,
        appliedDate: r.createdAt || r.startDate,
        reason: r.reason || '—',
        status: r.status,
        rawRequest: r,
      }));
    }
    return isDevMockMode ? DEV_SAMPLE_REQUESTS : [];
  }, [requests, isDevMockMode]);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const item of displayItems) {
      const key = getMonthKey(item.startDate);
      if (key.length === 7) keys.add(key);
    }
    return Array.from(keys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({ value: key, label: formatMonthLabel(key) }));
  }, [displayItems]);

  const statusCounts = useMemo(() => {
    const source = usingDevFallback ? displayItems : requests;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let cancelled = 0;
    for (const item of source) {
      const s = item.status.toLowerCase();
      if (s === 'pending' || s === 'applied') pending += 1;
      else if (s === 'approved') approved += 1;
      else if (s === 'rejected') rejected += 1;
      else if (s === 'cancelled') cancelled += 1;
    }
    return {
      all: source.length,
      pending,
      approved,
      rejected,
      cancelled,
    };
  }, [usingDevFallback, displayItems, requests]);

  const summaryCards = useMemo(() => {
    const totalCount = statusCounts.all;
    const pendingCount = statusCounts.pending;
    const approvedCount = statusCounts.approved;
    const rejectedCount = statusCounts.rejected;

    return [
      {
        key: 'all',
        filterValue: 'all' as const,
        label: 'Total Requests',
        value: String(totalCount),
        badge: 'All submissions',
        borderColor: 'border-teal-300',
        iconColor: 'text-teal-600',
        pillBg: 'bg-teal-50',
        pillText: 'text-teal-800',
        icon: (
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        ),
      },
      {
        key: 'pending',
        filterValue: 'pending' as const,
        label: 'Pending Requests',
        value: String(pendingCount),
        badge: 'Awaiting review',
        borderColor: 'border-amber-300',
        iconColor: 'text-amber-600',
        pillBg: 'bg-amber-50',
        pillText: 'text-amber-800',
        icon: (
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        key: 'approved',
        filterValue: 'approved' as const,
        label: 'Approved Requests',
        value: String(approvedCount),
        badge: 'Approved',
        borderColor: 'border-emerald-300',
        iconColor: 'text-emerald-600',
        pillBg: 'bg-emerald-50',
        pillText: 'text-emerald-800',
        icon: (
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      },
      {
        key: 'rejected',
        filterValue: 'rejected' as const,
        label: 'Rejected Requests',
        value: String(rejectedCount),
        badge: 'Declined',
        borderColor: 'border-rose-300',
        iconColor: 'text-rose-600',
        pillBg: 'bg-rose-50',
        pillText: 'text-rose-800',
        icon: (
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      },
    ];
  }, [statusCounts]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return displayItems.filter((item) => {
      const normalizedStatus = item.status.toLowerCase();
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (normalizedStatus !== 'pending' && normalizedStatus !== 'applied') return false;
        } else if (normalizedStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      if (monthFilter !== 'all' && getMonthKey(item.startDate) !== monthFilter) {
        return false;
      }
      if (query) {
        const hay = `${item.requestCode} ${item.reason} ${item.leaveTypeName}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [displayItems, statusFilter, monthFilter, searchQuery]);

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);

  const handleCancel = async (id: string) => {
    if (!onCancelRequest) return;
    try {
      setCancellingId(id);
      await onCancelRequest(id);
      setSelectedRequest(null);
    } finally {
      setCancellingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === 'approved') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(21, 128, 61)' }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm4.3 7.7l-5 5a1 1 0 01-1.4 0l-2-2a1 1 0 111.4-1.4l1.3 1.3 4.3-4.3a1 1 0 011.4 1.4z" />
          </svg>
          Approved
        </span>
      );
    }
    if (lower === 'pending' || lower === 'applied') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: 'rgb(254, 240, 219)', color: 'rgb(180, 83, 9)' }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          Pending
        </span>
      );
    }
    if (lower === 'rejected') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: 'rgb(254, 226, 226)', color: 'rgb(220, 38, 38)' }}
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm3.7 12.3a1 1 0 11-1.4 1.4L12 13.4l-2.3 2.3a1 1 0 01-1.4-1.4l2.3-2.3-2.3-2.3a1 1 0 011.4-1.4l2.3 2.3 2.3-2.3a1 1 0 011.4 1.4L13.4 12z" />
          </svg>
          Rejected
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ backgroundColor: 'rgb(243, 244, 246)', color: 'rgb(75, 85, 99)' }}
      >
        Cancelled
      </span>
    );
  };

  const formatDaysLabel = (days: number, halfDay: boolean) => {
    if (halfDay || days === 0.5) return '0.5 Day';
    return `${days} ${days === 1 ? 'Day' : 'Days'}`;
  };

  const isEligiblePending = (status: string) => {
    const s = status.toLowerCase();
    return s === 'pending' || s === 'applied';
  };

  return (
    <div className="space-y-5" data-testid="leave-requests-container">
      {/* 1. Request Summary KPI Cards matching Admin Dashboard style */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4"
        data-testid="leave-summary-cards"
      >
        {summaryCards.map((card) => (
          <div
            key={card.key}
            onClick={() => setStatusFilter(card.filterValue)}
            className={`p-4 sm:p-4.5 bg-white border ${card.borderColor} rounded-card shadow-card flex items-center justify-between gap-3 min-w-0 cursor-pointer hover:shadow-md transition-all ${
              statusFilter === card.filterValue ? 'ring-2 ring-primary-strong/40' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`${card.iconColor} flex items-center justify-center shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                  {card.label}
                </span>
                <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
                  {card.value}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span
                className={`text-[11px] sm:text-xs font-semibold ${card.pillBg} ${card.pillText} px-2 py-0.5 rounded-full block whitespace-nowrap`}
              >
                {card.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. My Leave Requests Table Card */}
      <div
        className="rounded-2xl border bg-white p-4 sm:p-5 space-y-4"
        style={{
          borderColor: 'rgb(229, 231, 235)',
          boxShadow: '0 2px 10px rgba(8, 11, 12, 0.03)',
        }}
      >
        {/* Header: Title + Search + Month Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: 'rgb(248, 250, 252)',
                borderColor: 'rgb(229, 231, 235)',
                color: 'rgb(8, 11, 12)',
              }}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              My Leave Requests
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search by Request ID or Reason */}
            <div className="relative min-w-[220px] sm:w-64">
              <svg
                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by Request ID, Reason..."
                aria-label="Search leave requests"
                data-testid="leave-search-input"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2"
                style={{ borderColor: 'rgb(229, 231, 235)' }}
              />
            </div>

            {/* Month Filter Dropdown */}
            <div className="relative">
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by month"
                data-testid="leave-month-filter"
                className="appearance-none w-full sm:w-auto pl-3.5 pr-9 py-2 rounded-xl border bg-white text-xs font-semibold text-gray-800 cursor-pointer focus:outline-none focus:ring-2"
                style={{ borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="all">All Months</option>
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
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
        </div>

        {/* Status Filter Chips (kept compact & accessible for tests) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
          {[
            { value: 'all', label: `All (${statusCounts.all})` },
            { value: 'pending', label: `Pending (${statusCounts.pending})` },
            { value: 'approved', label: `Approved (${statusCounts.approved})` },
            { value: 'rejected', label: `Rejected (${statusCounts.rejected})` },
            { value: 'cancelled', label: `Cancelled (${statusCounts.cancelled})` },
          ].map((opt) => {
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold min-h-[34px] transition-colors border"
                style={
                  active
                    ? {
                        backgroundColor: 'rgb(85, 205, 179)',
                        borderColor: 'rgb(85, 205, 179)',
                        color: 'rgb(8, 11, 12)',
                      }
                    : {
                        backgroundColor: 'rgb(255, 255, 255)',
                        borderColor: 'rgb(229, 231, 235)',
                        color: 'rgb(75, 85, 99)',
                      }
                }
                data-testid={`filter-status-${opt.value}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Table / Empty / Mobile Cards */}
        {paginatedItems.length === 0 && !isLoading ? (
          <EmptyState
            title="No Leave Requests Found"
            description={
              statusFilter === 'all' && !searchQuery && monthFilter === 'all'
                ? 'You have not submitted any leave requests yet.'
                : 'No leave requests match the active filters.'
            }
            actionLabel={statusFilter === 'all' && onApplyClick ? 'Apply for Leave' : undefined}
            onAction={statusFilter === 'all' && onApplyClick ? onApplyClick : undefined}
          />
        ) : (
          <>
            {/* Desktop & Tablet Table View */}
            <div
              className="hidden md:block rounded-xl border overflow-hidden"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'rgb(235, 250, 247)' }}>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Request ID
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Leave Type
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Start Date
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        End Date
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Total Days
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Applied Date
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Reason
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Status
                      </th>
                      <th
                        className="py-3 px-2.5 text-xs font-bold text-right whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgb(241, 245, 249)' }}>
                    {paginatedItems.map((item) => {
                      const pill = getLeaveTypePillStyle(item.leaveTypeName);
                      const canEdit = isEligiblePending(item.status);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50/70 transition-colors"
                          data-testid={`leave-request-row-${item.id}`}
                        >
                          <td
                            className="py-3 px-2.5 text-xs font-semibold whitespace-nowrap"
                            style={{ color: 'rgb(8, 11, 12)' }}
                          >
                            {item.requestCode}
                          </td>
                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                              style={{ backgroundColor: pill.bg, color: pill.color }}
                            >
                              {item.leaveTypeName}
                            </span>
                          </td>
                          <td className="py-3 px-2.5 text-xs text-gray-700 whitespace-nowrap">
                            {formatShortDate(item.startDate)}
                          </td>
                          <td className="py-3 px-2.5 text-xs text-gray-700 whitespace-nowrap">
                            {formatShortDate(item.endDate)}
                          </td>
                          <td className="py-3 px-2.5 text-xs font-medium text-gray-800 whitespace-nowrap">
                            {formatDaysLabel(item.days, item.halfDay)}
                          </td>
                          <td className="py-3 px-2.5 text-xs text-gray-700 whitespace-nowrap">
                            {formatShortDate(item.appliedDate)}
                          </td>
                          <td className="py-3 px-2.5 text-xs text-gray-700 max-w-[140px] truncate">
                            {item.reason}
                          </td>
                          <td className="py-3 px-2.5 whitespace-nowrap">
                            {renderStatusBadge(item.status)}
                          </td>
                          <td className="py-3 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedRequest(item)}
                                aria-label={`View ${item.requestCode}`}
                                data-testid={`view-leave-btn-${item.id}`}
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 inline-flex items-center justify-center transition-colors"
                                title="View Details"
                              >
                                <svg
                                  className="w-3.5 h-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.9"
                                >
                                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRequest(item)}
                                  aria-label={`Edit ${item.requestCode}`}
                                  data-testid={`edit-leave-btn-${item.id}`}
                                  className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 inline-flex items-center justify-center transition-colors"
                                  title="Manage / Edit Pending Request"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.9"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    />
                                  </svg>
                                </button>
                              )}
                              {item.rawRequest &&
                                (canEdit || item.status.toLowerCase() === 'approved') &&
                                onCancelRequest && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancel(item.id)}
                                    disabled={cancellingId === item.id}
                                    data-testid={`table-cancel-leave-btn-${item.id}`}
                                    aria-label={`Cancel ${item.leaveTypeName} leave`}
                                    className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  >
                                    {cancellingId === item.id ? 'Cancelling...' : 'Cancel'}
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="grid grid-cols-1 gap-3 md:hidden" data-testid="mobile-leave-cards">
              {paginatedItems.map((item) => {
                const pill = getLeaveTypePillStyle(item.leaveTypeName);
                const canEdit = isEligiblePending(item.status);
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white rounded-xl border space-y-2.5"
                    style={{ borderColor: 'rgb(229, 231, 235)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                        {item.requestCode}
                      </span>
                      {renderStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: pill.bg, color: pill.color }}
                      >
                        {item.leaveTypeName}
                      </span>
                      <span className="text-xs font-semibold text-gray-800">
                        {formatDaysLabel(item.days, item.halfDay)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium text-gray-800">Dates:</span>{' '}
                        {formatShortDate(item.startDate)} – {formatShortDate(item.endDate)}
                      </p>
                      <p>
                        <span className="font-medium text-gray-800">Applied:</span>{' '}
                        {formatShortDate(item.appliedDate)}
                      </p>
                      <p>
                        <span className="font-medium text-gray-800">Reason:</span> {item.reason}
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(item)}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"
                      >
                        View
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"
                        >
                          Edit
                        </button>
                      )}
                      {item.rawRequest && canEdit && onCancelRequest && (
                        <button
                          type="button"
                          onClick={() => handleCancel(item.id)}
                          aria-label={`Cancel ${item.leaveTypeName} leave`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs text-gray-500">
                Showing {totalFiltered === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + PAGE_SIZE, totalFiltered)} of {totalFiltered} records
              </p>
              <div className="inline-flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 inline-flex items-center justify-center text-xs hover:bg-gray-50"
                >
                  &lsaquo;
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                  const isActive = pageNum === safePage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 rounded-lg border text-xs font-bold inline-flex items-center justify-center transition-colors"
                      style={
                        isActive
                          ? {
                              backgroundColor: 'rgb(85, 205, 179)',
                              borderColor: 'rgb(85, 205, 179)',
                              color: 'rgb(8, 11, 12)',
                            }
                          : {
                              backgroundColor: 'rgb(255, 255, 255)',
                              borderColor: 'rgb(229, 231, 235)',
                              color: 'rgb(75, 85, 99)',
                            }
                      }
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  aria-label="Next page"
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 inline-flex items-center justify-center text-xs hover:bg-gray-50"
                >
                  &rsaquo;
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Leave Request Details Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-detail-modal-title"
          data-testid="leave-detail-modal"
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white border p-5 space-y-4 shadow-xl"
            style={{ borderColor: 'rgb(229, 231, 235)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-gray-500">{selectedRequest.requestCode}</p>
                <h3
                  id="leave-detail-modal-title"
                  className="text-lg font-bold font-display"
                  style={{ color: 'rgb(8, 11, 12)' }}
                >
                  {selectedRequest.leaveTypeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                aria-label="Close details"
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 inline-flex items-center justify-center"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Status</span>
                {renderStatusBadge(selectedRequest.status)}
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Start Date</span>
                <span className="font-semibold text-gray-800">
                  {formatShortDate(selectedRequest.startDate)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">End Date</span>
                <span className="font-semibold text-gray-800">
                  {formatShortDate(selectedRequest.endDate)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Total Days</span>
                <span className="font-semibold text-gray-800">
                  {formatDaysLabel(selectedRequest.days, selectedRequest.halfDay)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">Applied Date</span>
                <span className="font-semibold text-gray-800">
                  {formatShortDate(selectedRequest.appliedDate)}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-gray-500 block mb-1">Reason</span>
                <p className="p-2.5 rounded-xl bg-gray-50 text-gray-800">
                  {selectedRequest.reason}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {selectedRequest.rawRequest &&
                isEligiblePending(selectedRequest.status) &&
                onCancelRequest && (
                  <button
                    type="button"
                    onClick={() => handleCancel(selectedRequest.id)}
                    disabled={cancellingId === selectedRequest.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50"
                  >
                    {cancellingId === selectedRequest.id ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                )}
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold"
                style={{ backgroundColor: 'rgb(85, 205, 179)', color: 'rgb(8, 11, 12)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
