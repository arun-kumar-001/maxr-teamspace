// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UsersPage } from '../pages/UsersPage';
import * as usersApi from '../api/usersApi';
import * as authContext from '../../../auth/AuthContext';
import type { PermissionSummary, RoleSummary, UserAccount, UserListResponse } from '../types';

afterEach(cleanup);

describe('UsersPage Component Suite (Issue #27)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUsers: UserAccount[] = [
    {
      id: 'u-1',
      employeeId: 'emp-1',
      employeeCode: 'MAX001',
      name: 'Eleanor Vance',
      email: 'eleanor@maxr.internal',
      isActive: true,
      roles: ['admin'],
      lastLoginAt: '2026-11-01T12:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'u-2',
      employeeId: 'emp-2',
      employeeCode: 'MAX002',
      name: 'Marcus Brody',
      email: 'marcus@maxr.internal',
      isActive: false,
      roles: ['staff'],
      lastLoginAt: null,
      createdAt: '2026-02-01T00:00:00Z',
    },
  ];

  const mockUsersResponse: UserListResponse = {
    data: mockUsers,
    meta: {
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    },
  };

  const mockRoles: RoleSummary[] = [
    { id: 'r-1', key: 'admin', name: 'Admin', description: 'System Administrator', activeUsers: 2 },
    {
      id: 'r-2',
      key: 'hr_manager',
      name: 'HR Manager',
      description: 'Human Resources',
      activeUsers: 3,
    },
    { id: 'r-3', key: 'team_lead', name: 'Team Lead', description: 'Team Leader', activeUsers: 5 },
    { id: 'r-4', key: 'staff', name: 'Staff', description: 'Staff Member', activeUsers: 20 },
  ];

  const mockPermissions: PermissionSummary[] = [
    {
      key: 'users.list',
      module: 'users',
      action: 'list',
      description: 'List user accounts',
      grants: { admin: 'company', hr_manager: 'company' },
    },
    {
      key: 'users.assign_role',
      module: 'users',
      action: 'assign_role',
      description: 'Assign roles to accounts',
      grants: { admin: 'company' },
    },
  ];

  function setupAuth(role: string = 'admin') {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      role: role as any,
      user: {
        id: 'u-1',
        employeeId: 'emp-1',
        name: 'Eleanor Vance',
        email: 'eleanor@maxr.internal',
        role: role as any,
        roles: [role as any],
        permissions: ['users.list', 'users.assign_role'],
        avatarInitials: 'EV',
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });
  }

  it('renders page header, user counts, and accounts table for Admin', async () => {
    setupAuth('admin');
    vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockUsersResponse);
    vi.spyOn(usersApi, 'getRoles').mockResolvedValue(mockRoles);
    vi.spyOn(usersApi, 'getPermissions').mockResolvedValue(mockPermissions);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('users-page')).toBeInTheDocument();
    expect(screen.getByText('Users & Roles')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Eleanor Vance').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Marcus Brody').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MAX001').length).toBeGreaterThan(0);
      expect(screen.getAllByText('MAX002').length).toBeGreaterThan(0);
    });

    // Admin should see Manage Roles action button in table and card
    expect(screen.getAllByTestId('assign-roles-btn-table-u-1').length).toBeGreaterThan(0);
    expect(screen.getByTestId('assign-roles-btn-card-u-1')).toBeInTheDocument();
  });

  it('hides Manage Roles action for HR Manager (read-only view for HR)', async () => {
    setupAuth('hr_manager');
    vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockUsersResponse);
    vi.spyOn(usersApi, 'getRoles').mockResolvedValue(mockRoles);
    vi.spyOn(usersApi, 'getPermissions').mockResolvedValue(mockPermissions);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Eleanor Vance').length).toBeGreaterThan(0);
    });

    // Role assignment action must NOT be rendered for HR Manager
    expect(screen.queryByTestId('assign-roles-btn-table-u-1')).toBeNull();
    expect(screen.queryByTestId('assign-roles-btn-card-u-1')).toBeNull();
  });

  it('renders ForbiddenState for unauthorized roles (Staff or Team Lead)', async () => {
    setupAuth('staff');

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('users-forbidden')).toBeInTheDocument();
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });

  it('switches between User Accounts and Roles & Permissions tabs', async () => {
    setupAuth('admin');
    vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockUsersResponse);
    vi.spyOn(usersApi, 'getRoles').mockResolvedValue(mockRoles);
    vi.spyOn(usersApi, 'getPermissions').mockResolvedValue(mockPermissions);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Eleanor Vance').length).toBeGreaterThan(0);
    });

    // Switch to Roles & Permissions tab
    const rolesTabBtn = screen.getByText('Roles & Permissions');
    fireEvent.click(rolesTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('users-roles-tab')).toBeInTheDocument();
      expect(screen.getByTestId('roles-summary-grid')).toBeInTheDocument();
      expect(screen.getByTestId('permissions-matrix')).toBeInTheDocument();
      expect(screen.getByText('System Administrator')).toBeInTheDocument();
    });
  });

  it('opens RoleAssignmentModal when clicking Manage Roles', async () => {
    setupAuth('admin');
    vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockUsersResponse);
    vi.spyOn(usersApi, 'getRoles').mockResolvedValue(mockRoles);
    vi.spyOn(usersApi, 'getPermissions').mockResolvedValue(mockPermissions);

    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('assign-roles-btn-table-u-1').length).toBeGreaterThan(0);
    });

    const assignBtns = screen.getAllByTestId('assign-roles-btn-table-u-1');
    fireEvent.click(assignBtns[0]!);

    await waitFor(() => {
      expect(screen.getByTestId('role-assignment-modal')).toBeInTheDocument();
    });
  });
});
