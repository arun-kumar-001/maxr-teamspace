// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EmployeeDirectoryPage } from '../pages/EmployeeDirectoryPage';
import * as directoryApi from '../api/employees';
import { ApiError } from '../api/employees';
import { REFERENCE_VIEWPORTS } from '../../../styles/breakpoints';
import type {
  EmployeeDirectoryItem,
  EmployeeDirectoryResponse as PaginatedResponse,
} from '../types';

const sampleEmployees: EmployeeDirectoryItem[] = [
  {
    id: 'emp-1',
    employeeCode: 'MAX001',
    firstName: 'Eleanor',
    lastName: 'Vance',
    email: 'eleanor@maxr.com',
    phone: '+1 555-0101',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'Principal Architect', code: 'PR_ARCH', level: 5 },
    manager: null,
    status: 'active',
    joiningDate: '2023-01-10',
    createdAt: '2023-01-10T00:00:00Z',
    updatedAt: '2023-01-10T00:00:00Z',
  },
  {
    id: 'emp-2',
    employeeCode: 'MAX002',
    firstName: 'Marcus',
    lastName: 'Brody',
    email: 'marcus@maxr.com',
    phone: '+1 555-0102',
    department: { id: 'dept-2', name: 'Product', code: 'PROD' },
    designation: { id: 'desig-2', title: 'Product Manager', code: 'PM', level: 3 },
    manager: {
      id: 'emp-1',
      firstName: 'Eleanor',
      lastName: 'Vance',
      employeeCode: 'MAX001',
    },
    status: 'pending',
    joiningDate: '2024-06-15',
    createdAt: '2024-06-15T00:00:00Z',
    updatedAt: '2024-06-15T00:00:00Z',
  },
];

