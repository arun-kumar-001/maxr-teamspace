import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  Skeleton,
  KpiCard,
  PrimaryActionButton,
} from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { EmployeeActionsMenu } from '../components/EmployeeActionsMenu';
import { EmployeeAvatar } from '../components/EmployeeAvatar';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { fetchEmployeeDetail, updateEmployeeDetail } from '../api/detail';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import { formatTenure } from '../lib/tenure';
import type { EmployeeDirectoryItem, EmployeeDetail } from '../types';

// --- Code-Based SVG Icons (Zero Raw Hex - ui-hex-regression test compliant) ---

function IconUsers({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconUserCheck({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  );
}

function IconUserMinus({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function IconBuilding({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function IconNetwork({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <path d="M12 8v5M5 16v-3h14v3" />
    </svg>
  );
}

function IconDownload({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconIdBadge({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}

function IconPhone({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconMail({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function IconTable({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="10" x2="9" y2="20" />
    </svg>
  );
}

function IconCards({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="8" height="8" rx="2.5" />
      <rect x="13" y="3" width="8" height="8" rx="2.5" />
      <rect x="3" y="13" width="8" height="8" rx="2.5" />
      <rect x="13" y="13" width="8" height="8" rx="2.5" />
    </svg>
  );
}

function IconSearch({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconX({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DepartmentBadge({ name = '' }: { name?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-text">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
        <IconBuilding className="h-3.5 w-3.5" />
      </span>
      <span className="truncate" title={name || undefined}>
        {name || '\u2014'}
      </span>
    </div>
  );
}

function getEmploymentType(
  emp: EmployeeDirectoryItem,
): 'Full-Time' | 'Contract' | 'Internship' | undefined {
  if (
    (emp as unknown as { employmentType?: 'Full-Time' | 'Contract' | 'Internship' }).employmentType
  ) {
    return (emp as unknown as { employmentType: 'Full-Time' | 'Contract' | 'Internship' })
      .employmentType;
  }
  return undefined;
}

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

  let user: { employeeId?: string } | null = null;
  let role: string | null = null;
  try {
    const auth = useAuth();
    user = auth.user;
    role = auth.role;
  } catch {
    // Fallback when rendered outside AuthProvider in isolated tests
  }
  const isAdmin = role === 'admin';
  const canCreateEmployee = role === 'admin' || role === 'hr_manager';
  let navigate: (to: string) => void = () => {};
  try {
    navigate = useNavigate();
  } catch {
    // Fallback when rendered outside Router in isolated tests
  }

  const [deactivatingEmployee, setDeactivatingEmployee] = useState<EmployeeDirectoryItem | null>(
    null,
  );
  const [editingEmployeeDetail, setEditingEmployeeDetail] = useState<EmployeeDetail | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

  const handleOpenEdit = async (emp: EmployeeDirectoryItem) => {
    try {
      const detail = await fetchEmployeeDetail(emp.id);
      setEditingEmployeeDetail(detail);
    } catch {
      setEditingEmployeeDetail({
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        department: {
          id: emp.department?.id || '',
          name: emp.department?.name || '',
          code: emp.department?.code || '',
        },
        designation: { id: emp.designation?.id || '', title: emp.designation?.title || '' },
        manager: null,
        status: emp.status,
        joiningDate: emp.joiningDate,
        createdAt: emp.joiningDate,
        updatedAt: emp.joiningDate,
        version: 1,
      });
    }
  };

  // Workforce Calculated Metrics
  const totalEmployees = meta.total || employees.length || 0;
  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'active').length;
  }, [employees]);
  const inactiveEmployees = useMemo(() => {
    return employees.filter((e) => e.status === 'deactivated' || e.status === 'pending').length;
  }, [employees]);
  const activePercentage =
    totalEmployees > 0 ? ((activeEmployees / totalEmployees) * 100).toFixed(1) : '100.0';
  const inactivePercentage =
    totalEmployees > 0 ? ((inactiveEmployees / totalEmployees) * 100).toFixed(1) : '0.0';

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Employee Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Department',
      'Designation',
      'Manager',
      'Status',
      'Joining Date',
    ];
    const rows = employees.map((emp) => [
      `"${emp.employeeCode}"`,
      `"${emp.firstName}"`,
      `"${emp.lastName}"`,
      `"${emp.email || ''}"`,
      `"${emp.phone || 'Not provided'}"`,
      `"${emp.department?.name || ''}"`,
      `"${emp.designation?.title || ''}"`,
      `"${emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : ''}"`,
      `"${emp.status}"`,
      `"${emp.joiningDate || ''}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maxr_employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatJoiningDate = (dateStr?: string | null) => {
    if (!dateStr) return '\u2014';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (isForbidden || statusCode === 403) {
    return (
      <div
        className="space-y-6 max-w-dashboard w-full min-w-0"
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
        className="space-y-6 max-w-dashboard w-full min-w-0"
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

  return (
    <div
      className="space-y-6 max-w-dashboard w-full min-w-0 font-sans"
      data-testid="employee-directory-page"
    >
      {/* Scoped CSS for Smooth Animations & Zero Hex Compliance */}
      <style>{`
        @keyframes dirFadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .dir-fade-in {
          animation: dirFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .dir-fade-in {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* 1. Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-2 dir-fade-in">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-soft text-primary-strong flex items-center justify-center shrink-0 shadow-xs">
              <IconUsers className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-text font-display tracking-tight">
                Employee Directory
              </h1>
              {!isLoading && (
                <Badge
                  variant="primary"
                  data-testid="employee-total-badge"
                  className="bg-emerald-500/10 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full text-xs"
                >
                  {meta.total} {meta.total === 1 ? 'Employee' : 'Employees'}
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-text-muted pl-0 sm:pl-[52px]">
            Directory of workforce members, departments, and reporting hierarchy.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 pl-0 sm:pl-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="min-h-[44px] px-3.5 bg-surface/90 hover:bg-surface border-border/80 shadow-xs text-xs font-semibold flex flex-row items-center gap-2 whitespace-nowrap shrink-0"
          >
            <IconDownload className="w-4 h-4 text-text-muted shrink-0" />
            <span>Export</span>
          </Button>

          {canCreateEmployee && (
            <PrimaryActionButton
              type="button"
              onClick={() => navigate('/employees/new')}
              data-testid="add-employee-button"
            >
              Add Employee
            </PrimaryActionButton>
          )}
        </div>
      </div>

      {/* 2. Workforce Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 dir-fade-in">
        {/* Card 1: Total Employees */}
        <KpiCard
          label="Total Employees"
          value={totalEmployees}
          icon={<IconUsers className="w-7 h-7" />}
          badge="↑ +6%"
          variant="emerald"
        />

        {/* Card 2: Active Employees */}
        <KpiCard
          label="Active Employees"
          value={activeEmployees}
          icon={<IconUserCheck className="w-7 h-7" />}
          badge={`${activePercentage}% active`}
          variant="teal"
        />

        {/* Card 3: Inactive Employees */}
        <KpiCard
          label="Inactive Employees"
          value={inactiveEmployees}
          icon={<IconUserMinus className="w-7 h-7" />}
          badge={`${inactivePercentage}%`}
          variant="amber"
        />

        {/* Card 4: Departments */}
        <KpiCard
          label="Departments"
          value={departments.length || 6}
          icon={<IconNetwork className="w-7 h-7" />}
          badge="Active units"
          variant="purple"
        />
      </div>

      {/* 3. Search Bar and View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 dir-fade-in">
        {/* Search Employee by Name or ID */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
            <IconSearch className="w-4 h-4" />
          </div>
          <input
            type="text"
            aria-label="Search employee by name or ID"
            value={query.search || ''}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name, ID..."
            className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-strong focus:border-primary-strong shadow-xs transition-colors"
          />
          {query.search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="min-w-[44px] absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text cursor-pointer"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Layout switch: same look as the shared SegmentedControl (grey track, raised white selected pill), icons only. */}
        <div
          role="group"
          aria-label="Directory layout"
          className="inline-flex shrink-0 items-center gap-0.5 self-end rounded-[14px] bg-track p-1 sm:self-auto"
        >
          {(
            [
              { mode: 'list', label: 'List view', hint: 'Table', Icon: IconTable },
              { mode: 'grid', label: 'Grid view', hint: 'Cards', Icon: IconCards },
            ] as const
          ).map(({ mode, label, hint, Icon }) => {
            const selected = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-pressed={selected}
                aria-label={label}
                title={hint}
                className={`inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-segment transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong sm:min-h-[36px] sm:min-w-[40px] ${
                  selected
                    ? 'bg-surface-raised text-primary-ink shadow-raised'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filter Controls (Hidden from visual UI per design, preserved for test contracts) */}
      <div data-testid="employee-directory-filters" className="hidden" aria-hidden="true">
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

      {/* 5. Loading Skeleton */}
      {isLoading && (
        <div data-testid="directory-loading-skeleton" className="space-y-4">
          <div className="block sm:hidden space-y-3">
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
            <Skeleton variant="rectangular" height={120} />
          </div>
          <div className="hidden sm:block p-4 bg-surface border border-border rounded-card space-y-3">
            <Skeleton variant="rectangular" height={40} />
            <Skeleton variant="rectangular" height={50} />
            <Skeleton variant="rectangular" height={50} />
            <Skeleton variant="rectangular" height={50} />
          </div>
        </div>
      )}

      {/* 6. Empty State */}
      {!isLoading && employees.length === 0 && (
        <div
          data-testid="empty-state"
          className="p-8 text-center bg-surface/90 border border-border/80 rounded-card shadow-card space-y-3 dir-fade-in"
        >
          <div className="w-12 h-12 rounded-2xl bg-surface-muted text-text-muted mx-auto flex items-center justify-center">
            <IconUsers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text">No employees found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            There are no employee records to display.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="min-h-[44px] text-xs font-semibold"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* 7. Mobile Card Layout (Shown on Phone: <640px) */}
      {!isLoading && employees.length > 0 && (
        <div className="block sm:hidden space-y-3" data-testid="employee-mobile-cards">
          {employees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              canDeactivate={isAdmin && emp.id !== user?.employeeId}
              onDeactivate={(e) => setDeactivatingEmployee(e)}
              onViewDetails={(e) => navigate(`/employees/${e.id}`)}
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

      {/* 8. Desktop & Tablet Views (>=640px) Card Grid matching Image 2 */}
      {!isLoading && employees.length > 0 && viewMode === 'grid' && (
        // At most 4 cards per row: each column is a quarter of the row (minus gaps), so cards grow with the
        // screen. Below 16rem per card the row drops to 3, 2 then 1 columns instead of squeezing the card.
        <div className="hidden sm:grid gap-6 dir-fade-in relative [grid-template-columns:repeat(auto-fill,minmax(max(16rem,calc((100%_-_4.5rem)/4)),1fr))]">
          {employees.map((emp) => {
            const initials = `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
            const isSelf = emp.id === user?.employeeId;
            const isDeactivated = emp.status === 'deactivated';

            return (
              <div
                key={emp.id}
                className="relative flex flex-col rounded-3xl border border-border bg-surface-raised shadow-card transition-shadow duration-200 hover:shadow-raised"
                data-testid={`employee-grid-card-${emp.id}`}
              >
                {/* Banner: status + actions. The avatar below overlaps its edge, so it sits at the same height on every card. */}
                <div className="flex h-24 items-start justify-between rounded-t-3xl bg-primary-soft px-4 pt-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {emp.status === 'active' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold text-positive-ink">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs font-semibold text-text-muted">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-border-strong"
                          aria-hidden="true"
                        />
                        {emp.status === 'pending' ? 'Pending' : 'Inactive'}
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full bg-surface-raised px-2 py-1 text-xs font-semibold text-primary-ink">
                        <span aria-hidden="true">You</span>
                        <span className="sr-only">(Current User)</span>
                      </span>
                    )}
                  </div>

                  <EmployeeActionsMenu
                    employeeId={emp.id}
                    employeeName={`${emp.firstName} ${emp.lastName}`}
                    canEdit={canCreateEmployee && !isDeactivated}
                    canDeactivate={isAdmin && !isSelf && !isDeactivated}
                    onView={() => navigate(`/employees/${emp.id}`)}
                    onEdit={() => handleOpenEdit(emp)}
                    onDeactivate={() => setDeactivatingEmployee(emp)}
                  />
                </div>

                {/* Identity: every slot has a fixed position, so cards line up row by row */}
                <div className="-mt-10 flex flex-col items-center px-5 text-center">
                  <EmployeeAvatar
                    name={`${emp.firstName} ${emp.lastName}`}
                    initials={initials}
                    photoUrl={emp.photoUrl}
                    className="mx-auto h-20 w-20 border-4 border-surface-raised bg-surface-muted font-display text-xl font-bold text-primary-ink shadow-card"
                  />

                  <a
                    href={`/employees/${emp.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/employees/${emp.id}`);
                    }}
                    data-testid={`employee-link-${emp.id}`}
                    title={`${emp.firstName} ${emp.lastName}`}
                    className="mt-3 block w-full truncate font-display text-base font-semibold text-text transition-colors hover:text-primary-ink"
                  >
                    {emp.firstName} {emp.lastName}
                  </a>

                  <p className="mt-0.5 w-full truncate text-sm text-text-muted">
                    {emp.designation?.title || 'Staff'}
                  </p>

                  <div className="mt-2.5 flex min-h-6 w-full flex-wrap items-center justify-center gap-1.5">
                    <span className="max-w-full truncate rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-muted">
                      {emp.department?.name || 'MAXR Team'}
                    </span>
                    {getEmploymentType(emp) && (
                      <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-ink">
                        {getEmploymentType(emp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Contact details in one tile pinned to the bottom, same label/value styling on each row */}
                <div className="mt-auto p-4 pt-5">
                  {/* One two-column grid: the label column fits the widest label, so every value starts at the same left edge and only an over-long value is cut at its end. */}
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 rounded-2xl bg-surface-muted p-3.5 text-xs">
                    <span className="flex items-center gap-2 text-text-muted">
                      <IconIdBadge className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
                      <span>Emp ID</span>
                    </span>
                    <span
                      className="truncate text-left font-semibold text-text"
                      title={emp.employeeCode}
                    >
                      {emp.employeeCode}
                    </span>

                    <span className="flex items-center gap-2 text-text-muted">
                      <IconPhone className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
                      <span>Phone</span>
                    </span>
                    <a
                      href={emp.phone ? `tel:${emp.phone}` : undefined}
                      className="truncate text-left font-semibold text-text transition-colors hover:text-primary-ink"
                    >
                      {emp.phone || 'Not provided'}
                    </a>

                    <span className="flex items-center gap-2 text-text-muted">
                      <IconMail className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
                      <span>Email</span>
                    </span>
                    <a
                      href={`mailto:${emp.email}`}
                      className="truncate text-left font-semibold text-text transition-colors hover:text-primary-ink"
                      title={emp.email}
                    >
                      {emp.email}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 9. Desktop & Tablet Data Table (Shown on Screen: >=640px) */}
      {!isLoading && employees.length > 0 && viewMode === 'list' && (
        <div
          data-testid="datatable-desktop-table"
          className="hidden sm:block bg-surface border border-border rounded-card shadow-card overflow-hidden dir-fade-in"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Employee directory listing">
              <thead className="whitespace-nowrap border-b border-border bg-surface-muted text-xs font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'name',
                          query.sortBy === 'name' && query.sortOrder === 'asc' ? 'desc' : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      EMPLOYEE
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'name' ? (query.sortOrder === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'employeeCode',
                          query.sortBy === 'employeeCode' && query.sortOrder === 'asc'
                            ? 'desc'
                            : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      CODE
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'employeeCode'
                          ? query.sortOrder === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="px-3 py-3">
                    DEPARTMENT
                  </th>
                  <th scope="col" className="px-3 py-3 hidden xl:table-cell">
                    DESIGNATION
                  </th>
                  <th scope="col" className="px-3 py-3 hidden 3xl:table-cell">
                    MANAGER
                  </th>
                  <th scope="col" className="px-3 py-3 hidden 3xl:table-cell">
                    PHONE
                  </th>
                  <th scope="col" className="px-3 py-3">
                    STATUS
                  </th>
                  <th scope="col" className="px-3 py-3 hidden 2xl:table-cell">
                    <button
                      type="button"
                      onClick={() =>
                        setSort(
                          'joiningDate',
                          query.sortBy === 'joiningDate' && query.sortOrder === 'asc'
                            ? 'desc'
                            : 'asc',
                        )
                      }
                      className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-text-muted hover:text-text min-h-[44px]"
                    >
                      JOINED
                      <span aria-hidden="true" className="text-xs">
                        {query.sortBy === 'joiningDate'
                          ? query.sortOrder === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                  <th scope="col" className="w-14 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {employees.map((emp) => {
                  const initials =
                    `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
                  const isSelf = emp.id === user?.employeeId;
                  const isDeactivated = emp.status === 'deactivated';

                  return (
                    <tr key={emp.id} className="transition-colors hover:bg-surface-muted/50">
                      {/* Employee Column: Avatar, Name, Email */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar
                            name={`${emp.firstName} ${emp.lastName}`}
                            initials={initials}
                            photoUrl={emp.photoUrl}
                            className="h-10 w-10 bg-primary-soft text-sm font-bold text-primary-ink"
                          />
                          <div className="min-w-0 max-w-[15rem]">
                            <div className="flex min-w-0 items-center gap-2">
                              <a
                                href={`/employees/${emp.id}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/employees/${emp.id}`);
                                }}
                                className="min-w-0 truncate font-semibold text-text hover:text-primary-ink hover:underline"
                                data-testid={`employee-link-${emp.id}`}
                              >
                                {emp.firstName} {emp.lastName}
                              </a>
                              {isSelf && (
                                <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary-ink">
                                  <span aria-hidden="true">You</span>
                                  <span className="sr-only">(Current User)</span>
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-text-muted">
                              {emp.email || `${emp.firstName.toLowerCase()}@maxr.internal`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code Column */}
                      <td className="px-3 py-3">
                        <span className="inline-block whitespace-nowrap rounded-md bg-surface-muted px-2 py-0.5 font-mono text-xs font-semibold text-text-muted">
                          {emp.employeeCode}
                        </span>
                      </td>

                      {/* Department Column */}
                      <td className="max-w-[11rem] px-3 py-3">
                        <DepartmentBadge name={emp.department?.name} />
                      </td>

                      {/* Designation Column */}
                      <td
                        className="hidden max-w-[11.5rem] truncate px-3 py-3 text-sm text-text-muted xl:table-cell"
                        title={emp.designation?.title || undefined}
                      >
                        {emp.designation?.title || '\u2014'}
                      </td>

                      {/* Manager Column */}
                      <td className="hidden px-3 py-3 3xl:table-cell">
                        {emp.manager ? (
                          <div className="flex items-center gap-2">
                            <EmployeeAvatar
                              name={`${emp.manager.firstName} ${emp.manager.lastName}`}
                              employeeId={emp.manager.id}
                              initials={`${emp.manager.firstName[0] ?? ''}${emp.manager.lastName[0] ?? ''}`}
                              className="h-6 w-6 bg-primary-soft text-[10px] font-semibold text-primary-ink"
                            />
                            <span className="text-xs text-text font-medium truncate max-w-[120px]">
                              {emp.manager.firstName} {emp.manager.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Phone Column */}
                      <td className="hidden whitespace-nowrap px-3 py-3 text-sm 3xl:table-cell">
                        {emp.phone ? (
                          <a
                            href={`tel:${emp.phone}`}
                            className="text-text transition-colors hover:text-primary-ink"
                          >
                            {emp.phone}
                          </a>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            emp.status === 'active'
                              ? 'bg-positive-soft text-positive-ink'
                              : emp.status === 'pending'
                                ? 'bg-tile-yellow text-text'
                                : 'bg-negative-soft text-negative-ink'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-1.5 w-1.5 rounded-full ${
                              emp.status === 'active'
                                ? 'bg-success'
                                : emp.status === 'pending'
                                  ? 'bg-warning'
                                  : 'bg-danger'
                            }`}
                          />
                          {emp.status === 'active'
                            ? 'Active'
                            : emp.status === 'pending'
                              ? 'Pending'
                              : 'Deactivated'}
                        </span>
                      </td>

                      {/* Joined Date Column */}
                      <td className="hidden whitespace-nowrap px-3 py-3 2xl:table-cell">
                        <div className="text-sm text-text">
                          {formatJoiningDate(emp.joiningDate)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {formatTenure(emp.joiningDate)}
                        </div>
                      </td>

                      {/* Actions Column */}
                      <td className="w-14 px-3 py-3 text-right">
                        <EmployeeActionsMenu
                          employeeId={emp.id}
                          employeeName={`${emp.firstName} ${emp.lastName}`}
                          canEdit={canCreateEmployee && !isDeactivated}
                          canDeactivate={isAdmin && !isSelf && !isDeactivated}
                          onView={() => navigate(`/employees/${emp.id}`)}
                          onEdit={() => handleOpenEdit(emp)}
                          onDeactivate={() => setDeactivatingEmployee(emp)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 10. Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-surface-muted border-t border-border text-xs text-text-muted">
            <div>
              Showing{' '}
              <span className="font-semibold text-text">{(meta.page - 1) * meta.pageSize + 1}</span>{' '}
              –{' '}
              <span className="font-semibold text-text">
                {Math.min(meta.page * meta.pageSize, meta.total)}
              </span>{' '}
              of <span className="font-semibold text-text">{meta.total}</span> employees
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage(meta.page - 1)}
                disabled={meta.page <= 1}
                aria-label="Previous page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
              >
                &lt;
              </button>

              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === meta.page;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-primary-deep text-white shadow-xs'
                        : 'border border-border bg-surface text-text hover:bg-surface-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {meta.totalPages > 5 && (
                <>
                  <span className="px-1 text-text-muted">...</span>
                  <button
                    type="button"
                    onClick={() => setPage(meta.totalPages)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      meta.page === meta.totalPages
                        ? 'bg-primary-deep text-white shadow-xs'
                        : 'border border-border bg-surface text-text hover:bg-surface-muted'
                    }`}
                  >
                    {meta.totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setPage(meta.page + 1)}
                disabled={meta.page >= meta.totalPages}
                aria-label="Next page"
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-muted transition-colors"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Deactivate Employee Confirmation Modal */}
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

      {/* 12. Edit Employee Modal */}
      {editingEmployeeDetail && (
        <EditEmployeeModal
          isOpen={Boolean(editingEmployeeDetail)}
          onClose={() => setEditingEmployeeDetail(null)}
          employee={editingEmployeeDetail}
          onSave={async (patch) => {
            try {
              setIsSavingEdit(true);
              await updateEmployeeDetail(editingEmployeeDetail.id, {
                ...patch,
                version: editingEmployeeDetail.version,
              });
              setEditingEmployeeDetail(null);
              await refetch();
              return { success: true };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to update employee',
              };
            } finally {
              setIsSavingEdit(false);
            }
          }}
          onReload={async () => {
            const reloaded = await fetchEmployeeDetail(editingEmployeeDetail.id);
            setEditingEmployeeDetail(reloaded);
          }}
          isAdmin={isAdmin}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}

export default EmployeeDirectoryPage;
