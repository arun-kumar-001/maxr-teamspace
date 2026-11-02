import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import { DataTable, type Column, type SortDirection } from '../../../components/ui/DataTable';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState, ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Toast } from '../../../components/ui/Toast';
import { DepartmentFilters } from '../components/DepartmentFilters';
import { DepartmentCard } from '../components/DepartmentCard';
import { DepartmentModal } from '../components/DepartmentModal';
import { DepartmentDetailModal } from '../components/DepartmentDetailModal';
import { DepartmentDeactivateDialog } from '../components/DepartmentDeactivateDialog';
import { useDepartments } from '../hooks/useDepartments';
import type { Department } from '../types';

export function DepartmentsPage() {
  const { role } = useAuth();

  const canCreate = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canEdit = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canDeactivate = role === ROLES.ADMIN;

  const {
    departments,
    meta,
    isLoading,
    error,
    isForbidden,
    search,
    statusFilter,
    sortBy,
    sortOrder,
    setSearch,
    setStatusFilter,
    setPage,
    setSort,
    resetFilters,
    refetch,
    // Create/Edit
    isModalOpen,
    selectedDepartment,
    isSubmitting,
    modalServerError,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    // Detail
    isDetailOpen,
    detailDepartment,
    openDetail,
    closeDetail,
    // Deactivate
    isDeactivateOpen,
    deactivatingDepartment,
    isDeactivating,
    deactivateServerError,
    openDeactivate,
    closeDeactivate,
    confirmDeactivate,
    // Toast
    toast,
    dismissToast,
  } = useDepartments();

  if (isForbidden) {
    return (
      <PageContainer maxWidth="dashboard">
        <div data-testid="department-forbidden-view">
          <ForbiddenState
            title="Access Restricted"
            message="You do not have permission to manage organizational departments."
          />
        </div>
      </PageContainer>
    );
  }

  const handleSortChange = (key: string, direction: SortDirection) => {
    if (key === 'name' || key === 'code' || key === 'createdAt') {
      setSort(key, direction);
    }
  };

  const columns: Column<Department>[] = [
    {
      key: 'name',
      header: 'Department Name',
      sortable: true,
      priority: 'high',
      render: (row) => (
        <div>
          <span className="font-semibold text-text block text-sm">{row.name}</span>
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
            data-testid={`table-view-dept-${row.id}`}
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
              data-testid={`table-edit-dept-${row.id}`}
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
              data-testid={`table-deactivate-dept-${row.id}`}
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
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">Departments</h1>
            {!isLoading && (
              <Badge variant="primary" data-testid="department-total-badge">
                {meta.total} {meta.total === 1 ? 'Department' : 'Departments'}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Manage organizational divisions, functional units, and reporting structures
          </p>
        </div>

        {canCreate && (
          <Button
            type="button"
            variant="primary"
            onClick={openCreate}
            className="min-h-[44px] text-xs sm:text-sm font-semibold shrink-0"
            data-testid="add-department-btn"
          >
            Add Department
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <DepartmentFilters
        search={search}
        statusFilter={statusFilter}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onReset={resetFilters}
      />

      {/* Error State */}
      {error && !isLoading && (
        <div data-testid="department-error-view">
          <ErrorState
            title="Failed to Load Departments"
            message={error.message || 'An unexpected error occurred.'}
            onRetry={refetch}
          />
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div data-testid="department-loading-skeleton" className="space-y-3">
          <div className="block sm:hidden space-y-3">
            <Skeleton variant="rectangular" height={110} />
            <Skeleton variant="rectangular" height={110} />
            <Skeleton variant="rectangular" height={110} />
          </div>
          <div className="hidden sm:block space-y-2">
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
            <Skeleton variant="rectangular" height={48} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && departments.length === 0 && (
        <EmptyState
          title="No departments found"
          description={
            search || statusFilter
              ? 'No departments match your filter criteria. Try clearing filters.'
              : 'There are no department records yet. Click "Add Department" to create one.'
          }
          actionLabel={
            search || statusFilter ? 'Clear Filters' : canCreate ? 'Add Department' : undefined
          }
          onAction={search || statusFilter ? resetFilters : canCreate ? openCreate : undefined}
        />
      )}

      {/* Mobile Cards Layout (<640px) */}
      {!isLoading && !error && departments.length > 0 && (
        <div className="block sm:hidden space-y-3" data-testid="department-mobile-cards">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              canEdit={canEdit}
              canDeactivate={canDeactivate}
              onView={openDetail}
              onEdit={openEdit}
              onDeactivate={openDeactivate}
            />
          ))}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
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
      {!isLoading && !error && departments.length > 0 && (
        <div className="hidden sm:block">
          <DataTable
            data={departments as unknown as Record<string, unknown>[]}
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            keyExtractor={(row) => (row as unknown as Department).id}
            isLoading={isLoading}
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            onPageChange={setPage}
            sortKey={sortBy}
            sortDirection={sortOrder}
            onSortChange={handleSortChange}
            ariaLabel="Organizational departments table"
            emptyTitle="No departments found"
            emptyMessage="There are no department records to display."
          />
        </div>
      )}

      {/* Create / Edit Modal */}
      <DepartmentModal
        isOpen={isModalOpen}
        department={selectedDepartment}
        isSubmitting={isSubmitting}
        serverError={modalServerError}
        onClose={closeModal}
        onSubmit={handleSave}
      />

      {/* Details Modal */}
      <DepartmentDetailModal
        isOpen={isDetailOpen}
        department={detailDepartment}
        onClose={closeDetail}
      />

      {/* Deactivate Dialog */}
      <DepartmentDeactivateDialog
        isOpen={isDeactivateOpen}
        department={deactivatingDepartment}
        isDeactivating={isDeactivating}
        serverError={deactivateServerError}
        onClose={closeDeactivate}
        onConfirm={confirmDeactivate}
      />
    </PageContainer>
  );
}

export default DepartmentsPage;
