import { useCallback, useEffect, useState } from 'react';
import { fetchMyAttendanceHistory, fetchTeamAttendance } from '../api/attendance';
import type {
  AttendancePaginationMeta,
  AttendanceQuery,
  AttendanceRecord,
  AttendanceStatus,
} from '../types';

export type AttendanceViewScope = 'own' | 'team';
export type AttendanceDisplayMode = 'list' | 'calendar' | 'teamGrid' | 'corrections';

export interface UseAttendanceHistoryOptions {
  initialScope?: AttendanceViewScope;
  initialDisplayMode?: AttendanceDisplayMode;
  pageSize?: number;
}

export interface UseAttendanceHistoryResult {
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
}

export function useAttendanceHistory({
  initialScope = 'own',
  initialDisplayMode = 'list',
  pageSize = 10,
}: UseAttendanceHistoryOptions = {}): UseAttendanceHistoryResult {
  const [scope, setScope] = useState<AttendanceViewScope>(initialScope);
  const [displayMode, setDisplayMode] = useState<AttendanceDisplayMode>(initialDisplayMode);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [meta, setMeta] = useState<AttendancePaginationMeta>({ page: 1, pageSize, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'workDate' | 'checkInTime' | 'createdAt'>('workDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query: AttendanceQuery = {
        page,
        pageSize,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: status || undefined,
        sortBy,
        sortOrder,
      };

      const res =
        scope === 'team' ? await fetchTeamAttendance(query) : await fetchMyAttendanceHistory(query);

      setRecords(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch attendance records';
      setError(msg);
      setRecords([]);
      setMeta({ page: 1, pageSize, total: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [scope, page, pageSize, startDate, endDate, status, sortBy, sortOrder]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const resetFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setStatus('');
    setPage(1);
  }, []);

  const setSorting = useCallback(
    (newSortBy: 'workDate' | 'checkInTime' | 'createdAt', newSortOrder: 'asc' | 'desc') => {
      setSortBy(newSortBy);
      setSortOrder(newSortOrder);
      setPage(1);
    },
    [],
  );

  return {
    records,
    meta,
    isLoading,
    error,
    scope,
    setScope: (newScope) => {
      setScope(newScope);
      setPage(1);
    },
    displayMode,
    setDisplayMode,
    startDate,
    setStartDate: (date) => {
      setStartDate(date);
      setPage(1);
    },
    endDate,
    setEndDate: (date) => {
      setEndDate(date);
      setPage(1);
    },
    status,
    setStatus: (newStatus) => {
      setStatus(newStatus);
      setPage(1);
    },
    page,
    setPage,
    sortBy,
    sortOrder,
    setSorting,
    resetFilters,
    refresh,
  };
}
