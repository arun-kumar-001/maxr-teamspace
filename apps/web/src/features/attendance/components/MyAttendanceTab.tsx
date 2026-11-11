import { useMemo, useState } from 'react';
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

function getMonthBounds(yearMonth: string): { start: string; end: string } {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
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
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const handleMonthChange = (val: string) => {
    setSelectedMonth(val);
    if (!val) {
      setStartDate('');
      setEndDate('');
    } else {
      const { start, end } = getMonthBounds(val);
      setStartDate(start);
      setEndDate(end);
    }
    setPage(1);
  };

  const handleResetAll = () => {
    setSelectedMonth('');
    resetFilters();
  };

  const stats = useMemo(() => {
    const presentSet = new Set<string>();
    let lateCount = 0;
    let absentCount = 0;
    let earlyCheckoutCount = 0;
    let totalMinutes = 0;

    for (const r of records) {
      if (r.status === 'absent') {
        absentCount += 1;
      } else {
        presentSet.add(r.workDate);
      }
      if (r.status === 'late') {
        lateCount += 1;
      }
      if (r.durationMinutes !== null) {
        totalMinutes += r.durationMinutes;
        if (r.checkOutTime && r.durationMinutes > 0 && r.durationMinutes < 450) {
          earlyCheckoutCount += 1;
        }
      }
    }

    const totalWorkingDays = Math.max(22, presentSet.size + absentCount);
    const attendancePct =
      totalWorkingDays > 0
        ? Math.min(100, Math.round((presentSet.size / totalWorkingDays) * 100))
        : 0;

    return {
      totalWorkingDays,
      presentDays: presentSet.size,
      absentDays: absentCount,
      lateArrivals: lateCount,
      earlyCheckOuts: earlyCheckoutCount,
      totalHours: (totalMinutes / 60).toFixed(1),
      attendancePct,
    };
  }, [records]);

  const monthOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [{ value: '', label: 'All Months' }];
    const base = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      opts.push({ value: val, label });
    }
    return opts;
  }, []);

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

  const todaySession = todaySummary?.activeSession;
  const isTodayOnBreak = Boolean(todaySession?.breaks?.some((b) => !b.endTime));
  const todayTotalBreakMinutes = (todaySummary?.sessions ?? []).reduce(
    (sum, s) => sum + (s.breakMinutes ?? 0),
    0,
  );
  const todayStatusLabel = todaySession
    ? isTodayOnBreak
      ? 'On Break'
      : 'Checked In'
    : (todaySummary?.totalDurationMinutes ?? 0) > 0
      ? 'Shift Completed'
      : 'Not Checked In';

  const kpiCards = [
    {
      label: 'Working Days',
      value: String(stats.totalWorkingDays),
      accent: 'rgb(85, 205, 179)',
    },
    {
      label: 'Present Days',
      value: String(stats.presentDays),
      accent: 'rgb(0, 220, 203)',
    },
    {
      label: 'Absent Days',
      value: String(stats.absentDays),
      accent: 'rgb(233, 138, 203)',
    },
    {
      label: 'Late Arrivals',
      value: String(stats.lateArrivals),
      accent: 'rgb(245, 158, 11)',
    },
    {
      label: 'Early Check-Outs',
      value: String(stats.earlyCheckOuts),
      accent: 'rgb(168, 85, 247)',
    },
    {
      label: 'Total Hours',
      value: `${stats.totalHours}h`,
      accent: 'rgb(85, 205, 179)',
    },
    {
      label: 'Attendance %',
      value: `${stats.attendancePct}%`,
      accent: 'rgb(0, 220, 203)',
    },
  ];

  return (
    <div className="space-y-5" data-testid="my-attendance-tab">
      {/* Today Status Strip */}
      <div
        className="p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(125deg, rgba(17, 24, 25, 0.88), rgba(73, 53, 72, 0.36))',
          borderColor: 'rgba(85, 205, 179, 0.28)',
          color: 'rgb(244, 247, 246)',
        }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: todaySession ? 'rgb(0, 220, 203)' : 'rgb(233, 138, 203)',
              }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgb(85, 205, 179)' }}
            >
              Today&apos;s Attendance
            </span>
          </div>
          <p className="text-lg font-bold font-display">
            {todayStatusLabel}
            {todaySession ? ` \u00B7 In at ${formatTime(todaySession.checkInTime)}` : ''}
          </p>
          <p className="text-xs" style={{ color: 'rgba(244, 247, 246, 0.7)' }}>
            Logged today: {formatDuration(todaySummary?.totalDurationMinutes ?? 0)} &middot; Break:{' '}
            {formatDuration(todayTotalBreakMinutes)}
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToCheckIn}
          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold min-h-[44px] transition-all cursor-pointer shrink-0"
          style={{
            backgroundColor: 'rgb(85, 205, 179)',
            color: 'rgb(8, 11, 12)',
            boxShadow: '0 0 18px rgba(0, 220, 203, 0.25)',
          }}
        >
          Go to Check-In / Check-Out
        </button>
      </div>

      {/* Monthly KPI Summary Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3"
        data-testid="my-attendance-kpi-grid"
      >
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="p-3.5 rounded-2xl border backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(17, 24, 25, 0.78)',
              borderColor: 'rgba(244, 247, 246, 0.12)',
            }}
          >
            <p className="text-[11px] font-medium" style={{ color: 'rgba(244, 247, 246, 0.65)' }}>
              {card.label}
            </p>
            <p
              className="text-xl font-bold font-display mt-1 tabular-nums"
              style={{ color: card.accent }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Month selector + Existing Filters */}
      <div
        className="p-3 sm:p-4 rounded-2xl border space-y-3"
        style={{
          backgroundColor: 'rgba(244, 247, 246, 0.96)',
          borderColor: 'rgba(227, 233, 231, 0.9)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <label
              htmlFor="attendance-month-filter"
              className="text-xs font-semibold text-text-muted"
            >
              Month Filter:
            </label>
            <select
              id="attendance-month-filter"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-lg border border-border-strong bg-surface-raised text-text min-h-[38px]"
              data-testid="attendance-month-filter"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
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
            setSelectedMonth('');
            setStartDate(d);
          }}
          onEndDateChange={(d) => {
            setSelectedMonth('');
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
