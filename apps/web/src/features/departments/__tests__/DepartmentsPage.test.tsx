// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DepartmentsPage } from '../pages/DepartmentsPage';
import * as departmentsApi from '../api/departmentsApi';
import { AuthProvider } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import type { Department, DepartmentListResponse } from '../types';

const sampleDepartments: Department[] = [
  {
    id: 'dept-1',
    name: 'Engineering',
    code: 'ENG',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'dept-2',
    name: 'Marketing',
    code: 'MKT',
    isActive: false,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
];

describe('DepartmentsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(departmentsApi, 'fetchDepartments').mockResolvedValue({
      data: sampleDepartments,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeletons on initial mount before data resolves', async () => {
    let resolveFn: ((val: DepartmentListResponse) => void) | undefined;
    vi.spyOn(departmentsApi, 'fetchDepartments').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    expect(screen.getByTestId('department-loading-skeleton')).toBeDefined();

    resolveFn?.({
      data: sampleDepartments,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    await waitFor(() => {
      expect(screen.queryByTestId('department-loading-skeleton')).toBeNull();
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });
  });

  it('renders departments list with table and cards', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
    });

    // Check header
    expect(screen.getByText('Departments')).toBeDefined();
    expect(
      screen.getByText(
        'Manage organizational divisions, functional units, and reporting structures',
      ),
    ).toBeDefined();
  });

  it('enforces RBAC: Admin can see Deactivate button, but HR Manager cannot', async () => {
    const { unmount } = render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });

    // Admin should see Deactivate buttons (in table or cards)
    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    expect(deactivateButtons.length).toBeGreaterThan(0);

    unmount();

    // Now render as HR Manager
    render(
      <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });

    // HR Manager should NOT see any Deactivate buttons
    expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull();

    // HR Manager SHOULD still see Add Department and Edit buttons
    expect(screen.getByRole('button', { name: /add department/i })).toBeDefined();
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('opens create modal when clicking Add Department', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });

    const addBtn = screen.getByRole('button', { name: /add department/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('heading', { name: /create department/i })).toBeDefined();
    });
  });

  it('opens detail modal when clicking View', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });

    const viewBtns = screen.getAllByTestId('table-view-dept-dept-1');
    fireEvent.click(viewBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('heading', { name: /department details/i })).toBeDefined();
      expect(screen.getByTestId('department-detail-content')).toBeDefined();
    });
  });

  it('renders empty state when no departments are returned', async () => {
    vi.spyOn(departmentsApi, 'fetchDepartments').mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No departments found')).toBeDefined();
    });
  });

  it('renders error state when fetch fails, and retries on button click', async () => {
    vi.spyOn(departmentsApi, 'fetchDepartments').mockRejectedValueOnce(
      new departmentsApi.DepartmentsApiError('Network connection failed', 500),
    );

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DepartmentsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Departments')).toBeDefined();
      expect(screen.getByText('Network connection failed')).toBeDefined();
    });

    // Provide successful response for retry
    vi.spyOn(departmentsApi, 'fetchDepartments').mockResolvedValueOnce({
      data: sampleDepartments,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
    });
  });
});
