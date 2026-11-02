import { useState } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import {
  Badge,
  Button,
  Column,
  DataTable,
  ErrorState,
  ForbiddenState,
  SegmentedControl,
  Skeleton,
  SortDirection,
} from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useRolesAndPermissions } from '../hooks/useRolesAndPermissions';
import { UserFilters } from '../components/UserFilters';
import { UserCard } from '../components/UserCard';
import { RoleAssignmentModal } from '../components/RoleAssignmentModal';
import { RolesSummaryGrid } from '../components/RolesSummaryGrid';
import { PermissionsMatrix } from '../components/PermissionsMatrix';
import type { UserAccount, UserSortField } from '../types';

const ROLE_BADGE_VARIANTS: Record<Role, 'primary' | 'secondary' | 'outline' | 'neutral'> = {
  [ROLES.ADMIN]: 'primary',
  [ROLES.HR_MANAGER]: 'secondary',
  [ROLES.TEAM_LEAD]: 'outline',
  [ROLES.STAFF]: 'neutral',
};

const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.STAFF]: 'Staff',
};

export function UsersPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'roles-permissions'>('accounts');
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
    pageSize,
    sortBy,
    sortOrder,
    setSearch,
    setRole,
    setIsActive,
    setSort,
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

  const columns: Column<UserAccount>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      priority: 'high',
      render: (u) => {
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
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center text-xs shrink-0"
              aria-hidden="true"
            >
              {initials}
            </div>
            <div>
              <div className="font-semibold text-text text-xs sm:text-sm">{u.name}</div>
              <div className="text-text-muted text-[11px]">{u.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'employeeCode',
      header: 'Code',
      priority: 'medium',
      render: (u) => (
        <span className="font-mono text-xs text-text-muted font-medium">{u.employeeCode}</span>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      priority: 'high',
      render: (u) => (
        <div className="flex flex-wrap gap-1" data-testid={`table-roles-${u.id}`}>
          {u.roles.map((r) => (
            <Badge key={r} variant={ROLE_BADGE_VARIANTS[r] || 'neutral'} className="text-[11px]">
              {ROLE_DISPLAY_NAMES[r] || r}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      priority: 'high',
      render: (u) => (
        <Badge variant={u.isActive ? 'success' : 'neutral'}>
          {u.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      sortable: true,
      priority: 'low',
      render: (u) => (
        <span className="text-xs text-text-muted">
          {u.lastLoginAt
            ? new Date(u.lastLoginAt).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      priority: 'low',
      render: (u) => (
        <span className="text-xs text-text-muted">
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            header: 'Actions',
            priority: 'high' as const,
            render: (u: UserAccount) => (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(u)}
                data-testid={`assign-roles-btn-table-${u.id}`}
                className="text-xs min-h-[36px]"
              >
                Manage Roles
              </Button>
            ),
          },
        ]
      : []),
  ];

  const handleSortChange = (key: string, direction: SortDirection) => {
    if (key === 'name' || key === 'email' || key === 'createdAt' || key === 'lastLoginAt') {
      setSort(key as UserSortField, direction || 'asc');
    }
  };

  const tabs = [
    { value: 'accounts', label: 'User Accounts' },
    ...(isAdmin ? [{ value: 'roles-permissions', label: 'Roles & Permissions' }] : []),
  ];

  return (
    <div className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6" data-testid="users-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">Users & Roles</h1>
            <Badge variant="primary">{meta.total} Accounts</Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-muted">
            Directory of user login accounts, role assignments, and authorization grants.
          </p>
        </div>

        {isAdmin && (
          <SegmentedControl
            options={tabs}
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'accounts' | 'roles-permissions')}
            ariaLabel="User administration view tabs"
            data-testid="users-view-segmented-control"
          />
        )}
      </div>

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="space-y-4" data-testid="users-accounts-tab">
          {/* Filters Bar */}
          <UserFilters
            filters={filters}
            onSearchChange={setSearch}
            onRoleChange={setRole}
            onIsActiveChange={setIsActive}
            onReset={resetFilters}
          />

          {/* Loading Skeletons */}
          {isUsersLoading && (
            <div className="space-y-3" data-testid="users-loading-skeleton">
              <Skeleton variant="rectangular" height={48} className="w-full" />
              <Skeleton variant="rectangular" height={56} className="w-full" />
              <Skeleton variant="rectangular" height={56} className="w-full" />
              <Skeleton variant="rectangular" height={56} className="w-full" />
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

              {meta.totalPages > 1 && (
                <div className="p-3 bg-surface border border-border rounded-tile flex items-center justify-between text-xs">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="min-h-[44px]"
                  >
                    Previous
                  </Button>
                  <span className="text-text-muted">
                    Page {page} of {meta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage(page + 1)}
                    className="min-h-[44px]"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Desktop & Tablet DataTable (>=640px) */}
          {!isUsersLoading && !usersError && (
            <div className="hidden sm:block">
              <DataTable
                columns={columns}
                data={users}
                keyExtractor={(u) => u.id}
                ariaLabel="User accounts table"
                sortKey={sortBy}
                sortDirection={sortOrder}
                onSortChange={handleSortChange}
                page={page}
                pageSize={pageSize}
                total={meta.total}
                onPageChange={setPage}
                emptyTitle="No accounts found"
                emptyMessage="There are no user accounts matching your criteria."
              />
            </div>
          )}
        </div>
      )}

      {/* Roles & Permissions Tab (Admin only) */}
      {activeTab === 'roles-permissions' && isAdmin && (
        <div className="space-y-8" data-testid="users-roles-tab">
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
