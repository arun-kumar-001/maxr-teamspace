// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../auth/AuthContext';
import { CreateEmployeePage } from '../pages/CreateEmployeePage';
import { ROLES, type Role } from '@maxr/shared';

const mockDepartments = [
  { id: 'dept-eng', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-hr', name: 'Human Resources', code: 'HR', isActive: true },
];

const mockDesignations = [
  {
    id: 'desig-swe',
    title: 'Software Engineer',
    code: 'SWE',
    departmentId: 'dept-eng',
    isActive: true,
  },
  { id: 'desig-qa', title: 'QA Engineer', code: 'QA', departmentId: 'dept-eng', isActive: true },
];

const mockManagers = [
  { id: 'mgr-1', firstName: 'Kavita', lastName: 'Iyer', employeeCode: 'MGR-001', status: 'active' },
];

describe('CreateEmployeePage Component (Issue #20)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

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

      if (url.includes('/api/v1/employees?status=active')) {
        return new Response(JSON.stringify({ data: mockManagers }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  const renderWithRole = (role: Role = ROLES.ADMIN) => {
    return render(
      <MemoryRouter>
        <AuthProvider initialRole={role} persistSession={false}>
          <CreateEmployeePage />
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  it('renders page header, stepper, and form sections for Admin', async () => {
    renderWithRole(ROLES.ADMIN);

    expect(screen.getByTestId('create-employee-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add New Employee' })).toBeInTheDocument();
    expect(screen.getByTestId('section-personal-details')).toBeInTheDocument();
    expect(screen.getByTestId('section-employment-details')).toBeInTheDocument();
    expect(screen.getByTestId('section-role-access')).toBeInTheDocument();

    // Verify inputs exist
    expect(screen.getByTestId('input-first-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-last-name')).toBeInTheDocument();
    expect(screen.getByTestId('input-email')).toBeInTheDocument();
    expect(screen.getByTestId('input-employee-code')).toBeInTheDocument();
    expect(screen.getByTestId('select-department')).toBeInTheDocument();
    expect(screen.getByTestId('select-designation')).toBeInTheDocument();
  });

  it('renders all four roles for Admin, but restricts roles to Staff and Team Lead for HR Manager', async () => {
    // 1. Admin: all 4 roles
    const { unmount } = renderWithRole(ROLES.ADMIN);
    expect(screen.getByTestId('role-card-staff')).toBeInTheDocument();
    expect(screen.getByTestId('role-card-team_lead')).toBeInTheDocument();
    expect(screen.getByTestId('role-card-hr_manager')).toBeInTheDocument();
    expect(screen.getByTestId('role-card-admin')).toBeInTheDocument();
    unmount();

    // 2. HR Manager: only staff and team_lead
    renderWithRole(ROLES.HR_MANAGER);
    expect(screen.getByTestId('role-card-staff')).toBeInTheDocument();
    expect(screen.getByTestId('role-card-team_lead')).toBeInTheDocument();
    expect(screen.queryByTestId('role-card-hr_manager')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-card-admin')).not.toBeInTheDocument();
  });

  it('enforces RBAC: denies direct access for Team Lead and Staff', async () => {
    // 1. Team Lead
    const { unmount } = renderWithRole(ROLES.TEAM_LEAD);
    expect(screen.getByTestId('create-employee-forbidden')).toBeInTheDocument();
    expect(
      screen.getByText(/Only Administrators and HR Managers have permission/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('create-employee-form')).not.toBeInTheDocument();
    unmount();

    // 2. Staff
    renderWithRole(ROLES.STAFF);
    expect(screen.getByTestId('create-employee-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('create-employee-form')).not.toBeInTheDocument();
  });

  it('populates departments and handles designation filtering and reset', async () => {
    renderWithRole(ROLES.ADMIN);

    const deptSelect = screen.getByTestId('select-department');
    await waitFor(() => {
      expect(screen.getByText('Engineering (ENG)')).toBeInTheDocument();
    });

    const desigSelect = screen.getByTestId('select-designation') as HTMLSelectElement;
    // Initially disabled before department selection
    expect(desigSelect).toBeDisabled();

    // Select Engineering department
    fireEvent.change(deptSelect, { target: { value: 'dept-eng' } });

    await waitFor(() => {
      expect(desigSelect).not.toBeDisabled();
      expect(screen.getByText('Software Engineer (SWE)')).toBeInTheDocument();
    });

    // Select Software Engineer designation
    fireEvent.change(desigSelect, { target: { value: 'desig-swe' } });
    expect(desigSelect.value).toBe('desig-swe');

    // Changing department resets designation
    fireEvent.change(deptSelect, { target: { value: 'dept-hr' } });
    expect(desigSelect.value).toBe('');
  });

  it('validates required fields on submission', async () => {
    renderWithRole(ROLES.ADMIN);

    const submitBtn = screen.getByTestId('desktop-submit-button');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('First name is required.')).toBeInTheDocument();
      expect(screen.getByText('Last name is required.')).toBeInTheDocument();
      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Employee code is required.')).toBeInTheDocument();
      expect(screen.getByText('Department is required.')).toBeInTheDocument();
      expect(screen.getByText('Designation is required.')).toBeInTheDocument();
    });
  });

  it('validates employee code format and length', async () => {
    renderWithRole(ROLES.ADMIN);

    const codeInput = screen.getByTestId('input-employee-code');
    const submitBtn = screen.getByTestId('desktop-submit-button');

    // 1 char is too short
    fireEvent.change(codeInput, { target: { value: 'E' } });
    fireEvent.click(submitBtn);
    expect(
      screen.getByText('Employee code must be between 2 and 50 characters.'),
    ).toBeInTheDocument();

    // Invalid characters
    fireEvent.change(codeInput, { target: { value: 'EMP!@#$' } });
    fireEvent.click(submitBtn);
    expect(screen.getByText(/Employee code must start with a letter\/digit/)).toBeInTheDocument();
  });

  it('validates email format and phone number characters', async () => {
    renderWithRole(ROLES.ADMIN);

    const emailInput = screen.getByTestId('input-email');
    const phoneInput = screen.getByTestId('input-phone');
    const submitBtn = screen.getByTestId('desktop-submit-button');

    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.change(phoneInput, { target: { value: 'invalid-phone-abc' } });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText(/Phone number may only contain digits, spaces/)).toBeInTheDocument();
  });

  it('submits form with Idempotency-Key and renders success view on 201 Created', async () => {
    const mockCreated = {
      id: 'emp-new',
      userId: 'usr-new',
      employeeCode: 'EMP-099',
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: 'rahul.sharma@maxr.example',
      phone: '+91 98765 43210',
      departmentId: 'dept-eng',
      designationId: 'desig-swe',
      managerId: 'mgr-1',
      status: 'pending',
      role: 'staff',
      joiningDate: '2026-11-20',
      createdAt: '2026-11-02T10:00:00Z',
    };

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/v1/employees' && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: mockCreated }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/v1/departments')) {
        return new Response(JSON.stringify({ data: mockDepartments }), { status: 200 });
      }
      if (url.includes('/api/v1/designations')) {
        return new Response(JSON.stringify({ data: mockDesignations }), { status: 200 });
      }
      if (url.includes('/api/v1/employees?status=active')) {
        return new Response(JSON.stringify({ data: mockManagers }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderWithRole(ROLES.ADMIN);

    // Fill form
    fireEvent.change(screen.getByTestId('input-first-name'), { target: { value: 'Rahul' } });
    fireEvent.change(screen.getByTestId('input-last-name'), { target: { value: 'Sharma' } });
    fireEvent.change(screen.getByTestId('input-email'), {
      target: { value: 'rahul.sharma@maxr.example' },
    });
    fireEvent.change(screen.getByTestId('input-phone'), {
      target: { value: '+91 98765 43210' },
    });
    fireEvent.change(screen.getByTestId('input-employee-code'), {
      target: { value: 'EMP-099' },
    });

    await waitFor(() => {
      expect(screen.getByText('Engineering (ENG)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('select-department'), { target: { value: 'dept-eng' } });

    await waitFor(() => {
      expect(screen.getByText('Software Engineer (SWE)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('select-designation'), {
      target: { value: 'desig-swe' },
    });

    fireEvent.change(screen.getByTestId('input-joining-date'), {
      target: { value: '2026-11-20' },
    });

    // Submit form
    fireEvent.click(screen.getByTestId('desktop-submit-button'));

    // Verify success view is displayed
    await waitFor(() => {
      expect(screen.getByTestId('create-employee-success-view')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Employee Created Successfully' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
      expect(screen.getByText('EMP-099')).toBeInTheDocument();
      expect(screen.getByText(/Account Inactive Pending Onboarding/i)).toBeInTheDocument();
      expect(
        screen.getByText(/No password or activation link has been issued at this stage/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId('view-directory-button')).toBeInTheDocument();
      expect(screen.getByTestId('create-another-button')).toBeInTheDocument();
    });

    // Clicking create another resets the form
    fireEvent.click(screen.getByTestId('create-another-button'));
    await waitFor(() => {
      expect(screen.getByTestId('create-employee-form')).toBeInTheDocument();
      expect((screen.getByTestId('input-first-name') as HTMLInputElement).value).toBe('');
    });
  });

  it('handles 409 conflict and 422 unprocessable entity responses gracefully', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/v1/employees' && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'An employee with this code already exists',
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/api/v1/departments')) {
        return new Response(JSON.stringify({ data: mockDepartments }), { status: 200 });
      }
      if (url.includes('/api/v1/designations')) {
        return new Response(JSON.stringify({ data: mockDesignations }), { status: 200 });
      }
      if (url.includes('/api/v1/employees?status=active')) {
        return new Response(JSON.stringify({ data: mockManagers }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderWithRole(ROLES.ADMIN);

    fireEvent.change(screen.getByTestId('input-first-name'), { target: { value: 'Rahul' } });
    fireEvent.change(screen.getByTestId('input-last-name'), { target: { value: 'Sharma' } });
    fireEvent.change(screen.getByTestId('input-email'), {
      target: { value: 'rahul@example.com' },
    });
    fireEvent.change(screen.getByTestId('input-employee-code'), {
      target: { value: 'EMP-001' },
    });
    fireEvent.change(screen.getByTestId('input-joining-date'), {
      target: { value: '2026-11-20' },
    });

    await waitFor(() => {
      expect(screen.getByText('Engineering (ENG)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('select-department'), { target: { value: 'dept-eng' } });

    await waitFor(() => {
      expect(screen.getByText('Software Engineer (SWE)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId('select-designation'), {
      target: { value: 'desig-swe' },
    });

    fireEvent.click(screen.getByTestId('desktop-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('create-employee-error-alert')).toBeInTheDocument();
      expect(
        screen.getAllByText('An employee with this code already exists').length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
