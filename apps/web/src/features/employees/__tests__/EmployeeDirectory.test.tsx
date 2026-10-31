// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { EmployeeFilters } from '../components/EmployeeFilters';
import { EmployeeDirectoryPage } from '../pages/EmployeeDirectoryPage';
import * as employeesApi from '../api/employees';
import type { EmployeeDirectoryItem, EmployeeDirectoryResponse } from '../types';

afterEach(cleanup);

const MOCK_EMPLOYEE: EmployeeDirectoryItem = {
  id: 'emp-101',
  employeeCode: 'EMP-001',
  firstName: 'Arun',
  lastName: 'Kumar',
  email: 'arun@maxr.internal',
  phone: '+919876543210',
  department: {
    id: 'dept-01',
    name: 'Engineering',
    code: 'ENG',
  },
  designation: {
    id: 'desig-01',
    title: 'Lead Software Engineer',
    code: 'SWE-III',
    level: 3,
  },
  manager: {
    id: 'emp-100',
    firstName: 'Sara',
    lastName: 'Connor',
    employeeCode: 'EMP-000',
  },
  status: 'active',
  joiningDate: '2024-01-15',
  createdAt: '2024-01-15T09:00:00Z',
  updatedAt: '2024-01-15T09:00:00Z',
};

const MOCK_PENDING_EMPLOYEE: EmployeeDirectoryItem = {
  ...MOCK_EMPLOYEE,
  id: 'emp-102',
  employeeCode: 'EMP-002',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@maxr.internal',
  status: 'pending',
  manager: null,
};

const MOCK_DEACTIVATED_EMPLOYEE: EmployeeDirectoryItem = {
  ...MOCK_EMPLOYEE,
  id: 'emp-103',
  employeeCode: 'EMP-003',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@maxr.internal',
  status: 'deactivated',
};

const MOCK_RESPONSE: EmployeeDirectoryResponse = {
  data: [MOCK_EMPLOYEE, MOCK_PENDING_EMPLOYEE, MOCK_DEACTIVATED_EMPLOYEE],
  meta: {
    page: 1,
    pageSize: 20,
    total: 3,
    totalPages: 1,
  },
};

describe('Employee Directory Feature Suite (Issue #19)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(employeesApi, 'fetchDepartments').mockResolvedValue([
      { id: 'dept-01', name: 'Engineering', code: 'ENG' },
      { id: 'dept-02', name: 'Product', code: 'PROD' },
    ]);
    vi.spyOn(employeesApi, 'fetchDesignations').mockResolvedValue([
      { id: 'desig-01', title: 'Lead Software Engineer', code: 'SWE-III', level: 3 },
    ]);
  });

  describe('EmployeeFilters Component', () => {
    it('should render search, status, department, and designation filters with 44px touch targets', () => {
      render(
        <EmployeeFilters
          search=""
          status={undefined}
          departmentId=""
          designationId=""
          departments={[{ id: 'dept-01', name: 'Engineering', code: 'ENG' }]}
          designations={[{ id: 'desig-01', title: 'Engineer', code: 'ENG', level: 1 }]}
          onSearchChange={() => {}}
          onStatusChange={() => {}}
          onDepartmentChange={() => {}}
          onDesignationChange={() => {}}
          onReset={() => {}}
        />,
      );

      expect(screen.getByTestId('employee-filters')).toBeDefined();
      expect(screen.getByTestId('employee-search-input')).toBeDefined();
      expect(screen.getByTestId('employee-status-select')).toBeDefined();
      expect(screen.getByTestId('employee-department-select')).toBeDefined();
      expect(screen.getByTestId('employee-designation-select')).toBeDefined();
      expect(screen.queryByTestId('employee-filters-reset')).toBeNull();
    });

    it('should render Clear Filters button when active filters exist', () => {
      render(
        <EmployeeFilters
          search="Arun"
          status="active"
          departmentId="dept-01"
          designationId=""
          departments={[{ id: 'dept-01', name: 'Engineering', code: 'ENG' }]}
          designations={[]}
          onSearchChange={() => {}}
          onStatusChange={() => {}}
          onDepartmentChange={() => {}}
          onDesignationChange={() => {}}
          onReset={() => {}}
        />,
      );

      expect(screen.getByTestId('employee-filters-reset')).toBeDefined();
      expect(screen.getByText('Clear Filters')).toBeDefined();
    });
  });

  describe('EmployeeDirectoryPage Component', () => {
    it('should render page header, filter bar, and employee rows', async () => {
      vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockResolvedValue(MOCK_RESPONSE);

      render(<EmployeeDirectoryPage />);

      expect(screen.getByText('Employee Directory')).toBeDefined();
      expect(screen.getByTestId('employee-filters')).toBeDefined();

      await waitFor(() => {
        expect(screen.getAllByText('Arun Kumar').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('EMP-001').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Engineering').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should render empty state when 0 employees are returned', async () => {
      vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      });

      render(<EmployeeDirectoryPage />);

      await waitFor(() => {
        expect(screen.getByText('No employees found')).toBeDefined();
      });
    });

    it('should render forbidden state on 403 response', async () => {
      vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockRejectedValue(
        new employeesApi.ApiError(403, 'Forbidden', 'FORBIDDEN'),
      );

      render(<EmployeeDirectoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Access Restricted')).toBeDefined();
      });
    });

    it('should render error state on unexpected error', async () => {
      vi.spyOn(employeesApi, 'fetchEmployeeDirectory').mockRejectedValue(
        new Error('Network failure'),
      );

      render(<EmployeeDirectoryPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to Load Employees')).toBeDefined();
        expect(screen.getByText('Retry')).toBeDefined();
      });
    });
  });

  describe('API Client Layer', () => {
    it('should construct query string accurately for fetchEmployeeDirectory', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_RESPONSE,
      });
      globalThis.fetch = fetchSpy;

      await employeesApi.fetchEmployeeDirectory({
        page: 2,
        pageSize: 10,
        search: 'Kumar',
        status: 'active',
        departmentId: 'dept-123',
        sortBy: 'employeeCode',
        sortOrder: 'desc',
      });

      expect(fetchSpy).toHaveBeenCalled();
      const firstCall = fetchSpy.mock.calls[0];
      expect(firstCall).toBeDefined();
      const calledUrl = firstCall![0] as string;
      expect(calledUrl).toContain('/api/v1/employees?');
      expect(calledUrl).toContain('page=2');
      expect(calledUrl).toContain('pageSize=10');
      expect(calledUrl).toContain('search=Kumar');
      expect(calledUrl).toContain('status=active');
      expect(calledUrl).toContain('departmentId=dept-123');
      expect(calledUrl).toContain('sortBy=employeeCode');
      expect(calledUrl).toContain('sortOrder=desc');
    });

    it('should throw ApiError with status and message on API rejection', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this directory scope',
          },
        }),
      });

      await expect(employeesApi.fetchEmployeeDirectory()).rejects.toMatchObject({
        name: 'ApiError',
        status: 403,
        message: 'You do not have access to this directory scope',
        code: 'FORBIDDEN',
      });
    });
  });
});
