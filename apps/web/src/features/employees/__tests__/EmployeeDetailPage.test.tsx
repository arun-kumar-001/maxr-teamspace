// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../auth/AuthContext';
import { EmployeeDetailPage } from '../pages/EmployeeDetailPage';
import type { EmployeeDetail } from '../types';

const mockEmployeeAdminView: EmployeeDetail = {
  id: 'emp-1',
  employeeCode: 'EMP-001',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '+91 98765 43210',
  department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-swe', title: 'Software Engineer', code: 'SWE' },
  manager: { id: 'mgr-1', firstName: 'Kavita', lastName: 'Iyer', employeeCode: 'MGR-001' },
  status: 'active',
  joiningDate: '2026-01-15',
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-01-15T09:00:00Z',
  version: 1,
  account: {
    userId: 'usr-123',
    isActive: true,
    lastLoginAt: '2026-11-01T10:00:00Z',
    roles: ['staff'],
  },
};

const mockEmployeeStaffView: EmployeeDetail = {
  ...mockEmployeeAdminView,
  id: 'emp-staff-view',
  account: undefined, // Omitted for non-HR/Admin callers
};

const mockDeactivatedEmployee: EmployeeDetail = {
  ...mockEmployeeAdminView,
  id: 'emp-deactivated',
  status: 'deactivated',
};

const mockDepartments = [
  { id: 'dept-eng', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-product', name: 'Product', code: 'PROD', isActive: true },
];

const mockDesignations = [
  {
    id: 'desig-swe',
    title: 'Software Engineer',
    code: 'SWE',
    departmentId: 'dept-eng',
    isActive: true,
  },
  {
    id: 'desig-pm',
    title: 'Product Manager',
    code: 'PM',
    departmentId: 'dept-product',
    isActive: true,
  },
];

function renderWithProviders(
  initialRoute: string,
  userRole: 'admin' | 'hr_manager' | 'staff' = 'admin',
) {
  return render(
    <AuthProvider initialRole={userRole} persistSession={false}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetailPage />} />
          <Route path="/employees" element={<div data-testid="directory-page">Directory</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('EmployeeDetailPage Component (Issue #21)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/api/v1/departments')) {
        return new Response(JSON.stringify({ data: mockDepartments }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/designations')) {
        return new Response(JSON.stringify({ data: mockDesignations }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-1/documents')) {
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-1')) {
        if (method === 'PUT') {
          const body = JSON.parse(String(init?.body || '{}'));
          if (body.version !== 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'CONFLICT',
                  message: 'This employee was changed by someone else. Reload and try again',
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            );
          }
          return new Response(
            JSON.stringify({
              data: {
                ...mockEmployeeAdminView,
                ...body,
                version: 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ data: mockEmployeeAdminView }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-staff-view')) {
        return new Response(JSON.stringify({ data: mockEmployeeStaffView }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-deactivated')) {
        return new Response(JSON.stringify({ data: mockDeactivatedEmployee }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/unknown-404')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Employee not found',
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/v1/employees/forbidden-403')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Access restricted',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ data: mockEmployeeAdminView }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders employee detail header, status, and job info correctly', async () => {
    renderWithProviders('/employees/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // Check header information
    expect(screen.getByRole('heading', { level: 1, name: /Jane Doe/i })).toBeInTheDocument();
    expect(screen.getByText('EMP-001')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/v1/).length).toBeGreaterThan(0);

    // Check Job info tab
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getAllByText(/Engineering/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Software Engineer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Kavita Iyer/i)).toBeInTheDocument();
  });

  it('displays Account & Security tab when account information is present for Admin', async () => {
    renderWithProviders('/employees/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // Account tab button should exist
    const accountTabBtn = screen.getByRole('radio', { name: /Account & Security/i });
    expect(accountTabBtn).toBeInTheDocument();

    // Click tab
    fireEvent.click(accountTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('tab-account')).toBeInTheDocument();
    });

    expect(screen.getByText('usr-123')).toBeInTheDocument();
    expect(screen.getByText('Active Login')).toBeInTheDocument();
    expect(screen.getByText('STAFF')).toBeInTheDocument();
  });

  it('hides Account & Security tab when account information is omitted for Staff', async () => {
    renderWithProviders('/employees/emp-staff-view', 'staff');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // Account tab button should NOT be in the DOM
    expect(screen.queryByRole('radio', { name: /Account & Security/i })).not.toBeInTheDocument();
  });

  it('renders error state when employee is not found (404)', async () => {
    renderWithProviders('/employees/unknown-404', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-not-found')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Employee Not Found/i })).toBeInTheDocument();
  });

  it('renders forbidden state when access is restricted (403)', async () => {
    renderWithProviders('/employees/forbidden-403', 'staff');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-forbidden')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
  });

  it('renders deactivated notice banner when viewing a deactivated employee and disallows edit', async () => {
    renderWithProviders('/employees/emp-deactivated', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deactivated-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-employee-btn')).not.toBeInTheDocument();
  });

  it('allows Admin to edit employee details and send optimistic version', async () => {
    renderWithProviders('/employees/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    // Open edit modal
    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Both code and email should be editable for Admin
    expect(screen.getByTestId('edit-employee-code-input')).not.toBeDisabled();
    expect(screen.getByTestId('edit-email-input')).not.toBeDisabled();

    // Change first name
    fireEvent.change(screen.getByTestId('edit-first-name-input'), {
      target: { value: 'Janet' },
    });

    // Save changes
    const saveBtn = screen.getByTestId('save-employee-button');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    // Modal closes on success and updates to v2
    await waitFor(() => {
      expect(screen.queryByTestId('edit-first-name-input')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Janet Doe/i })).toBeInTheDocument();
      expect(screen.getAllByText(/v2/).length).toBeGreaterThan(0);
    });
  });

  it('restricts employee code and email to read-only for HR Manager', async () => {
    renderWithProviders('/employees/emp-1', 'hr_manager');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Code and email must be read-only for HR
    expect(screen.getByTestId('edit-employee-code-input')).toBeDisabled();
    expect(screen.getByTestId('edit-email-input')).toBeDisabled();
    expect(screen.getAllByText(/Only Administrators can change/i).length).toBeGreaterThan(0);
  });

  it('handles 409 concurrency conflict by presenting a conflict banner and reload button', async () => {
    renderWithProviders('/employees/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Change first name to trigger save
    fireEvent.change(screen.getByTestId('edit-first-name-input'), {
      target: { value: 'ConflictTest' },
    });

    // Mock fetch to simulate 409 Conflict on PUT
    fetchMock.mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'This employee was changed by someone else. Reload and try again',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    });

    fireEvent.click(screen.getByTestId('save-employee-button'));

    // Conflict banner should appear
    await waitFor(() => {
      expect(screen.getByTestId('conflict-alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Concurrent Update Conflict \(409\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('reload-latest-button')).toBeInTheDocument();
  });
});
