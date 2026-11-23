import { Button } from '../../../components/ui/Button';
import type { ExportFormat, ReportSummary } from '../types';

export interface ReportHeaderProps {
  selectedReport?: ReportSummary;
  roleScopeLabel: string;
  onExport: (format: ExportFormat) => void;
  exporting: boolean;
  totalRows: number;
}

export function ReportHeader({
  selectedReport,
  roleScopeLabel,
  onExport,
  exporting,
  totalRows,
}: ReportHeaderProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2"
      data-testid="report-header"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text">
            {selectedReport?.title ?? 'Reports & Analytics'}
          </h1>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-soft text-primary-deep border border-border">
            {roleScopeLabel}
          </span>
        </div>
        <p className="text-sm text-text-muted">
          {selectedReport?.description ?? 'Operational reports, workforce summaries, and exports.'}
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onExport('csv')}
          isLoading={exporting}
          disabled={exporting || totalRows === 0}
          className="min-h-[44px]"
          data-testid="export-csv-btn"
        >
          Export CSV
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onExport('pdf')}
          isLoading={exporting}
          disabled={exporting || totalRows === 0}
          className="min-h-[44px]"
          data-testid="export-pdf-btn"
        >
          Export PDF
        </Button>
      </div>
    </div>
  );
}
