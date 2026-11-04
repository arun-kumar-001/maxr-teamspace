// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as hierarchyApi from '../api/hierarchy';
import { OrgChartPage } from '../pages/OrgChartPage';
import type { OrgNode } from '../types';

// Mock useAuth
const mockUser = {
  id: 'usr-1',
  employeeId: 'emp-admin',
  role: 'admin',
  roles: ['admin'],
};

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: mockUser.role,
    isAuthenticated: true,
  }),
}));

const mockRoots: OrgNode[] = [
  {
    id: 'root-1',
    employeeCode: 'CEO-001',
    name: 'Devon Miles',
    designation: 'Managing Director',
    status: 'active',
    directReportCount: 2,
  },
  {
    id: 'root-2',
    employeeCode: 'DIR-002',
    name: 'Sarah Connor',
    designation: 'Director of Technology',
    status: 'active',
    directReportCount: 0,
  },
];

const mockDirectReports: OrgNode[] = [
  {
    id: 'child-1',
    employeeCode: 'ENG-101',
    name: 'Michael Knight',
    designation: 'Lead Field Engineer',
    status: 'active',
    directReportCount: 0,
  },
];

describe('OrgChartPage Component (Issue #23)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(hierarchyApi, 'fetchOrgRoots').mockResolvedValue({
      data: mockRoots,
      meta: { page: 1, pageSize: 50, total: 2 },
    });
    vi.spyOn(hierarchyApi, 'fetchDirectReports').mockResolvedValue({
      data: mockDirectReports,
      meta: { page: 1, pageSize: 50, total: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders page header and loads root nodes', async () => {
    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Organization Hierarchy' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('org-chart-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Devon Miles')).toBeInTheDocument();
      expect(screen.getByText('CEO-001')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      expect(screen.getByText('DIR-002')).toBeInTheDocument();
      expect(screen.getByText('2 Reports')).toBeInTheDocument();
      expect(screen.getByText('No direct reports')).toBeInTheDocument();
    });
  });

  it('expands a node to load and show direct reports on click', async () => {
    const fetchDirectSpy = vi.spyOn(hierarchyApi, 'fetchDirectReports');

    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Devon Miles')).toBeInTheDocument();
    });

    const toggleBtn = screen.getByTestId('toggle-expand-root-1');
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(fetchDirectSpy).toHaveBeenCalledWith('root-1', expect.anything());
      expect(screen.getByText('Michael Knight')).toBeInTheDocument();
      expect(screen.getByText('ENG-101')).toBeInTheDocument();
    });

    // Clicking toggle button again collapses child branch
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.queryByText('Michael Knight')).not.toBeInTheDocument();
    });
  });

  it('collapses all open branches when Collapse All button is clicked', async () => {
    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Devon Miles')).toBeInTheDocument();
    });

    // Expand
    fireEvent.click(screen.getByTestId('toggle-expand-root-1'));
    await waitFor(() => {
      expect(screen.getByText('Michael Knight')).toBeInTheDocument();
    });

    // Click Collapse All
    const collapseBtn = screen.getByTestId('collapse-all-btn');
    fireEvent.click(collapseBtn);

    await waitFor(() => {
      expect(screen.queryByText('Michael Knight')).not.toBeInTheDocument();
    });
  });

  it('filters by status when filter buttons are toggled', async () => {
    const fetchRootsSpy = vi.spyOn(hierarchyApi, 'fetchOrgRoots');

    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Devon Miles')).toBeInTheDocument();
    });

    // Click "All Statuses"
    const allBtn = screen.getByTestId('filter-all-btn');
    fireEvent.click(allBtn);

    await waitFor(() => {
      expect(fetchRootsSpy).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
    });
  });

  it('opens ChangeManagerModal when Change Manager button is clicked', async () => {
    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('change-manager-btn-root-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('change-manager-btn-root-1'));

    await waitFor(() => {
      expect(screen.getByText('Change Reporting Manager')).toBeInTheDocument();
      expect(screen.getByTestId('change-manager-form')).toBeInTheDocument();
    });
  });

  it('renders ForbiddenState when user does not have permission (403)', async () => {
    vi.spyOn(hierarchyApi, 'fetchOrgRoots').mockRejectedValue(
      new hierarchyApi.HierarchyApiError(403, 'Forbidden'),
    );

    render(
      <MemoryRouter>
        <OrgChartPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('org-chart-forbidden')).toBeInTheDocument();
      expect(screen.getByText(/You do not have permission/i)).toBeInTheDocument();
    });
  });
});
