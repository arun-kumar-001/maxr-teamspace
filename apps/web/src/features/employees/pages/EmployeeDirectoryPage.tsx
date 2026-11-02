import { useState } from 'react';
import {
  Badge,
  Button,
  Column,
  DataTable,
  ErrorState,
  ForbiddenState,
  Skeleton,
  SortDirection,
} from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import type { EmployeeDirectoryItem } from '../types';

export function EmployeeDirectoryPage() {
  const {
    employees,
    meta,
    isLoading,
    error,
    statusCode,
    isForbidden,
    departments,
    designations,
    managers,
    query,
    setPage,
    setSearch,
    setStatus,
    setDepartmentId,
    setDesignationId,
    setManagerId,
    setSort,
    resetFilters,
    refetch,
  } = useEmployeeDirectory();

  let user = null;
  let role = null;
  try {
    const auth = useAuth();
    user = auth.user;
    role = auth.role;
  } catch {
    // Fallback when rendered outside AuthProvider in isolated tests
  }
  const isAdmin = role === 'admin';
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<EmployeeDirectoryItem | null>(
    null,
  );

  if (isForbidden || statusCode === 403) {
    return (
      <div
        className="p-4 sm:p-6 space-y-6 max-w-dashboard mx-auto"
        data-testid="employee-directory-page"
      >
        <div data-testid="directory-forbidden-view">
          <ForbiddenState
            title="Access Restricted"
            message="You do not have permission to access the employee directory."
          />
        </div>
      </div>
    );
  }

  if (error && !isLoading && employees.length === 0) {
    return (
      <div
        className="p-4 sm:p-6 space-y-6 max-w-dashboard mx-auto"
        data-testid="employee-directory-page"
      >
        <div data-testid="directory-error-view">
          <ErrorState
            title="Failed to Load Employees"
            message={error.message || String(error)}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  const columns: Column<EmployeeDirectoryItem>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      priority: 'high',
      render: (emp) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center font-bold text-xs shrink-0">
            {emp.firstName.charAt(0)}
            {emp.lastName.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-text">
              {emp.firstName} {emp.lastName}
            </div>
            <div className="text-xs font-mono text-text-muted">{emp.employeeCode}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeCode',
      header: 'Code',
      sortable: true,
      priority: 'medium',
      render: (emp) => (
        <span className="font-mono text-xs text-text-muted font-medium">{emp.employeeCode}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      priority: 'high',
      render: (emp) => (
        <div className="text-text font-medium text-xs sm:text-sm">
          {emp.department?.name || '\u2014'}
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation',
      priority: 'medium',
      render: (emp) => (
        <div className="text-text-muted text-xs sm:text-sm">
          {emp.designation?.title || '\u2014'}
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      priority: 'low',
      render: (emp) => (
        <span className="text-xs text-text-muted">
          {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '\u2014'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'high',
      render: (emp) => {
        switch (emp.status) {
          case 'active':
            return <Badge variant="success">Active</Badge>;
          case 'pending':
            return <Badge variant="warning">Pending</Badge>;
          case 'deactivated':
            return <Badge variant="neutral">Deactivated</Badge>;
          default:
            return <Badge variant="neutral">{emp.status}</Badge>;
        }
      },
    },
    {
      key: 'joiningDate',
      header: 'Joined',
      sortable: true,
      priority: 'low',
      render: (emp) => (
        <span className="text-xs text-text-muted">{emp.joiningDate || '\u2014'}</span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions' as keyof EmployeeDirectoryItem,
            header: 'Actions',
            priority: 'high' as const,
            render: (emp: EmployeeDirectoryItem) => {
              if (emp.status === 'deactivated') {
                return <span className="text-xs text-text-subtle font-mono">Deactivated</span>;
              }
              if (emp.id === user?.employeeId) {
                return <span className="text-xs text-text-subtle font-medium">(Current User)</span>;
              }
              return (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeactivatingEmployee(emp)}
                  data-testid={`deactivate-btn-table-${emp.id}`}
                  className="min-h-[36px] text-xs"
                >
                  Deactivate
                </Button>
              );
            },
          },
        ]
      : []),
  ];

  const handleSortChange = (key: string, direction: SortDirection) => {
    if (['name', 'employeeCode', 'joiningDate', 'createdAt'].includes(key)) {
      setSort(key as 'name' | 'employeeCode' | 'joiningDate' | 'createdAt', direction);
    }
  };

  return (
    <div className="space-y-6 max-w-dashboard mx-auto" data-testid="employee-directory-page">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Employee Directory
            </h1>
            {!isLoading && (
              <Badge variant="primary" data-testid="employee-total-badge">
                {meta.total} {meta.total === 1 ? 'Employee' : 'Employees'}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Directory of workforce members, departments, and reporting hierarchy
          </p>
        </div>
      </div>

      {/* Filter Controls */}
      <div data-testid="employee-directory-filters">
        <EmployeeFilters
          search={query.search}
          status={query.status}
          departmentId={query.departmentId}
          designationId={query.designationId}
          managerId={query.managerId}
          departments={departments}
          designations={designations}
          managers={managers}
          onSearchChange={setSearch}
          onStatusChange={setStatus}
          onDepartmentChange={setDepartmentId}
          onDesignationChange={setDesignationId}
          onManagerChange={setManagerId}
          onReset={resetFilters}
        />
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div data-testid="directory-loading-skeleton">
          <div className="block sm:hidden space-y-3">
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
          </div>
        </div>
      )}

      {/* Mobile Card Layout (Shown on Phone: <640px) */}
      {!isLoading && employees.length > 0 && (
        <div className="block sm:hidden space-y-3" data-testid="employee-mobile-cards">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canDeactivate={isAdmin && emp.id !== user?.employeeId}
              onDeactivate={(e) => setDeactivatingEmployee(e)}
            />
          ))}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
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

      {/* Desktop & Tablet Data Table (Shown on Screen: >=640px) */}
      <DataTable
        className={employees.length > 0 ? 'hidden sm:flex' : ''}
        data={employees as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        keyExtractor={(row) => (row as unknown as EmployeeDirectoryItem).id}
        isLoading={isLoading}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        onPageChange={setPage}
        sortKey={query.sortBy}
        sortDirection={query.sortOrder ?? 'asc'}
        onSortChange={handleSortChange}
        ariaLabel="Employee directory listing"
        emptyTitle="No employees found"
        emptyMessage="There are no employee records to display."
      />

      {/* Deactivate Employee Confirmation Modal (Issue #26) */}
      {deactivatingEmployee && (
        <DeactivateEmployeeModal
          isOpen={true}
          onClose={() => setDeactivatingEmployee(null)}
          employee={deactivatingEmployee}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
}
export default EmployeeDirectoryPage;
