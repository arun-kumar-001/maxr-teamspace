import { useMemo, useState } from 'react';
import {
  DataTable,
  type Column,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
  Input,
  Select,
} from '../../../components/ui';
import { AttendanceCalendarView } from './AttendanceCalendarView';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';
import { CorrectionsHistoryView } from './CorrectionsHistoryView';
import { MyAttendanceCalendarBoard } from './MyAttendanceCalendarBoard';
import { TeamAttendanceGrid } from './TeamAttendanceGrid';
import type {
  AttendanceCorrection,
  AttendancePaginationMeta,
  AttendanceRecord,
  AttendanceStatus,
  TodayAttendanceSummary,
} from '../types';
import type { AttendanceDisplayMode, AttendanceViewScope } from '../hooks/useAttendanceHistory';

export interface MyAttendanceTabProps {
  records: AttendanceRecord[];
  meta: AttendancePaginationMeta;
  isLoading: boolean;
  error: string | null;
  scope: AttendanceViewScope;
  setScope: (scope: AttendanceViewScope) => void;
  displayMode: AttendanceDisplayMode;
  setDisplayMode: (mode: AttendanceDisplayMode) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  status: AttendanceStatus | '';
  setStatus: (status: AttendanceStatus | '') => void;
  page: number;
  setPage: (page: number) => void;
  sortBy: 'workDate' | 'checkInTime' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  setSorting: (sortBy: 'workDate' | 'checkInTime' | 'createdAt', sortOrder: 'asc' | 'desc') => void;
  resetFilters: () => void;
  refresh: () => Promise<void>;
  canViewTeam: boolean;
  todaySummary: TodayAttendanceSummary | null;
  corrections: AttendanceCorrection[];
  correctionsMeta: AttendancePaginationMeta;
  isCorrectionsLoading: boolean;
  correctionsError: string | null;
  correctionsPage: number;
  setCorrectionsPage: (p: number) => void;
  onCancelCorrection: (id: string) => Promise<void>;
  onRefetchCorrections: () => void;
  onOpenCorrectionModal: (record: AttendanceRecord) => void;
  onGoToCheckIn: () => void;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '\u2014';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatRecordHeaderDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '\u2014';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function MyAttendanceTab({
  records,
  meta,
  isLoading,
  error,
  scope,
  setScope,
  displayMode,
  setDisplayMode,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  status,
  setStatus,
  page,
  setPage,
  sortBy,
  sortOrder,
  setSorting,
  resetFilters,
  refresh,
  canViewTeam,
  todaySummary,
  corrections,
  correctionsMeta,
  isCorrectionsLoading,
  correctionsError,
  correctionsPage,
  setCorrectionsPage,
  onCancelCorrection,
  onRefetchCorrections,
  onOpenCorrectionModal,
  onGoToCheckIn,
}: MyAttendanceTabProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasActiveFilters = Boolean(startDate || endDate || status);

  const handleResetAll = () => {
    resetFilters();
    setSearchQuery('');
  };

  const displayedRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((rec) => {
      const matchDate = rec.workDate.toLowerCase().includes(q);
      const matchFormattedDate = formatRecordHeaderDate(rec.workDate).toLowerCase().includes(q);
      const matchStatus = rec.status.toLowerCase().replace(/_/g, ' ').includes(q);
      const matchNotes = rec.notes ? rec.notes.toLowerCase().includes(q) : false;
      const matchEmployee = rec.employeeName ? rec.employeeName.toLowerCase().includes(q) : false;
      const matchWorkMode = rec.location?.workMode
        ? rec.location.workMode.toLowerCase().includes(q)
        : false;
      return (
        matchDate ||
        matchFormattedDate ||
        matchStatus ||
        matchNotes ||
        matchEmployee ||
        matchWorkMode
      );
    });
  }, [records, searchQuery]);

  const columns = useMemo<Column<AttendanceRecord>[]>(
    () => [
      {
        key: 'workDate',
        header: 'Date',
        sortable: true,
        priority: 'high',
        render: (row) => <span className="font-semibold text-text">{row.workDate}</span>,
      },
      {
        key: 'checkInTime',
        header: 'Check-In',
        sortable: true,
        priority: 'high',
        render: (row) => <span className="text-text">{formatTime(row.checkInTime)}</span>,
      },
      {
        key: 'checkOutTime',
        header: 'Check-Out',
        priority: 'high',
        render: (row) => <span className="text-text-muted">{formatTime(row.checkOutTime)}</span>,
      },
      {
        key: 'durationMinutes',
        header: 'Working Hours',
        priority: 'medium',
        render: (row) =>
          row.durationMinutes !== null ? (
            <span className="font-medium text-text">{formatDuration(row.durationMinutes)}</span>
          ) : (
            <span className="text-text-subtle">&mdash;</span>
          ),
      },
      {
        key: 'workMode',
        header: 'Mode',
        priority: 'medium',
        render: (row) => (
          <span className="capitalize text-text-muted">{row.location?.workMode ?? 'Office'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        priority: 'high',
        render: (row) => <AttendanceStatusBadge status={row.status} size="sm" />,
      },
      {
        key: 'notes',
        header: 'Notes',
        priority: 'low',
        render: (row) => (
          <span className="text-xs text-text-muted truncate max-w-xs block">
            {row.notes ?? '\u2014'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        priority: 'high',
        render: (row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenCorrectionModal(row)}
            data-testid={`request-correction-btn-${row.id}`}
            className="text-xs min-h-[44px]"
          >
            Correct
          </Button>
        ),
      },
    ],
    [onOpenCorrectionModal],
  );

  return (
    <div className="space-y-6" data-testid="my-attendance-tab">
      <MyAttendanceCalendarBoard
        records={records}
        todaySummary={todaySummary}
        onOpenCorrectionModal={onOpenCorrectionModal}
        onGoToCheckIn={onGoToCheckIn}
      />

      {/* Attendance Records & History Section */}
      <div className="p-3 sm:p-4 rounded-2xl border border-border/80 space-y-3 bg-white shadow-xs">
        {/* Section Header: Heading + Search Bar + Mobile Filter Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2.5 border-b border-border/80">
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-text">
              Attendance Records &amp; History
            </h3>
            <p className="text-[11px] sm:text-xs text-text-muted mt-0.5">
              Showing {displayedRecords.length} of {meta.total} attendance record(s)
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-text-muted">
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-8 pr-8 py-1.5 text-xs sm:text-sm rounded-xl border border-border/80 bg-surface-muted/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-strong/20 focus:border-primary-strong transition-all min-h-[36px]"
                aria-label="Search attendance records"
                data-testid="attendance-records-search"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-text-muted hover:text-text cursor-pointer"
                  aria-label="Clear search"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filter button ONLY on mobile view (< 1024px / lg:hidden) */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="lg:hidden relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-white hover:bg-surface-muted text-xs font-semibold text-text transition-all cursor-pointer min-h-[36px] shadow-xs shrink-0"
              aria-label="Filter attendance records"
              data-testid="attendance-filter-toggle-btn"
            >
              <svg
                className="w-3.5 h-3.5 text-primary-strong"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>Filter</span>
              {hasActiveFilters && (
                <span
                  className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                  aria-label="Active filters applied"
                />
              )}
            </button>
          </div>
        </div>

        {/* Filter Bottom Sheet (Mobile) / Dialog (Tablet) */}
        {isFilterOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 animate-fade-in">
            <div
              className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Filter Attendance Records"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/80">
                <h4 className="text-sm sm:text-base font-bold text-text">
                  Filter Attendance Records
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-muted cursor-pointer transition-colors"
                  aria-label="Close filters"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-3">
                {canViewTeam && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">
                      View Scope
                    </label>
                    <div className="flex rounded-xl p-1 bg-surface-muted border border-border">
                      <button
                        type="button"
                        onClick={() => setScope('own')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg min-h-[38px] transition-colors ${
                          scope === 'own'
                            ? 'bg-surface text-primary-deep shadow-xs font-bold'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        My Attendance
                      </button>
                      <button
                        type="button"
                        onClick={() => setScope('team')}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg min-h-[38px] transition-colors ${
                          scope === 'team'
                            ? 'bg-surface text-primary-deep shadow-xs font-bold'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        Team Attendance
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5">
                    Display Mode
                  </label>
                  <div className="flex flex-wrap gap-1 p-1 bg-surface-muted rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('list')}
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                        displayMode === 'list'
                          ? 'bg-surface text-primary-deep shadow-xs font-bold'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      List View
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('calendar')}
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                        displayMode === 'calendar'
                          ? 'bg-surface text-primary-deep shadow-xs font-bold'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      Calendar View
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('corrections')}
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold rounded-lg min-h-[36px] transition-colors ${
                        displayMode === 'corrections'
                          ? 'bg-surface text-primary-deep shadow-xs font-bold'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      Corrections
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="filter-sheet-start-date"
                      className="block text-xs font-medium text-text-muted mb-1"
                    >
                      Start Date
                    </label>
                    <Input
                      id="filter-sheet-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-h-[44px] text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="filter-sheet-end-date"
                      className="block text-xs font-medium text-text-muted mb-1"
                    >
                      End Date
                    </label>
                    <Input
                      id="filter-sheet-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-h-[44px] text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="filter-sheet-status-select"
                    className="block text-xs font-medium text-text-muted mb-1"
                  >
                    Status
                  </label>
                  <Select
                    id="filter-sheet-status-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AttendanceStatus | '')}
                    options={[
                      { value: '', label: 'All Statuses' },
                      { value: 'present', label: 'Present' },
                      { value: 'late', label: 'Late' },
                      { value: 'half_day', label: 'Half Day' },
                      { value: 'absent', label: 'Absent' },
                      { value: 'on_leave', label: 'On Leave' },
                      { value: 'holiday', label: 'Holiday' },
                      { value: 'weekend', label: 'Weekend' },
                    ]}
                    className="w-full min-h-[44px] text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/80">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1 min-h-[44px]"
                  onClick={() => {
                    handleResetAll();
                    setIsFilterOpen(false);
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="flex-1 min-h-[44px]"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <div
            className="p-6 bg-surface border border-border rounded-card space-y-4"
            data-testid="attendance-loading-skeleton"
          >
            <Skeleton variant="rectangular" height={24} className="w-48" />
            <Skeleton variant="rectangular" height={40} className="w-full" />
            <Skeleton variant="rectangular" height={40} className="w-full" />
            <Skeleton variant="rectangular" height={40} className="w-full" />
          </div>
        ) : error ? (
          <ErrorState title="Could not load attendance records" message={error} onRetry={refresh} />
        ) : displayMode === 'corrections' ? (
          <CorrectionsHistoryView
            corrections={corrections}
            meta={correctionsMeta}
            isLoading={isCorrectionsLoading}
            error={correctionsError}
            page={correctionsPage}
            onPageChange={setCorrectionsPage}
            onCancelCorrection={onCancelCorrection}
            onRetry={onRefetchCorrections}
          />
        ) : displayMode === 'calendar' ? (
          <AttendanceCalendarView records={records} />
        ) : displayMode === 'teamGrid' && canViewTeam && scope === 'team' ? (
          <TeamAttendanceGrid records={records} />
        ) : records.length === 0 ? (
          <EmptyState
            title="No attendance records found"
            description="There are no attendance sessions matching your current filters or date range."
            actionLabel="Reset Filters"
            onAction={handleResetAll}
          />
        ) : displayedRecords.length === 0 ? (
          <EmptyState
            title="No matching records found"
            description={`No attendance records matched "${searchQuery}".`}
            actionLabel="Clear Search"
            onAction={() => setSearchQuery('')}
          />
        ) : (
          <>
            {/* Mobile & Tablet Compact Expandable Cards (lg:hidden) */}
            <div className="lg:hidden space-y-2.5" data-testid="attendance-mobile-cards">
              {displayedRecords.map((row) => {
                const isExpanded = expandedCardId === row.id;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border/80 bg-white p-3 sm:p-4 shadow-xs transition-all"
                    data-testid={`attendance-record-card-${row.id}`}
                  >
                    {/* Collapsed Header: Date on left, Status Badge and Chevron on right in a single horizontal row */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedCardId(isExpanded ? null : row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedCardId(isExpanded ? null : row.id);
                        }
                      }}
                      className="flex items-center justify-between gap-2.5 sm:gap-3 cursor-pointer select-none"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-8 h-8 rounded-xl bg-surface-muted border border-border/80 flex items-center justify-center text-primary-strong shrink-0">
                          <svg
                            className="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-text truncate">
                          {formatRecordHeaderDate(row.workDate)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        <AttendanceStatusBadge status={row.status} size="sm" />
                        <svg
                          className={`w-4 h-4 text-text-muted transition-transform duration-200 ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="pt-3 mt-3 border-t border-border/80 space-y-3 animate-fade-in text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 rounded-xl bg-surface-muted/50 border border-border/60">
                            <span className="text-[10px] text-text-muted block">Check-In</span>
                            <span className="font-semibold text-text">
                              {formatTime(row.checkInTime)}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface-muted/50 border border-border/60">
                            <span className="text-[10px] text-text-muted block">Check-Out</span>
                            <span className="font-semibold text-text">
                              {formatTime(row.checkOutTime)}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface-muted/50 border border-border/60">
                            <span className="text-[10px] text-text-muted block">Working Hours</span>
                            <span className="font-semibold text-text">
                              {row.durationMinutes !== null
                                ? formatDuration(row.durationMinutes)
                                : '\u2014'}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface-muted/50 border border-border/60">
                            <span className="text-[10px] text-text-muted block">Work Mode</span>
                            <span className="font-semibold text-text capitalize">
                              {row.location?.workMode ?? 'Office'}
                            </span>
                          </div>
                        </div>

                        {row.notes && (
                          <div className="p-2 rounded-xl bg-surface-muted/50 border border-border/60">
                            <span className="text-[10px] text-text-muted block">Notes</span>
                            <span className="text-text">{row.notes}</span>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenCorrectionModal(row)}
                          data-testid={`request-correction-btn-${row.id}`}
                          className="w-full text-xs min-h-[40px]"
                        >
                          Request Correction
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Mobile Pagination */}
              {meta.total > meta.pageSize && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-text-muted">
                    Page {page} of {Math.ceil(meta.total / meta.pageSize)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= Math.ceil(meta.total / meta.pageSize)}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>

            {/* Desktop Table View (hidden on mobile and tablet) */}
            <div className="hidden lg:block">
              <DataTable<AttendanceRecord>
                data={displayedRecords}
                columns={columns}
                keyExtractor={(row) => row.id}
                ariaLabel="Attendance Records Table"
                page={page}
                pageSize={meta.pageSize}
                total={searchQuery ? displayedRecords.length : meta.total}
                onPageChange={setPage}
                sortKey={sortBy}
                sortDirection={sortOrder}
                onSortChange={(col, order) => {
                  if (col === 'workDate' || col === 'checkInTime' || col === 'createdAt') {
                    setSorting(col, order);
                  }
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
