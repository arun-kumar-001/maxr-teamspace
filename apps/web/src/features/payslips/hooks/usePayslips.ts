import { useCallback, useEffect, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import {
  createPayslip,
  downloadPayslipPdf,
  fetchAllPayslips,
  fetchMyPayslips,
  publishPayslip,
} from '../api/payslips';
import type { CreatePayslipInput, PayslipRecord } from '../types';

export function usePayslips() {
  const { user, role } = useAuth();
  const effectiveRole = user?.role ?? role;
  const canManage = effectiveRole === ROLES.ADMIN || effectiveRole === ROLES.HR_MANAGER;

  const [myPayslips, setMyPayslips] = useState<PayslipRecord[]>([]);
  const [allPayslips, setAllPayslips] = useState<PayslipRecord[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const mine = await fetchMyPayslips({
        payYear: selectedYear || undefined,
        payMonth: selectedMonth || undefined,
        pageSize: 50,
      });
      setMyPayslips(mine.data);

      if (canManage) {
        const all = await fetchAllPayslips({
          payYear: selectedYear || undefined,
          payMonth: selectedMonth || undefined,
          pageSize: 50,
        });
        setAllPayslips(all.data);
      } else {
        setAllPayslips([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payslips');
    } finally {
      setIsLoading(false);
    }
  }, [canManage, selectedYear, selectedMonth]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDownload = useCallback(async (record: PayslipRecord) => {
    setDownloadingId(record.id);
    try {
      return await downloadPayslipPdf(record);
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handlePublish = useCallback(
    async (id: string) => {
      setPublishingId(id);
      try {
        await publishPayslip(id);
        await refresh();
      } finally {
        setPublishingId(null);
      }
    },
    [refresh],
  );

  const handleCreate = useCallback(
    async (input: CreatePayslipInput) => {
      const created = await createPayslip(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  return {
    canManage,
    myPayslips,
    allPayslips,
    selectedYear,
    setSelectedYear,
    selectedMonth,
    setSelectedMonth,
    isLoading,
    error,
    downloadingId,
    publishingId,
    refresh,
    handleDownload,
    handlePublish,
    handleCreate,
  };
}
