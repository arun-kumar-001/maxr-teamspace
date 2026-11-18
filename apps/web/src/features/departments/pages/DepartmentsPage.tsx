import { useEffect, useMemo, useState } from 'react';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button, KpiCard, PrimaryActionButton } from '../../../components/ui';
import { DataTable, type Column, type SortDirection } from '../../../components/ui/DataTable';
import { PageContainer } from '../../../components/ui/PageContainer';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState, ErrorState, ForbiddenState } from '../../../components/ui/StateCards';
import { Badge } from '../../../components/ui/StatusPill';
import { Toast } from '../../../components/ui/Toast';
import { createDesignation, fetchDesignations } from '../../designations/api/designationsApi';
import type {
  Designation,
  CreateDesignationPayload,
  UpdateDesignationPayload,
} from '../../designations/types';
import { DesignationModal } from '../../designations/components/DesignationModal';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { DepartmentCard } from '../components/DepartmentCard';
import { DepartmentDeactivateDialog } from '../components/DepartmentDeactivateDialog';
import { DepartmentDetailModal } from '../components/DepartmentDetailModal';
import { DepartmentFilters } from '../components/DepartmentFilters';
import { DepartmentModal } from '../components/DepartmentModal';
import { useDepartments } from '../hooks/useDepartments';
import type { Department } from '../types';

type DeptViewMode = 'cards' | 'table';

export function DepartmentsPage() {
  const { role } = useAuth();

  const canCreate = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canEdit = role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  const canDeactivate = role === ROLES.ADMIN;

  const [viewMode, setViewMode] = useState<DeptViewMode>('cards');
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [designationDepartment, setDesignationDepartment] = useState<Department | null>(null);
  const [isSavingDesignation, setIsSavingDesignation] = useState(false);
  const [designationSaveError, setDesignationSaveError] = useState<string | null>(null);
  const designationDepartments = useMemo(
    () => (designationDepartment ? [designationDepartment] : []),
    [designationDepartment],
  );

  const saveDesignation = async (payload: CreateDesignationPayload | UpdateDesignationPayload) => {
    if (!designationDepartment || isSavingDesignation || !canCreate) return;
    setIsSavingDesignation(true);
    setDesignationSaveError(null);
    try {
      const created = await createDesignation({
        departmentId: designationDepartment.id,
        title: payload.title!,
      });
      setDesignations((current) => [...current.filter((item) => item.id !== created.id), created]);
      setDesignationDepartment(null);
    } catch (error) {
      setDesignationSaveError(
        error instanceof Error ? error.message : 'Could not create designation. Please try again.',
      );
    } finally {
      setIsSavingDesignation(false);
    }
  };

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

          {canDeactivate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => openDeactivate(row)}
              className="min-h-[44px] min-w-[44px] text-xs font-semibold text-danger hover:bg-rose-50"
              data-testid={`table-deactivate-dept-${row.id}`}
              aria-label={`Deactivate or delete department ${row.name}`}
            >
              Delete
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
                { id: 'cards', label: 'Cards' },
                { id: 'table', label: 'Table' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                className={`px-3 py-1 rounded-input text-xs font-semibold transition-all cursor-pointer ${
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
            <PrimaryActionButton
              type="button"
              onClick={openCreate}
              data-testid="add-department-btn"
            >
              Add Department
            </PrimaryActionButton>
          )}
        </div>
      </div>

      {/* Interactive Division Overview Strip (Universal KpiCard) */}
      {!isLoading && !error && departments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <KpiCard
            label="Active Divisions"
            value={overviewStats.activeDepts}
            badge={`of ${departments.length}`}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
            variant="teal"
          />

          <KpiCard
            label="Workforce Aligned"
            value={overviewStats.totalStaff}
            badge={
              overviewStats.onboardingCount > 0
                ? `${overviewStats.onboardingCount} onboarding`
                : undefined
            }
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
            variant="emerald"
          />

          <KpiCard
            label="Mapped Designations"
            value={designations.length}
            badge="Role tiers"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
            }
            variant="purple"
          />

          <KpiCard
            label="Largest Division"
            value={overviewStats.topDept?.name ?? '—'}
            badge={overviewStats.topDept ? `${overviewStats.topCount} staff` : undefined}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            }
            variant="blue"
            onClick={overviewStats.topDept ? () => openDetail(overviewStats.topDept!) : undefined}
          />
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
        isOpen={isDetailOpen && !designationDepartment}
        department={detailDepartment}
        onClose={closeDetail}
        onAddDesignation={
          canCreate && detailDepartment?.isActive
            ? () => {
                setDesignationSaveError(null);
                setDesignationDepartment(detailDepartment);
              }
            : undefined
        }
        members={detailDepartment ? (membersByDept.get(detailDepartment.id) ?? []) : []}
        designations={detailDepartment ? (designationsByDept.get(detailDepartment.id) ?? []) : []}
      />

      <DesignationModal
        isOpen={Boolean(designationDepartment)}
        designation={null}
        departments={designationDepartments}
        isSubmitting={isSavingDesignation}
        serverError={designationSaveError}
        onClose={() => {
          if (!isSavingDesignation) setDesignationDepartment(null);
        }}
        onSubmit={saveDesignation}
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
