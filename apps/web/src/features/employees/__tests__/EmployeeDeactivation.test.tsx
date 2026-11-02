// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { EmployeeDirectoryPage } from '../pages/EmployeeDirectoryPage';
import { EmployeeDeactivationPage } from '../pages/EmployeeDeactivationPage';
import * as deactivationApi from '../api/deactivation';
import * as employeesApi from '../api/employees';
import * as authContext from '../../../auth/AuthContext';
import type { EmployeeDirectoryItem, EmployeeDirectoryResponse } from '../types';
import type { DeactivationResult } from '../types/deactivation';

afterEach(cleanup);

const MOCK_TARGET_EMPLOYEE = {
  id: 'emp-201',
  employeeCode: 'EMP-201',
  firstName: 'Sarah',
  lastName: 'Connor',
  department: { name: 'Operations', id: 'dept-ops', code: 'OPS' },
  designation: { title: 'Operations Manager', id: 'desig-mgr', code: 'MGR', level: 2 },
};

const MOCK_DEACTIVATION_RESULT: DeactivationResult = {
  id: 'emp-201',
  status: 'deactivated',
  deactivatedAt: '2026-11-02T10:00:00Z',
  version: 2,
  alreadyDeactivated: false,
  sessionsRevoked: 2,
  directReports: [
    { id: 'emp-301', employeeCode: 'EMP-301', name: 'John Connor' },
    { id: 'emp-302', employeeCode: 'EMP-302', name: 'Kyle Reese' },
  ],
};

