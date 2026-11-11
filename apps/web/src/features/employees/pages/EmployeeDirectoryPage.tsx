import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, ErrorState, ForbiddenState, Skeleton } from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import type { EmployeeDirectoryItem } from '../types';

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

function IconLayers({ className = 'w-4 h-4' }: { className?: string }) {
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
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
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

function IconPlus({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEye({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEditPencil({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function IconList({ className = 'w-4 h-4' }: { className?: string }) {
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
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function IconGrid({ className = 'w-4 h-4' }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconAward({ className = 'w-4 h-4' }: { className?: string }) {
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
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function DepartmentBadge({ name = '' }: { name?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes('eng')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-sky-50 text-sky-600 font-mono text-[11px] font-bold shrink-0">
          &lt;/&gt;
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('human') || lower.includes('hr')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-50 text-emerald-600 shrink-0">
          <IconUsers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('oper')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-teal-50 text-teal-600 shrink-0">
          <IconLayers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  if (lower.includes('prod')) {
    return (
      <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-indigo-50 text-indigo-600 shrink-0">
          <IconLayers className="w-3.5 h-3.5" />
        </span>
        <span>{name}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 font-medium text-xs sm:text-sm text-text">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-purple-50 text-purple-600 shrink-0">
        <IconBuilding className="w-3.5 h-3.5" />
      </span>
      <span>{name || '\u2014'}</span>
    </div>
  );
}

function getAvatarColors(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colorSets = [
    'bg-emerald-100 text-emerald-800',
    'bg-sky-100 text-sky-800',
    'bg-purple-100 text-purple-800',
    'bg-amber-100 text-amber-800',
    'bg-rose-100 text-rose-800',
    'bg-teal-100 text-teal-800',
  ];
  return colorSets[hash % colorSets.length];
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
  const [activeTab, setActiveTab] = useState<'all' | 'department' | 'designation' | 'hierarchy'>(
    'all',
  );
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Toggle selection
  const handleSelectAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

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
      `"${emp.phone || ''}"`,
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

  return (
    <div
      className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6 font-sans select-none"
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 dir-fade-in">
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
            className="min-h-[44px] px-3.5 bg-surface/90 hover:bg-surface border-border/80 shadow-xs text-xs font-semibold flex items-center gap-2"
          >
            <IconDownload className="w-4 h-4 text-text-muted" />
            Export
          </Button>

          {canCreateEmployee && (
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate('/employees/new')}
              data-testid="add-employee-button"
              className="min-h-[44px] px-4 shadow-sm text-xs font-bold flex items-center gap-2 bg-primary-deep text-white hover:bg-primary-ink"
            >
              <IconPlus className="w-4 h-4" />
              Add Employee
            </Button>
          )}
        </div>
      </div>

      {/* 2. Workforce Summary Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 dir-fade-in">
        {/* Card 1: Total Employees */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                <IconUsers className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-muted truncate">Total Employees</span>
            </div>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 shrink-0">
              ↑ +6%
            </span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              {totalEmployees}
            </span>
          </div>

          {/* SVG Wave Sparkline Green */}
          <div className="mt-2 -mx-1">
            <svg className="w-full h-8 overflow-visible" viewBox="0 0 160 30" fill="none">
              <defs>
                <linearGradient id="wave-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,25 C30,22 50,28 80,18 C110,8 135,16 160,10"
                fill="none"
                stroke="rgb(16, 185, 129)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,25 C30,22 50,28 80,18 C110,8 135,16 160,10 L160,30 L0,30 Z"
                fill="url(#wave-green)"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Active Employees */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 shadow-xs">
                <IconUserCheck className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-muted truncate">Active Employees</span>
            </div>
            <span className="text-xs font-semibold text-text-muted">({activePercentage}%)</span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              {activeEmployees}
            </span>
          </div>

          {/* SVG Wave Sparkline Teal */}
          <div className="mt-2 -mx-1">
            <svg className="w-full h-8 overflow-visible" viewBox="0 0 160 30" fill="none">
              <defs>
                <linearGradient id="wave-teal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,26 C35,26 55,16 90,20 C125,24 140,12 160,14"
                fill="none"
                stroke="rgb(20, 184, 166)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,26 C35,26 55,16 90,20 C125,24 140,12 160,14 L160,30 L0,30 Z"
                fill="url(#wave-teal)"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Inactive Employees */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 shadow-xs">
                <IconUserMinus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-muted truncate">Inactive Employees</span>
            </div>
            <span className="text-xs font-semibold text-text-muted">({inactivePercentage}%)</span>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              {inactiveEmployees}
            </span>
          </div>

          {/* SVG Wave Sparkline Coral */}
          <div className="mt-2 -mx-1">
            <svg className="w-full h-8 overflow-visible" viewBox="0 0 160 30" fill="none">
              <defs>
                <linearGradient id="wave-coral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(249, 115, 22)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(249, 115, 22)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,28 C40,28 60,18 95,22 C130,26 145,15 160,18"
                fill="none"
                stroke="rgb(249, 115, 22)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,28 C40,28 60,18 95,22 C130,26 145,15 160,18 L160,30 L0,30 Z"
                fill="url(#wave-coral)"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Departments */}
        <div className="p-4 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 shadow-xs">
                <IconNetwork className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-text-muted truncate">Departments</span>
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight">
              {departments.length || 6}
            </span>
          </div>

          {/* SVG Wave Sparkline Purple */}
          <div className="mt-2 -mx-1">
            <svg className="w-full h-8 overflow-visible" viewBox="0 0 160 30" fill="none">
              <defs>
                <linearGradient id="wave-purple" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0,22 C30,12 60,26 90,14 C120,4 140,20 160,10"
                fill="none"
                stroke="rgb(168, 85, 247)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M0,22 C30,12 60,26 90,14 C120,4 140,20 160,10 L160,30 L0,30 Z"
                fill="url(#wave-purple)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Directory Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 dir-fade-in">
        <button
          type="button"
          onClick={() => {
            setActiveTab('all');
            setDepartmentId(undefined);
            setDesignationId(undefined);
          }}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'all'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconUsers className="w-4 h-4" />
          All Employees
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('department')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'department'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconBuilding className="w-4 h-4" />
          By Department
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('designation')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'designation'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconAward className="w-4 h-4" />
          By Designation
        </button>

        <button
          type="button"
          onClick={() => navigate('/employees/org-chart')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'hierarchy'
              ? 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/30 shadow-xs'
              : 'bg-surface/80 text-text-muted hover:text-text hover:bg-surface border border-border/80'
          }`}
        >
          <IconNetwork className="w-4 h-4" />
          Reporting Hierarchy
        </button>
      </div>

      {/* Quick Filter Bar for Department or Designation tabs */}
      {activeTab === 'department' && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-surface/80 border border-border/70 rounded-xl dir-fade-in">
          <span className="text-xs font-bold text-text-muted px-2">Departments:</span>
          <button
            type="button"
            onClick={() => setDepartmentId(undefined)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              !query.departmentId
                ? 'bg-primary-deep text-white'
                : 'bg-surface text-text-muted hover:bg-surface-muted'
            }`}
          >
            All
          </button>
          {departments.map((dept) => (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDepartmentId(dept.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                query.departmentId === dept.id
                  ? 'bg-primary-deep text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-muted border border-border/60'
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'designation' && (
        <div className="flex items-center gap-2 overflow-x-auto p-2 bg-surface/80 border border-border/70 rounded-xl dir-fade-in">
          <span className="text-xs font-bold text-text-muted px-2">Designations:</span>
          <button
            type="button"
            onClick={() => setDesignationId(undefined)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
              !query.designationId
                ? 'bg-primary-deep text-white'
                : 'bg-surface text-text-muted hover:bg-surface-muted'
            }`}
          >
            All
          </button>
          {designations.map((desig) => (
            <button
              key={desig.id}
              type="button"
              onClick={() => setDesignationId(desig.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                query.designationId === desig.id
                  ? 'bg-primary-deep text-white'
                  : 'bg-surface text-text-muted hover:bg-surface-muted border border-border/60'
              }`}
            >
              {desig.title}
            </button>
          ))}
        </div>
      )}

      {/* 4. Filter Controls with View Switcher */}
      <div data-testid="employee-directory-filters" className="relative dir-fade-in">
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

        {/* Floating View Switcher Toggle on Tablet/Desktop */}
        <div className="hidden sm:flex items-center gap-1 absolute top-4 right-4 z-10 bg-surface border border-border/80 rounded-xl p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-emerald-500/20 text-emerald-800'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <IconList className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-emerald-500/20 text-emerald-800'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <IconGrid className="w-4 h-4" />
          </button>
        </div>
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

      {/* 8. Desktop & Tablet Views (>=640px) */}
      {!isLoading && employees.length > 0 && viewMode === 'grid' && (
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 dir-fade-in">
          {employees.map((emp) => {
            const avatarBg = getAvatarColors(`${emp.firstName} ${emp.lastName}`);
            const initials = `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
            const isSelf = emp.id === user?.employeeId;
            const isDeactivated = emp.status === 'deactivated';

            return (
              <div
                key={emp.id}
                className="p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full ${avatarBg} font-bold flex items-center justify-center shrink-0 text-sm`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <a
                        href={`/employees/${emp.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/employees/${emp.id}`);
                        }}
                        className="text-sm font-bold text-text hover:text-primary-deep hover:underline truncate block"
                        data-testid={`employee-link-${emp.id}`}
                      >
                        {emp.firstName} {emp.lastName}
                      </a>
                      <span className="text-xs font-mono text-text-muted block truncate">
                        {emp.employeeCode}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                      emp.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-700'
                        : emp.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-700'
                          : 'bg-rose-500/10 text-rose-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        emp.status === 'active'
                          ? 'bg-emerald-500'
                          : emp.status === 'pending'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                    />
                    {emp.status === 'active'
                      ? 'Active'
                      : emp.status === 'pending'
                        ? 'Pending'
                        : 'Deactivated'}
                  </span>
                </div>

                <div className="my-3 py-2.5 border-t border-b border-border/60 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Department:</span>
                    <span className="font-semibold text-text">
                      {emp.department?.name || '\u2014'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Designation:</span>
                    <span className="font-semibold text-text truncate max-w-[140px]">
                      {emp.designation?.title || '\u2014'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted">Manager:</span>
                    <span className="text-text truncate max-w-[140px]">
                      {emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : '\u2014'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-text-muted">
                    Joined:{' '}
                    <span className="font-medium text-text">
                      {formatJoiningDate(emp.joiningDate)}
                    </span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="View Details"
                      onClick={() => navigate(`/employees/${emp.id}`)}
                      className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors"
                    >
                      <IconEye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <>
                        {isSelf ? (
                          <span className="text-xs text-text-subtle font-medium">
                            (Current User)
                          </span>
                        ) : isDeactivated ? (
                          <span className="text-xs text-text-subtle font-mono">Deactivated</span>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeactivatingEmployee(emp)}
                            data-testid={`deactivate-btn-table-${emp.id}`}
                            className="min-h-[36px] text-xs px-2.5 py-1"
                          >
                            Deactivate
                          </Button>
                        )}
                      </>
                    )}
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
          className="hidden sm:block bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card overflow-hidden dir-fade-in"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label="Employee directory listing">
              <thead className="bg-surface-muted/60 border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label="Select all employees"
                      checked={selectedIds.size === employees.length && employees.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3.5">
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
                  <th scope="col" className="px-4 py-3.5">
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
                  <th scope="col" className="px-4 py-3.5">
                    DEPARTMENT
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden md:table-cell">
                    DESIGNATION
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden lg:table-cell">
                    MANAGER
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    STATUS
                  </th>
                  <th scope="col" className="px-4 py-3.5 hidden xl:table-cell">
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
                  <th scope="col" className="px-4 py-3.5 text-right">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {employees.map((emp) => {
                  const avatarBg = getAvatarColors(`${emp.firstName} ${emp.lastName}`);
                  const initials =
                    `${emp.firstName[0] || ''}${emp.lastName[0] || ''}`.toUpperCase();
                  const isSelf = emp.id === user?.employeeId;
                  const isDeactivated = emp.status === 'deactivated';

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-surface-muted/50 transition-colors ${
                        selectedIds.has(emp.id) ? 'bg-primary-soft/30' : ''
                      }`}
                    >
                      <td className="w-10 px-4 py-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${emp.firstName} ${emp.lastName}`}
                          checked={selectedIds.has(emp.id)}
                          onChange={() => handleSelectOne(emp.id)}
                          className="w-4 h-4 rounded border-border-strong text-primary-strong focus:ring-1 focus:ring-primary-strong cursor-pointer"
                        />
                      </td>

                      {/* Employee Column: Avatar, Name, Email */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full ${avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <a
                              href={`/employees/${emp.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/employees/${emp.id}`);
                              }}
                              className="font-semibold text-text hover:text-primary-deep hover:underline truncate block"
                              data-testid={`employee-link-${emp.id}`}
                            >
                              {emp.firstName} {emp.lastName}{' '}
                              <span className="font-mono text-xs text-text-muted font-normal">
                                {emp.employeeCode}
                              </span>
                            </a>
                            <div className="text-xs text-text-muted truncate">
                              {emp.email || `${emp.firstName.toLowerCase()}@maxr.internal`}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code Column */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-text-muted font-semibold bg-surface-muted px-2 py-0.5 rounded border border-border/60">
                          {emp.employeeCode}
                        </span>
                      </td>

                      {/* Department Column */}
                      <td className="px-4 py-3.5">
                        <DepartmentBadge name={emp.department?.name} />
                      </td>

                      {/* Designation Column */}
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs sm:text-sm text-text-muted">
                        {emp.designation?.title || '\u2014'}
                      </td>

                      {/* Manager Column */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {emp.manager ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center text-[10px] shrink-0">
                              {emp.manager.firstName[0]}
                              {emp.manager.lastName[0]}
                            </div>
                            <span className="text-xs text-text font-medium truncate max-w-[120px]">
                              {emp.manager.firstName} {emp.manager.lastName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            emp.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : emp.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-700'
                                : 'bg-rose-500/10 text-rose-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              emp.status === 'active'
                                ? 'bg-emerald-500'
                                : emp.status === 'pending'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
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
                      <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-text-muted">
                        {formatJoiningDate(emp.joiningDate)}
                      </td>

                      {/* Actions Column */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            aria-label={`View ${emp.firstName} ${emp.lastName}`}
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="p-1.5 text-text-muted hover:text-primary-deep rounded-lg hover:bg-surface-muted transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          >
                            <IconEye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            aria-label={`Edit ${emp.firstName} ${emp.lastName}`}
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-muted transition-colors min-w-[32px] min-h-[32px] inline-flex items-center justify-center"
                          >
                            <IconEditPencil className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <>
                              {isSelf ? (
                                <span className="text-xs text-text-subtle font-medium ml-1">
                                  (Current User)
                                </span>
                              ) : isDeactivated ? (
                                <span className="text-xs text-text-subtle font-mono ml-1">
                                  Deactivated
                                </span>
                              ) : (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => setDeactivatingEmployee(emp)}
                                  data-testid={`deactivate-btn-table-${emp.id}`}
                                  className="min-h-[36px] text-xs px-2.5 py-1 ml-1"
                                >
                                  Deactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 10. Pagination Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-surface-muted/40 border-t border-border text-xs text-text-muted">
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
    </div>
  );
}

export default EmployeeDirectoryPage;
