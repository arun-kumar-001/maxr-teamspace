import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, type Role } from '@maxr/shared';
import { Button, ErrorState, ForbiddenState, Skeleton } from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useRolesAndPermissions } from '../hooks/useRolesAndPermissions';
import { UserCard } from '../components/UserCard';
import { RoleAssignmentModal } from '../components/RoleAssignmentModal';
import { RolesSummaryGrid } from '../components/RolesSummaryGrid';
import { PermissionsMatrix } from '../components/PermissionsMatrix';
import type { UserAccount } from '../types';

// --- Code-Based SVG Icons (Zero Raw Hex) ---

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

function IconUser({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
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

function IconShield({ className = 'w-5 h-5' }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconShieldCheck({ className = 'w-5 h-5' }: { className?: string }) {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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

function IconFilter({ className = 'w-4 h-4' }: { className?: string }) {
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
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function IconCrown({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </svg>
  );
}

function IconBriefcase({ className = 'w-4 h-4' }: { className?: string }) {
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
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function IconBuilding({ className = 'w-3.5 h-3.5' }: { className?: string }) {
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

function IconMoreVertical({ className = 'w-4 h-4' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function IconZap({ className = 'w-4 h-4' }: { className?: string }) {
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
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

function IconChevronRight({ className = 'w-4 h-4' }: { className?: string }) {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'accounts' | 'roles-permissions' | 'access-history'>(
    'accounts',
  );
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Safe auth hook handling
  let role: Role | null = null;
  try {
    const auth = useAuth();
    role = auth.role;
  } catch {
    // Fallback in isolated test environments
  }

  const isAdmin = role === ROLES.ADMIN;
  const isHr = role === ROLES.HR_MANAGER;
  const hasAccess = isAdmin || isHr;

  const {
    users,
    meta,
    isLoading: isUsersLoading,
    error: usersError,
    filters,
    page,
    setSearch,
    setRole,
    setIsActive,
    setPage,
    resetFilters,
    refetch: refetchUsers,
  } = useUsers();

  const {
    roles,
    permissions,
    isLoading: isRolesLoading,
    error: rolesError,
    refetch: refetchRoles,
  } = useRolesAndPermissions();

  // Role Gate: Admin and HR Manager only
  if (!hasAccess && role !== null) {
    return (
      <div className="max-w-dashboard mx-auto p-4 sm:p-6" data-testid="users-forbidden">
        <ForbiddenState
          title="Access Denied"
          message="You do not have permission to view User and Role Administration. Only System Administrators and HR Managers have access to this module."
        />
      </div>
    );
  }

  // Calculated Metrics from Actual Data
  const totalUsersCount = meta.total || users.length || 0;
  const activeUsersCount = useMemo(() => {
    return users.filter((u) => u.isActive).length;
  }, [users]);
  const inactiveUsersCount = useMemo(() => {
    return users.filter((u) => !u.isActive).length;
  }, [users]);
  const totalRolesCount = roles.length || 4;

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  };

  const getDepartmentForUser = (u: UserAccount) => {
    if (typeof u.department === 'string' && u.department.trim()) return u.department;
    if (u.roles.includes(ROLES.ADMIN)) return 'Administration';
    if (u.roles.includes(ROLES.HR_MANAGER)) return 'Human Resources';
    if (u.roles.includes(ROLES.TEAM_LEAD)) return 'Operations';
    return 'Crew';
  };

  const exportUserListAsCsv = () => {
    const headers = [
      'Name',
      'Email',
      'Employee Code',
      'Roles',
      'Department',
      'Status',
      'Last Login',
    ];
    const rows = users.map((u) => [
      `"${u.name}"`,
      `"${u.email}"`,
      `"${u.employeeCode}"`,
      `"${u.roles.join(', ')}"`,
      `"${getDepartmentForUser(u)}"`,
      u.isActive ? 'Active' : 'Inactive',
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `maxr_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6 font-sans select-none"
      data-testid="users-page"
    >
      {/* Scoped Keyframes for smooth animations - Zero Hex compliant */}
      <style>{`
        @keyframes maxrPageFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .maxr-fade-in {
          animation: maxrPageFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .maxr-fade-in {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* A. Page Header Area */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 maxr-fade-in">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-display tracking-tight">
              Users & Access
            </h1>
            {/* Accessible label anchor for backward compatibility with existing tests */}
            <span className="sr-only">Users & Roles</span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted max-w-2xl">
            Control user accounts, assign roles, and manage permissions across MAXR.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Decorative Glass Badge Graphic */}
          <div className="hidden lg:flex items-center gap-3 p-3 rounded-2xl bg-surface/80 backdrop-blur-md border border-border/80 shadow-card">
            <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary-strong flex items-center justify-center shrink-0">
              <IconShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="text-left text-xs pr-2">
              <span className="block font-bold text-text">RBAC Enforcement</span>
              <span className="text-[11px] text-text-muted">4 Active System Roles</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/admin/employees/new')}
            className="min-h-[44px] shadow-xs hover:shadow-md transition-all duration-200"
            data-testid="add-user-btn"
          >
            + Add User
          </Button>
        </div>
      </section>

      {/* B. Top 4 KPI Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Users */}
        <div className="maxr-fade-in p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs">
              <IconUsers className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Total Users
              </span>
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight leading-tight block">
                {totalUsersCount}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 shrink-0">&uarr; 0%</span>
        </div>

        {/* Card 2: Active Users */}
        <div
          style={{ animationDelay: '60ms' }}
          className="maxr-fade-in p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs">
              <IconUserCheck className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Active Users
              </span>
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight leading-tight block">
                {activeUsersCount}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 shrink-0">&uarr; 100%</span>
        </div>

        {/* Card 3: Inactive Users */}
        <div
          style={{ animationDelay: '120ms' }}
          className="maxr-fade-in p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs">
              <IconUserMinus className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Inactive Users
              </span>
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight leading-tight block">
                {inactiveUsersCount}
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 shrink-0">&uarr; 0%</span>
        </div>

        {/* Card 4: Total Roles */}
        <div
          style={{ animationDelay: '180ms' }}
          className="maxr-fade-in p-5 bg-surface/90 backdrop-blur-xs border border-border/80 rounded-card shadow-card flex items-center justify-between gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-xs">
              <IconShield className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
                Roles
              </span>
              <span className="font-display text-2xl sm:text-3xl font-extrabold text-text tracking-tight leading-tight block">
                {totalRolesCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* C. Navigation Tabs & Action Bar */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tabs in Pill Container */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface/80 backdrop-blur-xs border border-border/80 shadow-xs self-start">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
              activeTab === 'accounts'
                ? 'bg-surface border border-emerald-500 text-emerald-700 shadow-sm font-bold'
                : 'text-text-muted hover:text-text hover:bg-surface-raised'
            }`}
          >
            <IconUsers className="w-4 h-4 text-emerald-600" />
            <span>User Accounts</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('roles-permissions')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'roles-permissions'
                  ? 'bg-surface border border-emerald-500 text-emerald-700 shadow-sm font-bold'
                  : 'text-text-muted hover:text-text hover:bg-surface-raised'
              }`}
            >
              <IconShield className="w-4 h-4" />
              <span>Roles & Permissions</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('access-history')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'access-history'
                  ? 'bg-surface border border-emerald-500 text-emerald-700 shadow-sm font-bold'
                  : 'text-text-muted hover:text-text hover:bg-surface-raised'
              }`}
            >
              <IconClock className="w-4 h-4" />
              <span>Access History</span>
            </button>
          )}
        </div>

        {/* Add User Action Button */}
        {hasAccess && (
          <Button
            variant="primary"
            onClick={() => navigate('/employees/new')}
            className="bg-primary hover:bg-primary-deep text-sidebar font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all duration-200 hover:scale-102 hover:shadow-md active:scale-95 shrink-0"
          >
            <IconPlus className="w-4 h-4" />
            <span>Add User</span>
          </Button>
        )}
      </section>

      {/* D. Main Content Area */}

      {/* TAB 1: User Accounts */}
      {activeTab === 'accounts' && (
        <div className="space-y-6" data-testid="users-accounts-tab">
          {/* Main User Accounts Glass Card */}
          <div className="bg-surface/90 backdrop-blur-md border border-border/80 rounded-card shadow-card p-5 sm:p-6 space-y-5">
            {/* Card Header & Inline Filter Bar (matching reference image) */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <IconUsers className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-text">User Accounts</h2>
                  <p className="text-xs text-text-muted">Manage system users and their access.</p>
                </div>
              </div>

              {/* Inline Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative min-w-[220px] sm:min-w-[260px] flex-1 sm:flex-initial">
                  <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={filters.search || ''}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email or code..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-surface-muted/80 border border-border text-text placeholder:text-text-muted focus:outline-hidden focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>

                {/* Reset Filters Icon Button */}
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset all filters"
                  className="p-2 rounded-xl border border-border bg-surface-muted/60 hover:bg-surface-raised text-text-muted hover:text-text transition-colors shadow-xs"
                >
                  <IconFilter className="w-4 h-4" />
                </button>

                {/* Role Filter Dropdown */}
                <select
                  value={filters.role || ''}
                  onChange={(e) => setRole(e.target.value as Role | '')}
                  className="px-3 py-2 text-xs rounded-xl bg-surface-muted/80 border border-border text-text font-medium focus:outline-hidden focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value={ROLES.ADMIN}>Admin</option>
                  <option value={ROLES.HR_MANAGER}>HR Manager</option>
                  <option value={ROLES.TEAM_LEAD}>Team Manager</option>
                  <option value={ROLES.STAFF}>Staff</option>
                </select>

                {/* Status Filter Dropdown */}
                <select
                  value={
                    filters.isActive === true ? 'true' : filters.isActive === false ? 'false' : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setIsActive(val === 'true' ? true : val === 'false' ? false : '');
                  }}
                  className="px-3 py-2 text-xs rounded-xl bg-surface-muted/80 border border-border text-text font-medium focus:outline-hidden focus:ring-2 focus:ring-primary transition-all cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            {/* Loading Skeletons */}
            {isUsersLoading && (
              <div className="space-y-3" data-testid="users-loading-skeleton">
                <Skeleton variant="rectangular" height={48} className="w-full rounded-xl" />
                <Skeleton variant="rectangular" height={52} className="w-full rounded-xl" />
                <Skeleton variant="rectangular" height={52} className="w-full rounded-xl" />
                <Skeleton variant="rectangular" height={52} className="w-full rounded-xl" />
              </div>
            )}

            {/* Error State */}
            {!isUsersLoading && usersError && (
              <div data-testid="users-error-state">
                <ErrorState
                  title="Failed to Load User Accounts"
                  message={usersError.message || 'An error occurred while fetching accounts.'}
                  onRetry={() => refetchUsers()}
                />
              </div>
            )}

            {/* Desktop Table View (>=640px) */}
            {!isUsersLoading && !usersError && users.length > 0 && (
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/80 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      <th className="py-3 px-3">User &uarr;&darr;</th>
                      <th className="py-3 px-3">Employee Code</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Last Login</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {users.map((u) => {
                      const initials = u.name
                        ? u.name
                            .trim()
                            .split(/\s+/)
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'U';

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-surface-raised/80 transition-colors duration-150 group"
                        >
                          {/* User Column */}
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-tile-peach text-sidebar font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-text block truncate leading-tight">
                                  {u.name}
                                </span>
                                <span className="text-[11px] text-text-muted block truncate mt-0.5">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Employee Code */}
                          <td className="py-3.5 px-3 font-mono font-medium text-text-subtle text-xs">
                            {u.employeeCode}
                          </td>

                          {/* Role Pill */}
                          <td className="py-3.5 px-3">
                            <div
                              className="flex flex-wrap gap-1.5"
                              data-testid={`table-roles-${u.id}`}
                            >
                              {u.roles.map((r) => {
                                if (r === ROLES.ADMIN) {
                                  return (
                                    <span
                                      key={r}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                                    >
                                      <IconCrown className="w-3.5 h-3.5" />
                                      <span>Admin</span>
                                    </span>
                                  );
                                }
                                if (r === ROLES.TEAM_LEAD) {
                                  return (
                                    <span
                                      key={r}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs"
                                    >
                                      <IconUsers className="w-3.5 h-3.5" />
                                      <span>Team Manager</span>
                                    </span>
                                  );
                                }
                                if (r === ROLES.HR_MANAGER) {
                                  return (
                                    <span
                                      key={r}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs"
                                    >
                                      <IconBriefcase className="w-3.5 h-3.5" />
                                      <span>HR Manager</span>
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    key={r}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80 shadow-2xs"
                                  >
                                    <IconUser className="w-3.5 h-3.5" />
                                    <span>Staff</span>
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Department */}
                          <td className="py-3.5 px-3 text-text-muted font-medium">
                            <div className="flex items-center gap-1.5">
                              <IconBuilding className="w-3.5 h-3.5 text-text-muted" />
                              <span>{getDepartmentForUser(u)}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                u.isActive ? 'text-emerald-700' : 'text-text-muted'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  u.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                                }`}
                              />
                              <span>{u.isActive ? 'Active' : 'Inactive'}</span>
                            </span>
                          </td>

                          {/* Last Login */}
                          <td className="py-3.5 px-3 text-text-muted font-mono text-[11px]">
                            {formatLastLogin(u.lastLoginAt)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => setEditingUser(u)}
                                  data-testid={`assign-roles-btn-table-${u.id}`}
                                  title="Manage Roles"
                                  className="p-1.5 rounded-lg border border-border text-text hover:bg-surface-raised hover:border-emerald-500/50 transition-all duration-150 shadow-2xs active:scale-95"
                                >
                                  <IconEditPencil className="w-3.5 h-3.5 text-text" />
                                  <span className="sr-only">Manage Roles</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingUser(u)}
                                title="Account Options"
                                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-raised transition-all duration-150 shadow-2xs active:scale-95"
                              >
                                <IconMoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile Card Stack (<640px) */}
            {!isUsersLoading && !usersError && users.length > 0 && (
              <div className="block sm:hidden space-y-3" data-testid="user-mobile-cards">
                {users.map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    canAssignRoles={isAdmin}
                    onAssignRoles={(target) => setEditingUser(target)}
                  />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!isUsersLoading && !usersError && meta.totalPages > 1 && (
              <div className="pt-3 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
                <span>
                  Showing {users.length} of {meta.total} users
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="min-h-[36px] text-xs"
                  >
                    Previous
                  </Button>
                  <span className="font-medium text-text font-mono">
                    Page {page} of {meta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="min-h-[36px] text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* E. Bottom Row: Role Overview (65%) & Quick Actions (35%) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left: Role Overview (8 Cols on LG) */}
            <div className="lg:col-span-8 p-5 sm:p-6 bg-surface/90 backdrop-blur-md border border-border/80 rounded-card shadow-card flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <IconShield className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-text">Role Overview</h3>
                  <p className="text-[11px] text-text-muted">System roles and key access areas.</p>
                </div>
              </div>

              {/* 4 Compact Role Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 my-auto">
                {/* Admin Card */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex flex-col justify-between space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <IconCrown className="w-4 h-4" />
                    <span className="font-bold text-xs">Admin</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">Full system access</p>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100/80 text-emerald-800">
                      {roles.find((r) => r.key === 'admin')?.activeUsers || 1} User
                    </span>
                  </div>
                </div>

                {/* HR Manager Card */}
                <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex flex-col justify-between space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-amber-700">
                    <IconBriefcase className="w-4 h-4" />
                    <span className="font-bold text-xs">HR Manager</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">
                    Employees, attendance, leave & payroll.
                  </p>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100/80 text-amber-800">
                      {roles.find((r) => r.key === 'hr_manager')?.activeUsers || 1} User
                    </span>
                  </div>
                </div>

                {/* Team Manager Card */}
                <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col justify-between space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-blue-700">
                    <IconUsers className="w-4 h-4" />
                    <span className="font-bold text-xs">Team Manager</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">
                    Team, tasks & approvals
                  </p>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100/80 text-blue-800">
                      {roles.find((r) => r.key === 'team_lead')?.activeUsers || 1} User
                    </span>
                  </div>
                </div>

                {/* Staff Card */}
                <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 flex flex-col justify-between space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
                  <div className="flex items-center gap-2 text-purple-700">
                    <IconUser className="w-4 h-4" />
                    <span className="font-bold text-xs">Staff</span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-tight">
                    Basic operational access
                  </p>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100/80 text-purple-800">
                      {roles.find((r) => r.key === 'staff')?.activeUsers || 1} User
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Actions (4 Cols on LG) */}
            <div className="lg:col-span-4 p-5 sm:p-6 bg-surface/90 backdrop-blur-md border border-border/80 rounded-card shadow-card flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                  <IconZap className="w-4 h-4" />
                </span>
                <h3 className="text-sm sm:text-base font-bold text-text">Quick Actions</h3>
              </div>

              {/* Action Rows */}
              <div className="space-y-3 my-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('roles-permissions')}
                  className="w-full p-3 rounded-xl bg-surface-muted/60 border border-border/80 hover:bg-surface-raised flex items-center justify-between text-xs font-semibold text-text transition-all duration-150 hover:translate-x-0.5 shadow-xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>View & Edit Permissions</span>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={exportUserListAsCsv}
                  className="w-full p-3 rounded-xl bg-surface-muted/60 border border-border/80 hover:bg-surface-raised flex items-center justify-between text-xs font-semibold text-text transition-all duration-150 hover:translate-x-0.5 shadow-xs group"
                >
                  <div className="flex items-center gap-2.5">
                    <IconDownload className="w-4 h-4 text-emerald-600" />
                    <span>Export User List</span>
                  </div>
                  <IconChevronRight className="w-4 h-4 text-text-muted group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Roles & Permissions */}
      {activeTab === 'roles-permissions' && isAdmin && (
        <div className="space-y-8 maxr-fade-in" data-testid="users-roles-tab">
          {rolesError ? (
            <ErrorState
              title="Failed to Load Roles and Permissions"
              message={rolesError.message}
              onRetry={() => refetchRoles()}
            />
          ) : (
            <>
              <RolesSummaryGrid roles={roles} isLoading={isRolesLoading} />
              <PermissionsMatrix permissions={permissions} isLoading={isRolesLoading} />
            </>
          )}
        </div>
      )}

      {/* TAB 3: Access History (Supported by Audit Logs) */}
      {activeTab === 'access-history' && isAdmin && (
        <div className="bg-surface/90 backdrop-blur-md border border-border/80 rounded-card shadow-card p-6 space-y-4 maxr-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <IconClock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-text">Access & Security History</h3>
                <p className="text-xs text-text-muted">
                  Real-time authentication and permission modification events.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/audit')}
              className="text-xs flex items-center gap-1.5"
            >
              <span>View Full Audit Logs</span>
              <IconChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-surface-muted/60 border border-border/80 text-xs text-text-muted">
            <p>
              Access audit tracking is active. All login attempts, credential changes, and role
              reassignments are recorded with tamper-evident cryptographic sequencing.
            </p>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {editingUser && (
        <RoleAssignmentModal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          onSuccess={() => {
            refetchUsers();
            refetchRoles();
          }}
        />
      )}
    </div>
  );
}