const MOCK_EMPLOYEE_LIST: EmployeeDirectoryItem[] = [
  {
    id: 'emp-admin',
    employeeCode: 'EMP-001',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@maxr.internal',
    phone: '+919999999999',
    department: { id: 'dept-1', name: 'Executive', code: 'EXEC' },
    designation: { id: 'des-1', title: 'Director', code: 'DIR', level: 1 },
    manager: null,
    status: 'active',
    joiningDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'emp-201',
    employeeCode: 'EMP-201',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'sarah@maxr.internal',
    phone: '+919876543210',
    department: { id: 'dept-ops', name: 'Operations', code: 'OPS' },
    designation: { id: 'desig-mgr', title: 'Operations Manager', code: 'MGR', level: 2 },
    manager: null,
    status: 'active',
    joiningDate: '2024-02-01',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'emp-202',
    employeeCode: 'EMP-202',
    firstName: 'Deactivated',
    lastName: 'Person',
    email: 'inactive@maxr.internal',
    phone: null,
    department: { id: 'dept-ops', name: 'Operations', code: 'OPS' },
    designation: { id: 'desig-mgr', title: 'Operations Lead', code: 'LEAD', level: 3 },
    manager: null,
    status: 'deactivated',
    joiningDate: '2023-01-01',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
];

const MOCK_DIRECTORY_RESPONSE: EmployeeDirectoryResponse = {
  data: MOCK_EMPLOYEE_LIST,
  meta: {
    page: 1,
    pageSize: 10,
    total: 3,
    totalPages: 1,
  },
};

describe('Employee Deactivation Feature Suite (Issue #26)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DeactivateEmployeeModal', () => {
    it('does not render when employee is null', () => {
      render(
        <MemoryRouter>
          <DeactivateEmployeeModal isOpen={true} onClose={() => {}} employee={null} />
        </MemoryRouter>,
      );
      expect(screen.queryByTestId('deactivate-employee-modal')).toBeNull();
    });

    it('renders warning information, employee name, code, and calls API on confirm', async () => {
      const deactivateSpy = vi
        .spyOn(deactivationApi, 'deactivateEmployee')
        .mockResolvedValue(MOCK_DEACTIVATION_RESULT);
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      render(
        <MemoryRouter>
          <DeactivateEmployeeModal
            isOpen={true}
            onClose={handleClose}
            employee={MOCK_TARGET_EMPLOYEE}
            onSuccess={handleSuccess}
          />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('deactivate-employee-modal')).toBeDefined();
      expect(screen.getByText(/Sarah Connor/)).toBeDefined();
      expect(screen.getByText(/EMP-201/)).toBeDefined();
      expect(screen.getByText(/Warning: Irreversible Account Deactivation/i)).toBeDefined();

      const confirmBtn = screen.getByTestId('confirm-deactivation-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(deactivateSpy).toHaveBeenCalledWith('emp-201');
      });

      // Post-deactivation summary displayed
      expect(screen.getByTestId('deactivation-summary')).toBeDefined();
      expect(screen.getByText(/Successfully Deactivated/i)).toBeDefined();
      expect(screen.getByText(/Sessions ended: 2/i)).toBeDefined();

      // Direct reports callout displayed
      expect(screen.getByTestId('direct-reports-warning')).toBeDefined();
      expect(screen.getByText(/John Connor/i)).toBeDefined();
      expect(screen.getByText(/Kyle Reese/i)).toBeDefined();

      // Click Done
      const doneBtn = screen.getByTestId('deactivation-done-btn');
      fireEvent.click(doneBtn);

      expect(handleSuccess).toHaveBeenCalledWith(MOCK_DEACTIVATION_RESULT);
      expect(handleClose).toHaveBeenCalled();
    });

    it('displays error alert when API returns error (e.g. 422 self deactivation)', async () => {
      vi.spyOn(deactivationApi, 'deactivateEmployee').mockRejectedValue(
        new deactivationApi.ApiError(422, 'Cannot deactivate the last active Admin'),
      );

      render(
        <MemoryRouter>
          <DeactivateEmployeeModal
            isOpen={true}
            onClose={() => {}}
            employee={MOCK_TARGET_EMPLOYEE}
          />
        </MemoryRouter>,
      );

      const confirmBtn = screen.getByTestId('confirm-deactivation-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByTestId('deactivation-error-alert')).toBeDefined();
      });

      expect(screen.getByText('Cannot deactivate the last active Admin')).toBeDefined();
    });

    it('handles alreadyDeactivated: true idempotently', async () => {
      vi.spyOn(deactivationApi, 'deactivateEmployee').mockResolvedValue({
        ...MOCK_DEACTIVATION_RESULT,
        alreadyDeactivated: true,
        sessionsRevoked: 0,
        directReports: [],
      });

      render(
        <MemoryRouter>
          <DeactivateEmployeeModal
            isOpen={true}
            onClose={() => {}}
            employee={MOCK_TARGET_EMPLOYEE}
          />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByTestId('confirm-deactivation-btn'));

      await waitFor(() => {
        expect(screen.getByText('Already Deactivated')).toBeDefined();
      });

      expect(screen.getByTestId('no-direct-reports')).toBeDefined();
    });
  });

  describe('EmployeeDirectoryPage Actions & Role Isolation', () => {
    beforeEach(() => {
      vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockResolvedValue(MOCK_DIRECTORY_RESPONSE);
      vi.spyOn(employeesApi, 'fetchDepartments').mockResolvedValue([]);
      vi.spyOn(employeesApi, 'fetchDesignations').mockResolvedValue([]);
    });

    it('shows Deactivate action for Admin on other active employees but hides on self and already deactivated', async () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'admin',
        user: {
          id: 'u-admin',
          employeeId: 'emp-admin',
          role: 'admin',
          roles: ['admin'],
          permissions: ['employees.deactivate'],
          email: 'admin@maxr.internal',
          name: 'Admin User',
          avatarInitials: 'AU',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter>
          <EmployeeDirectoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('employee-directory-page')).toBeDefined();
      });

      // Desktop table Actions column:
      // Self employee row has (Current User)
      expect(screen.getAllByText('(Current User)').length).toBeGreaterThan(0);

      // Active other employee has Deactivate button
      expect(screen.getAllByTestId('deactivate-btn-table-emp-201').length).toBeGreaterThan(0);

      // Mobile card has Deactivate button
      expect(screen.getByTestId('deactivate-btn-card-emp-201')).toBeDefined();
      expect(screen.queryByTestId('deactivate-btn-card-emp-admin')).toBeNull();
      expect(screen.queryByTestId('deactivate-btn-card-emp-202')).toBeNull();
    });

    it('does NOT render Deactivate buttons for HR Manager (Admin only per D-23)', async () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'hr_manager',
        user: {
          id: 'u-hr',
          employeeId: 'emp-hr',
          role: 'hr_manager',
          roles: ['hr_manager'],
          permissions: [],
          email: 'hr@maxr.internal',
          name: 'HR Manager',
          avatarInitials: 'HM',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter>
          <EmployeeDirectoryPage />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('employee-directory-page')).toBeDefined();
      });

      expect(screen.queryByTestId('deactivate-btn-table-emp-201')).toBeNull();
      expect(screen.queryByTestId('deactivate-btn-card-emp-201')).toBeNull();
    });
  });

  describe('EmployeeDeactivationPage Route Guard & Self-Deactivation Denial', () => {
    it('denies access to non-admin roles', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'hr_manager',
        user: {
          id: 'u-hr',
          employeeId: 'emp-hr',
          role: 'hr_manager',
          roles: ['hr_manager'],
          permissions: [],
          email: 'hr@maxr.internal',
          name: 'HR',
          avatarInitials: 'HR',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/admin/employees/emp-201/deactivate']}>
          <Routes>
            <Route path="/admin/employees/:id/deactivate" element={<EmployeeDeactivationPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('deactivation-page-forbidden')).toBeDefined();
      expect(screen.getByText('Access Restricted')).toBeDefined();
    });

    it('denies self-deactivation when admin attempts to deactivate themselves', () => {
      vi.spyOn(authContext, 'useAuth').mockReturnValue({
        role: 'admin',
        user: {
          id: 'u-admin',
          employeeId: 'emp-admin',
          role: 'admin',
          roles: ['admin'],
          permissions: ['employees.deactivate'],
          email: 'admin@maxr.internal',
          name: 'Admin',
          avatarInitials: 'AD',
        },
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={['/admin/employees/emp-admin/deactivate']}>
          <Routes>
            <Route path="/admin/employees/:id/deactivate" element={<EmployeeDeactivationPage />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('deactivation-page-self')).toBeDefined();
      expect(screen.getByText('Self-Deactivation Not Permitted')).toBeDefined();
    });
  });
});
