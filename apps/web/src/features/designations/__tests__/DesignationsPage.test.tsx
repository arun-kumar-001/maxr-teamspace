// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesignationsPage } from '../pages/DesignationsPage';
import * as designationsApi from '../api/designationsApi';
import { AuthProvider } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import type { DepartmentOption, Designation, DesignationListResponse } from '../types';

const sampleDepartments: DepartmentOption[] = [
  { id: 'dept-1', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-2', name: 'Product', code: 'PROD', isActive: true },
];

const sampleDesignations: Designation[] = [
  {
    id: 'desig-1',
    departmentId: 'dept-1',
    title: 'Staff Engineer',
    code: 'STAFF_ENG',
    level: 4,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'desig-2',
    departmentId: 'dept-2',
    title: 'Associate PM',
    code: 'APM',
    level: 2,
    isActive: false,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
];

describe('DesignationsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(designationsApi, 'fetchDepartmentOptions').mockResolvedValue(sampleDepartments);
    vi.spyOn(designationsApi, 'fetchDesignations').mockResolvedValue({
      data: sampleDesignations,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeletons on initial mount before data resolves', async () => {
    let resolveFn: ((val: DesignationListResponse) => void) | undefined;
    vi.spyOn(designationsApi, 'fetchDesignations').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    expect(screen.getByTestId('designation-loading-skeleton')).toBeDefined();

    resolveFn?.({
      data: sampleDesignations,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    await waitFor(() => {
      expect(screen.queryByTestId('designation-loading-skeleton')).toBeNull();
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });
  });

  it('renders designations list with table and cards, showing resolved department names and levels', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Associate PM').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Engineering').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Level 4').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Designations')).toBeDefined();
    expect(
      screen.getByText(
        'Manage organizational job titles, seniority levels, and department alignments',
      ),
    ).toBeDefined();
  });

  it('enforces RBAC: Admin can see Deactivate button, but HR Manager cannot', async () => {
    const { unmount } = render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });

    // Admin should see Deactivate buttons
    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    expect(deactivateButtons.length).toBeGreaterThan(0);

    unmount();

    // Now render as HR Manager
    render(
      <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });

    // HR Manager should NOT see any Deactivate buttons
    expect(screen.queryByRole('button', { name: /deactivate/i })).toBeNull();

    // HR Manager SHOULD still see Add Designation and Edit buttons
    expect(screen.getByRole('button', { name: /add designation/i })).toBeDefined();
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('opens create modal when clicking Add Designation', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });

    const addBtn = screen.getByRole('button', { name: /add designation/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('heading', { name: /create designation/i })).toBeDefined();
    });
  });

  it('opens detail modal when clicking View', async () => {
    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });

    const viewBtns = screen.getAllByTestId('table-view-desig-desig-1');
    fireEvent.click(viewBtns[0]!);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('heading', { name: /designation details/i })).toBeDefined();
      expect(screen.getByTestId('designation-detail-content')).toBeDefined();
    });
  });

  it('renders empty state when no designations are returned', async () => {
    vi.spyOn(designationsApi, 'fetchDesignations').mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No designations found')).toBeDefined();
    });
  });

  it('renders error state when fetch fails, and retries on button click', async () => {
    vi.spyOn(designationsApi, 'fetchDesignations').mockRejectedValueOnce(
      new designationsApi.DesignationsApiError('Network connection failed', 500),
    );

    render(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <DesignationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Designations')).toBeDefined();
      expect(screen.getByText('Network connection failed')).toBeDefined();
    });

    // Provide successful response for retry
    vi.spyOn(designationsApi, 'fetchDesignations').mockResolvedValueOnce({
      data: sampleDesignations,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getAllByText('Staff Engineer').length).toBeGreaterThan(0);
    });
  });
});