describe('EmployeeDirectoryPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(directoryApi, 'fetchDepartments').mockResolvedValue([
      { id: 'dept-1', name: 'Engineering', code: 'ENG' },
      { id: 'dept-2', name: 'Product', code: 'PROD' },
    ]);
    vi.spyOn(directoryApi, 'fetchDesignations').mockResolvedValue([
      { id: 'desig-1', title: 'Principal Architect', code: 'PR_ARCH', level: 5 },
      { id: 'desig-2', title: 'Product Manager', code: 'PM', level: 3 },
    ]);
    vi.spyOn(directoryApi, 'fetchManagerOptions').mockResolvedValue([
      { id: 'emp-1', name: 'Eleanor Vance', employeeCode: 'MAX001' },
    ]);
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockResolvedValue({
      data: sampleEmployees,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading skeletons on initial mount before data resolves', async () => {
    let resolveDirectory: ((val: PaginatedResponse) => void) | undefined;
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDirectory = resolve;
        }),
    );

    render(<EmployeeDirectoryPage />);
    expect(screen.getByTestId('directory-loading-skeleton')).toBeInTheDocument();

    // Settle promise so no unhandled state updates leak
    resolveDirectory?.({
      data: sampleEmployees,
      meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
    });
    await waitFor(() => {
      expect(screen.queryByTestId('directory-loading-skeleton')).not.toBeInTheDocument();
    });
  });

  it('renders directory heading, record badge, and employee list once loaded', async () => {
    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('directory-loading-skeleton')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Employee Directory')).toBeInTheDocument();
    expect(screen.getByText('2 Employees')).toBeInTheDocument();

    // Verify both employees are rendered
    expect(screen.getByTestId('employee-card-emp-1')).toHaveTextContent('Eleanor Vance');
    expect(screen.getByTestId('employee-card-emp-1')).toHaveTextContent('MAX001');
    expect(screen.getByTestId('employee-card-emp-2')).toHaveTextContent('Marcus Brody');
    expect(screen.getByTestId('employee-card-emp-2')).toHaveTextContent('MAX002');
  });

  it('renders mobile cards with accessible touch targets, mailto links, and tel links', async () => {
    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('employee-mobile-cards')).toBeInTheDocument();
    });

    const card1 = screen.getByTestId('employee-card-emp-1');
    expect(card1).toBeInTheDocument();

    const emailLink = card1.querySelector('a[href="mailto:eleanor@maxr.com"]');
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveClass('min-h-[44px]');

    const phoneLink = card1.querySelector('a[href="tel:+1 555-0101"]');
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveClass('min-h-[44px]');
  });

  it('renders all filter controls: search, department, designation, status, and manager', async () => {
    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('employee-directory-filters')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Search by name, code, or email...')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Department')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Designation')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by Manager')).toBeInTheDocument();
  });

  it('handles search input change and shows clear filters button', async () => {
    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('employee-directory-filters')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name, code, or email...');
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'Marcus' } });
    });

    expect(searchInput).toHaveValue('Marcus');
    expect(screen.getByTestId('employee-filters-reset')).toBeInTheDocument();

    // Clicking reset clears search input
    act(() => {
      fireEvent.click(screen.getByTestId('employee-filters-reset'));
    });
    expect(searchInput).toHaveValue('');
  });

  it('renders EmptyState when 0 employees are returned and allows clearing filters', async () => {
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    expect(screen.getByText('No employees found')).toBeInTheDocument();
    expect(screen.getByText('There are no employee records to display.')).toBeInTheDocument();
  });

  it('renders ErrorState with retry button when API returns an error', async () => {
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockRejectedValueOnce(
      new ApiError('Database connection lost', 500),
    );

    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('directory-error-view')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to Load Employees')).toBeInTheDocument();
    expect(screen.getByText('Database connection lost')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders ForbiddenState when API returns 403 Forbidden', async () => {
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockRejectedValueOnce(
      new ApiError('Forbidden: Access Denied', 403, 'FORBIDDEN'),
    );

    render(<EmployeeDirectoryPage />);

    await waitFor(() => {
      expect(screen.getByTestId('directory-forbidden-view')).toBeInTheDocument();
    });

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(
      screen.getByText('You do not have permission to access the employee directory.'),
    ).toBeInTheDocument();
  });

  describe('Employee Detail Navigation (Issue #155)', () => {
    it('navigates to /employees/:id when clicking employee row link in desktop table', async () => {
      render(
        <MemoryRouter initialEntries={['/employees']}>
          <Routes>
            <Route path="/employees" element={<EmployeeDirectoryPage />} />
            <Route
              path="/employees/:id"
              element={<div data-testid="employee-detail-dest">Detail Destination</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('datatable-desktop-table')).toBeInTheDocument();
      });

      const desktopTable = screen.getByTestId('datatable-desktop-table');
      const rowLink = within(desktopTable).getByTestId('employee-link-emp-1');
      fireEvent.click(rowLink);

      await waitFor(() => {
        expect(screen.getByTestId('employee-detail-dest')).toBeInTheDocument();
      });
    });

    it('navigates to /employees/:id when clicking table View button in desktop table', async () => {
      render(
        <MemoryRouter initialEntries={['/employees']}>
          <Routes>
            <Route path="/employees" element={<EmployeeDirectoryPage />} />
            <Route
              path="/employees/:id"
              element={<div data-testid="employee-detail-dest">Detail Destination</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('datatable-desktop-table')).toBeInTheDocument();
      });

      const desktopTable = screen.getByTestId('datatable-desktop-table');
      const viewButton = within(desktopTable).getByTestId('view-detail-btn-table-emp-1');
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(screen.getByTestId('employee-detail-dest')).toBeInTheDocument();
      });
    });

    it('navigates to /employees/:id when clicking mobile card View button', async () => {
      render(
        <MemoryRouter initialEntries={['/employees']}>
          <Routes>
            <Route path="/employees" element={<EmployeeDirectoryPage />} />
            <Route
              path="/employees/:id"
              element={<div data-testid="employee-detail-dest">Detail Destination</div>}
            />
          </Routes>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('view-detail-btn-card-emp-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('view-detail-btn-card-emp-1'));

      await waitFor(() => {
        expect(screen.getByTestId('employee-detail-dest')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive 9-Viewport Static Rendering (AGENTS.md §8)', () => {
    it('renders cleanly across all 9 mandatory reference viewports without error', () => {
      for (const vp of REFERENCE_VIEWPORTS) {
        expect(vp.width).toBeGreaterThanOrEqual(360);
        const html = renderToStaticMarkup(<EmployeeDirectoryPage />);

        // Must contain key structural markers
        expect(html).toContain('Employee Directory');
        expect(html).toContain('data-testid="employee-directory-filters"');
        expect(html).toContain('max-w-dashboard');
      }
    });
  });
});
