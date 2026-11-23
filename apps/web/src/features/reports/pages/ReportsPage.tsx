import { useMemo } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { ForbiddenState } from '../../../components/ui/StateCards';
import { ReportDataTable } from '../components/ReportDataTable';
import { ReportFilterBar } from '../components/ReportFilterBar';
import { ReportHeader } from '../components/ReportHeader';
import { useReports } from '../hooks/useReports';

export function ReportsPage() {
  const { user, role } = useAuth();
  const effectiveRole = role ?? user?.role;

  const isStaff = effectiveRole === ROLES.STAFF;
  const isTeamLead = effectiveRole === ROLES.TEAM_LEAD;
  const isHR = effectiveRole === ROLES.HR_MANAGER;
  const isAdmin = effectiveRole === ROLES.ADMIN;

  const roleScopeLabel = useMemo(() => {
    if (isAdmin) return 'Company-wide Scope';
    if (isHR) return 'HR Organization Scope';
    if (isTeamLead) return 'Direct Reports Scope';
    return 'Restricted Scope';
  }, [isAdmin, isHR, isTeamLead]);

  const {
    catalog,
    loadingCatalog,
    catalogError,
    selectedReportName,
    selectedReport,
    selectReport,
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
    exporting,
    exportError,
    handleExport,
    refetch,
  } = useReports();

  // Deny-by-default for Staff (AGENTS.md §1 & §7)
  if (isStaff) {
    return (
      <div className="py-8">
        <ForbiddenState
          title="Access Denied"
          message="Staff members do not have permission to access operational reports. Please contact your manager or HR administrator."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" data-testid="reports-page">
      {/* Top Header */}
      <ReportHeader
        selectedReport={selectedReport}
        roleScopeLabel={roleScopeLabel}
        onExport={handleExport}
        exporting={exporting}
        totalRows={meta.total}
      />

      {/* Export Error Alert Banner */}
      {exportError && (
        <div
          className="p-3.5 bg-tile-yellow border border-border rounded-tile text-sm space-y-1"
          role="alert"
          data-testid="export-error-banner"
        >
          <div className="font-semibold text-warning">Export Warning</div>
          <p className="text-xs text-text">{exportError}</p>
        </div>
      )}

      {/* Catalog Load Error */}
      {catalogError && (
        <div className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-tile">
          {catalogError}
        </div>
      )}

      {/* Report Filter & Switcher Bar */}
      {!loadingCatalog && catalog.length > 0 && (
        <ReportFilterBar
          catalog={catalog}
          selectedReportName={selectedReportName}
          onSelectReport={selectReport}
          filters={filters}
          onFilterChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1);
          }}
          onReset={resetFilters}
        />
      )}

      {/* Data Preview Table */}
      {selectedReport && (
        <ReportDataTable
          columns={selectedReport.columns}
          rows={previewRows}
          loading={loadingPreview}
          meta={meta}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          error={previewError}
          onRetry={() => void refetch()}
        />
      )}
    </div>
  );
}
