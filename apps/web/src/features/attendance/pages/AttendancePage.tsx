import { useMemo } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { DataTable, type Column, EmptyState, ErrorState, Skeleton } from '../../../components/ui';
import { AttendanceCalendarView } from '../components/AttendanceCalendarView';
import { AttendanceFilters } from '../components/AttendanceFilters';
import { AttendanceStatusBadge } from '../components/AttendanceStatusBadge';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { TeamAttendanceGrid } from '../components/TeamAttendanceGrid';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import type { AttendanceRecord } from '../types';

function formatTime(isoString: string | null): string {
  if (!isoString) return '\u2014';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function AttendancePage() {
  const { user } = useAuth();

  const canViewTeam = Boolean(
    user &&
    (user.role === ROLES.TEAM_LEAD || user.role === ROLES.HR_MANAGER || user.role === ROLES.ADMIN),
  );

  const {
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
  } = useAttendanceHistory({
    initialScope: 'own',
    initialDisplayMode: 'list',
    pageSize: 10,
  });

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
        header: 'Duration',
        priority: 'medium',
        render: (row) =>
          row.durationMinutes !== null ? (
            <span className="font-medium text-text">
              {Math.floor(row.durationMinutes / 60)}h {row.durationMinutes % 60}m
            </span>
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
    ],
    [],
  );

  return (
    <div className="space-y-6" data-testid="attendance-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
            Attendance & Shifts
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Check-in, daily sessions, work hours, and team attendance records
          </p>
        </div>
      </div>

      {/* Attendance Check-in Widget */}
      <AttendanceWidget onSessionChange={refresh} />

      {/* Filters and View Toggles */}
      <AttendanceFilters
        startDate={startDate}
        endDate={endDate}
        status={status}
        scope={scope}
        displayMode={displayMode}
        canViewTeam={canViewTeam}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onStatusChange={setStatus}
        onScopeChange={setScope}
        onDisplayModeChange={setDisplayMode}
        onReset={resetFilters}
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
      ) : displayMode === 'calendar' ? (
        <AttendanceCalendarView records={records} />
      ) : displayMode === 'teamGrid' && canViewTeam && scope === 'team' ? (
        <TeamAttendanceGrid records={records} />
      ) : records.length === 0 ? (
        <EmptyState
          title="No attendance records found"
          description="There are no attendance sessions matching your current filters or date range."
          actionLabel="Reset Filters"
          onAction={resetFilters}
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
  );
}
