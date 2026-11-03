import { apiFetch } from '../../../api/client';
import type { ExportFormat, ReportFilters, ReportPreviewResponse, ReportSummary } from '../types';

export class ReportsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ReportsApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // response not JSON
    }
    throw new ReportsApiError(errorMsg, res.status, code);
  }
  return res.json() as Promise<T>;
}

function buildQueryString(
  filters: ReportFilters,
  paging?: { page?: number; pageSize?: number },
): string {
  const params = new URLSearchParams();
  if (paging?.page) params.set('page', String(paging.page));
  if (paging?.pageSize) params.set('pageSize', String(paging.pageSize));

  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.dueFrom) params.set('dueFrom', filters.dueFrom);
  if (filters.dueTo) params.set('dueTo', filters.dueTo);
  if (filters.year) params.set('year', String(filters.year));
  if (filters.departmentId) params.set('departmentId', filters.departmentId);
  if (filters.projectId) params.set('projectId', filters.projectId);
  if (filters.leaveTypeId) params.set('leaveTypeId', filters.leaveTypeId);
  if (filters.status) params.set('status', filters.status);
  if (filters.groupBy) params.set('groupBy', filters.groupBy);

  return params.toString();
}

export async function fetchReportCatalog(signal?: AbortSignal): Promise<ReportSummary[]> {
  const res = await apiFetch('/api/v1/reports', signal ? { signal } : undefined);
  const data = await handleResponse<{ data: ReportSummary[] }>(res);
  return data.data;
}

export async function previewReport(
  name: string,
  filters: ReportFilters,
  paging: { page: number; pageSize: number },
  signal?: AbortSignal,
): Promise<ReportPreviewResponse> {
  const qs = buildQueryString(filters, paging);
  const url = `/api/v1/reports/${encodeURIComponent(name)}${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(url, signal ? { signal } : undefined);
  return handleResponse<ReportPreviewResponse>(res);
}

export async function exportReport(
  name: string,
  format: ExportFormat,
  filters: ReportFilters,
): Promise<{ filename: string; blob: Blob }> {
  const qs = buildQueryString(filters);
  const fullQs = qs ? `${qs}&format=${format}` : `format=${format}`;
  const url = `/api/v1/reports/${encodeURIComponent(name)}/export?${fullQs}`;

  const res = await apiFetch(url);
  if (!res.ok) {
    let errorMsg = `Export failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // not JSON
    }
    throw new ReportsApiError(errorMsg, res.status, code);
  }

  // Extract filename from Content-Disposition header if available
  let filename = `${name}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const disposition = res.headers.get('content-disposition');
  if (disposition) {
    const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
    if (filenameMatch?.[1]) {
      filename = decodeURIComponent(filenameMatch[1]);
    }
  }

  const blob = await res.blob();
  return { filename, blob };
}
