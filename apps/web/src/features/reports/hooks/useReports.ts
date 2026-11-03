import { useCallback, useEffect, useMemo, useState } from 'react';
import { exportReport, fetchReportCatalog, previewReport } from '../api/reportsApi';
import type {
  ExportFormat,
  ReportFilters,
  ReportPreviewMeta,
  ReportRow,
  ReportSummary,
} from '../types';

export function getDefaultFiltersForReport(reportName: string): ReportFilters {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  // 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromMonth = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
  const fromDay = String(thirtyDaysAgo.getDate()).padStart(2, '0');
  const fromDate = `${thirtyDaysAgo.getFullYear()}-${fromMonth}-${fromDay}`;
  const toDate = `${year}-${month}-${day}`;

  switch (reportName) {
    case 'attendance-summary':
      return { from: fromDate, to: toDate };
    case 'leave-usage':
      return { year };
    case 'task-status':
      return { dueFrom: fromDate, dueTo: toDate };
    case 'project-status':
      return { status: 'active' };
    case 'employee-headcount':
      return { groupBy: 'department' };
    default:
      return {};
  }
}

export function useReports() {
  const [catalog, setCatalog] = useState<ReportSummary[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedReportName, setSelectedReportName] = useState<string>('');
  const [filters, setFilters] = useState<ReportFilters>({});

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [previewRows, setPreviewRows] = useState<ReportRow[]>([]);
  const [meta, setMeta] = useState<ReportPreviewMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Load report catalog on mount
  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    setCatalogError(null);

    void fetchReportCatalog()
      .then((data) => {
        if (cancelled) return;
        setCatalog(data);
        if (data.length > 0 && !selectedReportName) {
          const first = data[0];
          if (first) {
            setSelectedReportName(first.name);
            setFilters(getDefaultFiltersForReport(first.name));
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCatalogError(err instanceof Error ? err.message : 'Failed to load report catalog.');
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedReport = useMemo(() => {
    return catalog.find((r) => r.name === selectedReportName);
  }, [catalog, selectedReportName]);

  // When selected report changes, reset filters to its default
  const handleSelectReport = (name: string) => {
    setSelectedReportName(name);
    setFilters(getDefaultFiltersForReport(name));
    setPage(1);
  };

  const loadPreview = useCallback(async () => {
    if (!selectedReportName) return;

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const res = await previewReport(selectedReportName, filters, { page, pageSize });
      setPreviewRows(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate report preview.');
      setPreviewRows([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedReportName, filters, page, pageSize]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const handleExport = async (format: ExportFormat) => {
    if (!selectedReportName) return;
    setExporting(true);
    setExportError(null);

    try {
      const { filename, blob } = await exportReport(selectedReportName, format, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    if (selectedReportName) {
      setFilters(getDefaultFiltersForReport(selectedReportName));
      setPage(1);
    }
  };

  return {
    catalog,
    loadingCatalog,
    catalogError,
    selectedReportName,
    selectedReport,
    selectReport: handleSelectReport,
    filters,
    setFilters,
    resetFilters,
    previewRows,
    meta,
    loadingPreview,
    previewError,
    page,
    setPage,
    pageSize,
    setPageSize,
    exporting,
    exportError,
    handleExport,
    refetch: loadPreview,
  };
}
