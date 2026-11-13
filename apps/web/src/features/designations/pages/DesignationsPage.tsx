import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { DataTable, type Column, type SortDirection } from '../../../components/ui/DataTable';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState, ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Badge } from '../../../components/ui/StatusPill';
import { Toast } from '../../../components/ui/Toast';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { DesignationCard } from '../components/DesignationCard';
import { DesignationDeactivateDialog } from '../components/DesignationDeactivateDialog';
import { DesignationDetailModal } from '../components/DesignationDetailModal';
import { DesignationFilters } from '../components/DesignationFilters';
import { DesignationModal } from '../components/DesignationModal';
import { CAREER_LEVEL_BANDS } from '../components/levelMeta';
import { useDesignations } from '../hooks/useDesignations';
import type { Designation } from '../types';

type DesigViewMode = 'all' | 'cards' | 'table';

export function DesignationsPage() {
  const { role } = useAuth();

  const canCreate = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canEdit = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canDeactivate = role === ROLES.ADMIN;

  const [viewMode, setViewMode] = useState<DesigViewMode>('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | null>(null);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchEmployeeDirectory({ page: 1, pageSize: 100 })]).then(([res]) => {
      if (cancelled) return;
      if (res.status === 'fulfilled') {
        setEmployees(res.value.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    designations,
    departments,
    departmentMap,
    meta,
    isLoading,
    error,
    isForbidden,
    search,
    departmentFilter,
    statusFilter,
    sortBy,
    sortOrder,
    setSearch,
    setDepartmentFilter,
    setStatusFilter,
    setPage,
    setSort,
    resetFilters,
    refetch,
    // Create/Edit
    isModalOpen,
    selectedDesignation,
    isSubmitting,
    modalServerError,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    // Detail
    isDetailOpen,
    detailDesignation,
    openDetail,
    closeDetail,
    // Deactivate
    isDeactivateOpen,
    deactivatingDesignation,
    isDeactivating,
    deactivateServerError,
    openDeactivate,
    closeDeactivate,
    confirmDeactivate,
    // Toast
    toast,
    dismissToast,
  } = useDesignations();

  const holdersByDesignation = useMemo(() => {
    const map = new Map<string, EmployeeDirectoryItem[]>();
    for (const emp of employees) {
      const id = emp.designation?.id;
      if (!id) continue;
      const list = map.get(id) ?? [];
      list.push(emp);
      map.set(id, list);
    }
    return map;
  }, [employees]);

  const levelCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const d of designations) {
      const clamped = Math.min(4, Math.max(1, d.level));
      counts.set(clamped, (counts.get(clamped) ?? 0) + 1);
    }
    return counts;
  }, [designations]);

  const visibleDesignations = useMemo(() => {
    if (selectedLevelFilter === null) return designations;
    return designations.filter((d) => Math.min(4, Math.max(1, d.level)) === selectedLevelFilter);
  }, [designations, selectedLevelFilter]);

  if (isForbidden) {
    return (
      <PageContainer maxWidth="dashboard">
        <div data-testid="designation-forbidden-view">
          <ForbiddenState
            title="Access Restricted"
            message="You do not have permission to manage organizational designations."
          />
        </div>
      </PageContainer>
    );
  }

  const handleSortChange = (key: string, direction: SortDirection) => {
    if (key === 'title' || key === 'code' || key === 'level' || key === 'createdAt') {
      setSort(key, direction);
    }
  };

  const columns: Column<Designation>[] = [
    {
      key: 'title',
      header: 'Designation Title',
      sortable: true,
      priority: 'high',
      render: (row) => (
        <div>
          <span className="font-semibold text-text block text-sm">{row.title}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      sortable: true,
      priority: 'high',
      render: (row) => (
        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-text">
          {row.code}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      priority: 'high',
      render: (row) => {
        const dept = departmentMap.get(row.departmentId);
        return (
          <span className="text-xs sm:text-sm text-text font-medium" title={dept?.name}>
            {dept ? dept.name : 'Unknown Dept'}
          </span>
        );
      },
    },
    {
      key: 'level',
      header: 'Level',
      sortable: true,
      priority: 'medium',
      render: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-soft text-primary-ink text-xs font-mono font-semibold">
          Level {row.level}
        </span>
      ),
    },
    {
      key: 'holders',
      header: 'Assigned Staff',
      priority: 'medium',
      render: (row) => {
        const count = (holdersByDesignation.get(row.id) ?? []).length;
        return (
          <span className="text-xs font-medium text-text-muted">
            {count} {count === 1 ? 'member' : 'members'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'medium',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      priority: 'low',
      render: (row) => (
        <span className="text-xs text-text-muted">
          {row.createdAt
            ? new Date(row.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      priority: 'high',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openDetail(row)}
            className="min-h-[44px] min-w-[44px] text-xs font-medium"
            data-testid={`table-view-desig-${row.id}`}
          >
            View
          </Button>

          {canEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openEdit(row)}
              className="min-h-[44px] min-w-[44px] text-xs font-medium"
              data-testid={`table-edit-desig-${row.id}`}
            >
              Edit
            </Button>
          )}

          {canDeactivate && row.isActive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openDeactivate(row)}
              className="min-h-[44px] min-w-[44px] text-xs font-medium text-danger hover:bg-rose-50"
              data-testid={`table-deactivate-desig-${row.id}`}
            >
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer maxWidth="dashboard" className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
          <Toast
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            onClose={dismissToast}
            autoDismissMs={4000}
          />
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border flex-wrap">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">Designations</h1>
            {!isLoading && (
              <Badge variant="primary" data-testid="designation-total-badge">
                {meta.total} {meta.total === 1 ? 'Designation' : 'Designations'}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Manage organizational job titles, seniority levels, and department alignments
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Interactive View Switcher */}
          <div
            className="hidden sm:inline-flex items-center p-1 rounded-tile bg-surface-muted border border-border"
            role="group"
            aria-label="Designation view mode"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'cards', label: 'Cards' },
                { id: 'table', label: 'Table' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={`px-2.5 py-1 rounded-input text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === opt.id
                    ? 'bg-surface text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {canCreate && (
            <Button
              type="button"
              variant="primary"
              onClick={openCreate}
              className="min-h-[44px] text-xs sm:text-sm font-semibold shrink-0"
              data-testid="add-designation-btn"
            >
              Add Designation
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Career Band Filter Strip */}
      {!isLoading && !error && designations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedLevelFilter(null)}
            className={`animate-crm-fade-up p-3 rounded-card border text-left transition-all duration-300 cursor-pointer ${
              selectedLevelFilter === null
                ? 'bg-primary-deep text-surface border-primary-deep shadow-raised'
                : 'bg-surface border-border text-text hover:border-primary-strong/40 hover:-translate-y-0.5'
            }`}
          >
            <div
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                selectedLevelFilter === null ? 'text-surface/80' : 'text-text-subtle'
              }`}
            >
              All Career Bands
            </div>
            <div className="mt-1 text-xl font-bold">{designations.length}</div>
          </button>

          {CAREER_LEVEL_BANDS.map((band, idx) => {
            const count = levelCounts.get(band.level) ?? 0;
            const isSelected = selectedLevelFilter === band.level;
            return (
              <button
                key={band.level}
                type="button"
                onClick={() => setSelectedLevelFilter(isSelected ? null : band.level)}
                style={{ animationDelay: `${(idx + 1) * 45}ms` }}
                className={`animate-crm-fade-up p-3 rounded-card border text-left transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? 'bg-primary-soft/60 border-primary-strong shadow-raised ring-2 ring-primary/20'
                    : 'bg-surface border-border hover:border-primary-strong/40 hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-text-muted truncate">
                    {band.label}
                  </span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${band.barClass}`} />
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xl font-bold text-text">{count}</span>
                  <span className="text-[11px] text-text-subtle">roles</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Controls */}
      <DesignationFilters
        search={search}
        departmentId={departmentFilter}
        statusFilter={statusFilter}
        departments={departments}
        onSearchChange={setSearch}
        onDepartmentChange={setDepartmentFilter}
        onStatusChange={setStatusFilter}
        onReset={() => {
          setSelectedLevelFilter(null);
          resetFilters();
        }}
      />

      {/* Error State */}
      {error && !isLoading && (
        <div data-testid="designation-error-view">
          <ErrorState
            title="Failed to Load Designations"
            message={error.message || 'An unexpected error occurred.'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div data-testid="designation-loading-skeleton" className="space-y-3">
          <div className="block sm:hidden space-y-3">
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
          </div>
          <div className="hidden sm:block space-y-2">
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && visibleDesignations.length === 0 && (
        <EmptyState
          title="No designations found"
          description={
            search || departmentFilter || statusFilter || selectedLevelFilter !== null
              ? 'No designations match your filter criteria. Try clearing filters.'
              : 'There are no designation records yet. Click "Add Designation" to create one.'
          }
          actionLabel={
            search || departmentFilter || statusFilter || selectedLevelFilter !== null
              ? 'Clear Filters'
              : canCreate
                ? 'Add Designation'
                : undefined
          }
          onAction={
            search || departmentFilter || statusFilter || selectedLevelFilter !== null
              ? () => {
                  setSelectedLevelFilter(null);
                  resetFilters();
                }
              : canCreate
                ? openCreate
                : undefined
          }
        />
      )}

      {/* Interactive Designation Cards Grid */}
      {!isLoading && !error && visibleDesignations.length > 0 && (
        <div
          className={
            viewMode === 'table'
              ? 'block sm:hidden space-y-3'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          }
          data-testid="designation-mobile-cards"
        >
          {visibleDesignations.map((desig, idx) => (
            <DesignationCard
              key={desig.id}
              designation={desig}
              departmentMap={departmentMap}
              canEdit={canEdit}
              canDeactivate={canDeactivate}
              onView={openDetail}
              onEdit={openEdit}
              onDeactivate={openDeactivate}
              holders={holdersByDesignation.get(desig.id) ?? []}
              animationIndex={idx}
            />
          ))}

          {meta.totalPages > 1 && (
            <div className="col-span-full flex items-center justify-between pt-2 sm:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage(meta.page - 1)}
                className="min-h-[44px]"
              >
                Previous
              </Button>
              <span className="text-xs text-text-muted">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage(meta.page + 1)}
                className="min-h-[44px]"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Desktop / Tablet Data Table (>=640px) */}
      {!isLoading && !error && visibleDesignations.length > 0 && viewMode !== 'cards' && (
        <div className="hidden sm:block animate-crm-fade-up">
          <DataTable
            data={visibleDesignations as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            keyExtractor={(row) => (row as unknown as Designation).id}
            isLoading={isLoading}
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={setPage}
            sortKey={sortBy}
            sortDirection={sortOrder}
            onSortChange={handleSortChange}
            ariaLabel="Organizational designations table"
            emptyTitle="No designations found"
            emptyMessage="There are no designation records to display."
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <DesignationModal
        isOpen={isModalOpen}
        designation={selectedDesignation}
        departments={departments}
        isSubmitting={isSubmitting}
        serverError={modalServerError}
        onClose={closeModal}
        onSubmit={handleSave}
      />

      {/* Slide-Over Details Drawer */}
      <DesignationDetailModal
        isOpen={isDetailOpen}
        designation={detailDesignation}
        departmentMap={departmentMap}
        onClose={closeDetail}
        holders={detailDesignation ? (holdersByDesignation.get(detailDesignation.id) ?? []) : []}
      />

      {/* Deactivate Dialog */}
      <DesignationDeactivateDialog
        isOpen={isDeactivateOpen}
        designation={deactivatingDesignation}
        isDeactivating={isDeactivating}
        serverError={deactivateServerError}
        onClose={closeDeactivate}
        onConfirm={confirmDeactivate}
      />
    </PageContainer>
  );
}

export default DesignationsPage;
