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
import { fetchDesignations } from '../../designations/api/designationsApi';
import type { Designation } from '../../designations/types';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { DepartmentCard } from '../components/DepartmentCard';
import { DepartmentDeactivateDialog } from '../components/DepartmentDeactivateDialog';
import { DepartmentDetailModal } from '../components/DepartmentDetailModal';
import { DepartmentFilters } from '../components/DepartmentFilters';
import { DepartmentModal } from '../components/DepartmentModal';
import { useDepartments } from '../hooks/useDepartments';
import type { Department } from '../types';

type DeptViewMode = 'all' | 'cards' | 'table';

export function DepartmentsPage() {
  const { role } = useAuth();

  const canCreate = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canEdit = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canDeactivate = role === ROLES.ADMIN;

  const [viewMode, setViewMode] = useState<DeptViewMode>('all');
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchEmployeeDirectory({ page: 1, pageSize: 100 }),
      fetchDesignations({ pageSize: 100 }),
    ]).then(([empRes, desigRes]) => {
      if (cancelled) return;
      if (empRes.status === 'fulfilled') setEmployees(empRes.value.data ?? []);
      if (desigRes.status === 'fulfilled') setDesignations(desigRes.value.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const membersByDept = useMemo(() => {
    const map = new Map<string, EmployeeDirectoryItem[]>();
    for (const emp of employees) {
      const deptId = emp.department?.id;
      if (!deptId) continue;
      const list = map.get(deptId) ?? [];
      list.push(emp);
      map.set(deptId, list);
    }
    return map;
  }, [employees]);

  const designationsByDept = useMemo(() => {
    const map = new Map<string, Designation[]>();
    for (const d of designations) {
      const list = map.get(d.departmentId) ?? [];
      list.push(d);
      map.set(d.departmentId, list);
    }
    return map;
  }, [designations]);

  const overviewStats = useMemo(() => {
    const activeDepts = departments.filter((d) => d.isActive).length;
    const totalStaff = employees.length;
    const onboardingCount = employees.filter((e) => e.status === 'pending').length;
    let topDept: Department | null = null;
    let topCount = -1;
    for (const d of departments) {
      const cnt = (membersByDept.get(d.id) ?? []).length;
      if (cnt > topCount) {
        topCount = cnt;
        topDept = d;
      }
    }
    return { activeDepts, totalStaff, onboardingCount, topDept, topCount: Math.max(0, topCount) };
  }, [departments, employees, membersByDept]);

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
      key: 'headcount',
      header: 'Headcount',
      priority: 'medium',
      render: (row) => {
        const list = membersByDept.get(row.id) ?? [];
        const rolesCount = (designationsByDept.get(row.id) ?? []).length;
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-text">{list.length} staff</span>
            <span className="text-text-subtle">&middot;</span>
            <span className="text-text-muted">{rolesCount} roles</span>
          </div>
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

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Interactive View Switcher */}
          <div
            className="hidden sm:inline-flex items-center p-1 rounded-tile bg-surface-muted border border-border"
            role="group"
            aria-label="Department view mode"
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
              data-testid="add-department-btn"
            >
              Add Department
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Division Overview Strip */}
      {!isLoading && !error && departments.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="animate-crm-fade-up p-3.5 rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:border-primary-strong/40">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              Active Divisions
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text">{overviewStats.activeDepts}</span>
              <span className="text-xs text-text-muted">of {departments.length} shown</span>
            </div>
          </div>

          <div
            className="animate-crm-fade-up p-3.5 rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:border-primary-strong/40"
            style={{ animationDelay: '50ms' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              Workforce Aligned
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text">{overviewStats.totalStaff}</span>
              <span className="text-xs text-text-muted">
                {overviewStats.onboardingCount > 0
                  ? `${overviewStats.onboardingCount} onboarding`
                  : 'employees'}
              </span>
            </div>
          </div>

          <div
            className="animate-crm-fade-up p-3.5 rounded-card bg-surface border border-border shadow-card transition-all duration-300 hover:border-primary-strong/40"
            style={{ animationDelay: '100ms' }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              Mapped Designations
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text">{designations.length}</span>
              <span className="text-xs text-text-muted">role tiers</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => overviewStats.topDept && openDetail(overviewStats.topDept)}
            disabled={!overviewStats.topDept}
            style={{ animationDelay: '150ms' }}
            className="animate-crm-fade-up p-3.5 rounded-card bg-surface border border-border shadow-card text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary-strong/40 hover:shadow-raised cursor-pointer"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
              Largest Division
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-base font-bold text-primary-deep truncate">
                {overviewStats.topDept?.name ?? '—'}
              </span>
              <span className="text-xs font-semibold text-text-muted shrink-0">
                {overviewStats.topCount} staff &rarr;
              </span>
            </div>
          </button>
        </div>
      )}

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

      {/* Interactive Division Cards Grid (Mobile always + Desktop when viewMode !== 'table') */}
      {!isLoading && !error && departments.length > 0 && (
        <div
          className={
            viewMode === 'table'
              ? 'block sm:hidden space-y-3'
              : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          }
          data-testid="department-mobile-cards"
        >
          {departments.map((dept, index) => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              canEdit={canEdit}
              canDeactivate={canDeactivate}
              onView={openDetail}
              onEdit={openEdit}
              onDeactivate={openDeactivate}
              members={membersByDept.get(dept.id) ?? []}
              designations={designationsByDept.get(dept.id) ?? []}
              totalWorkforce={employees.length}
              animationIndex={index}
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

      {/* Desktop / Tablet Data Table (>=640px when viewMode !== 'cards') */}
      {!isLoading && !error && departments.length > 0 && viewMode !== 'cards' && (
        <div className="hidden sm:block animate-crm-fade-up">
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

      {/* Slide-Over Details Drawer */}
      <DepartmentDetailModal
        isOpen={isDetailOpen}
        department={detailDepartment}
        onClose={closeDetail}
        members={detailDepartment ? (membersByDept.get(detailDepartment.id) ?? []) : []}
        designations={detailDepartment ? (designationsByDept.get(detailDepartment.id) ?? []) : []}
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
