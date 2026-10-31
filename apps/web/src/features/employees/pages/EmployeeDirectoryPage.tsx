import {
  Badge,
  Column,
  DataTable,
  ErrorState,
  ForbiddenState,
  SortDirection,
} from '../../../components/ui';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import type { EmployeeDirectoryItem } from '../types';

export function EmployeeDirectoryPage() {
  const {
    employees,
    meta,
    isLoading,
    error,
    statusCode,
    departments,
    designations,
    query,
    setPage,
    setSearch,
    setStatus,
    setDepartmentId,
    setDesignationId,
    setSort,
    resetFilters,
    refetch,
  } = useEmployeeDirectory();

  if (statusCode === 403) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="employee-directory-page">
        <ForbiddenState
          title="Access Restricted"
          message="You do not have permission to access the employee directory."
        />
      </div>
    );
  }

  if (error && !isLoading && employees.length === 0) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="employee-directory-page">
        <ErrorState title="Failed to Load Employees" message={error} onRetry={refetch} />
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
            <div className="text-xs text-text-muted">{emp.email}</div>
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
  ];

  const handleSortChange = (key: string, direction: SortDirection) => {
    if (['name', 'employeeCode', 'joiningDate', 'createdAt'].includes(key)) {
      setSort(key as 'name' | 'employeeCode' | 'joiningDate' | 'createdAt', direction);
    }
  };

  return (
    <div className="space-y-6" data-testid="employee-directory-page">
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
      <EmployeeFilters
        search={query.search}
        status={query.status}
        departmentId={query.departmentId}
        designationId={query.designationId}
        departments={departments}
        designations={designations}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
        onDepartmentChange={setDepartmentId}
        onDesignationChange={setDesignationId}
        onReset={resetFilters}
      />

      {/* Data Table with Mobile Cards & Desktop Table */}
      <DataTable
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
        emptyMessage="No employees match your search query or selected filters. Try broadening your criteria."
      />
    </div>
  );
}
export default EmployeeDirectoryPage;
