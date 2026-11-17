import { useMemo } from 'react';
import {
  DataTable,
  type Column,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
} from '../../../components/ui';
import { AttendanceCalendarView } from './AttendanceCalendarView';
import { AttendanceFilters } from './AttendanceFilters';
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
  const handleResetAll = () => {
    resetFilters();
  };

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

      {/* Month selector + Existing Attendance Records & Corrections Table */}
      <div className="p-3 sm:p-4 rounded-card border border-border/80 space-y-3 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/80">
          <span className="text-xs font-semibold text-text">Attendance Records &amp; History</span>
          <span className="text-xs text-text-muted">
            Showing {records.length} of {meta.total} attendance record(s)
          </span>
        </div>

        <AttendanceFilters
          startDate={startDate}
          endDate={endDate}
          status={status}
          scope={scope}
          displayMode={displayMode}
          canViewTeam={canViewTeam}
          onStartDateChange={(d) => {
            setStartDate(d);
          }}
          onEndDateChange={(d) => {
            setEndDate(d);
          }}
          onStatusChange={setStatus}
          onScopeChange={setScope}
          onDisplayModeChange={setDisplayMode}
          onReset={handleResetAll}
        />

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
        ) : (
          <DataTable<AttendanceRecord>
            data={records}
            columns={columns}
            keyExtractor={(row) => row.id}
            ariaLabel="Attendance Records Table"
            page={page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={setPage}
            sortKey={sortBy}
            sortDirection={sortOrder}
            onSortChange={(col, order) => {
              if (col === 'workDate' || col === 'checkInTime' || col === 'createdAt') {
                setSorting(col, order);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
