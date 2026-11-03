export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSummary {
  name: string;
  title: string;
  description: string;
  module: string;
  columns: ReportColumn[];
}

export type ReportCellValue = string | number | boolean | null | undefined;
export type ReportRow = Record<string, ReportCellValue>;

export interface ReportPreviewMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ReportPreviewResponse {
  data: ReportRow[];
  meta: ReportPreviewMeta;
}

export type ExportFormat = 'csv' | 'pdf';

export interface ReportFilters {
  // Date range filters (attendance, tasks)
  from?: string;
  to?: string;
  dueFrom?: string;
  dueTo?: string;

  // Year filter (leave usage)
  year?: number;

  // Dropdown / entity filters
  departmentId?: string;
  projectId?: string;
  leaveTypeId?: string;

  // Status & grouping filters
  status?: string;
  groupBy?: 'department' | 'designation';
}
