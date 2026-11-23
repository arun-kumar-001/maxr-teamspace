import { useState, useEffect, useCallback } from 'react';
import type {
  AttendanceCorrection,
  AttendancePaginationMeta,
  AttendanceRecord,
  CorrectionStatus,
} from '../types';
import { fetchCorrections, cancelCorrection } from '../api/attendance';

export interface UseAttendanceCorrectionsOptions {
  initialStatus?: CorrectionStatus;
  initialPage?: number;
  pageSize?: number;
}

export function useAttendanceCorrections(options: UseAttendanceCorrectionsOptions = {}) {
  const [status, setStatus] = useState<CorrectionStatus | undefined>(options.initialStatus);
  const [page, setPage] = useState<number>(options.initialPage ?? 1);
  const pageSize = options.pageSize ?? 10;

  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [meta, setMeta] = useState<AttendancePaginationMeta>({
    page: 1,
    pageSize,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Request Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const loadCorrections = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchCorrections({ page, pageSize, status });
      setCorrections(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance corrections');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, status]);

  useEffect(() => {
    loadCorrections();
  }, [loadCorrections]);

  const openRequestModal = useCallback((record: AttendanceRecord) => {
    setSelectedRecord(record);
    setIsRequestModalOpen(true);
  }, []);

  const closeRequestModal = useCallback(() => {
    setIsRequestModalOpen(false);
    setSelectedRecord(null);
  }, []);

  const handleCancel = useCallback(
    async (id: string) => {
      try {
        await cancelCorrection(id);
        await loadCorrections();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel correction request');
      }
    },
    [loadCorrections],
  );

  return {
    corrections,
    meta,
    isLoading,
    error,
    page,
    setPage,
    status,
    setStatus,
    refetch: loadCorrections,
    isRequestModalOpen,
    selectedRecord,
    openRequestModal,
    closeRequestModal,
    handleCancel,
  };
}
