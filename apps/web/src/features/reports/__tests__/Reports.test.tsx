// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { ReportsPage } from '../pages/ReportsPage';
import * as reportsApi from '../api/reportsApi';
import * as departmentsApi from '../../departments/api/departmentsApi';
import * as projectsApi from '../../projects/api/projectsApi';
import * as leaveApi from '../../leave/api/leave';
import type { ReportPreviewResponse, ReportSummary } from '../types';

vi.mock('../api/reportsApi', async () => {
  const actual = await vi.importActual<typeof reportsApi>('../api/reportsApi');
  return {
    ...actual,
    fetchReportCatalog: vi.fn(),
    previewReport: vi.fn(),
    exportReport: vi.fn(),
  };
});

vi.mock('../../departments/api/departmentsApi', async () => {
  const actual = await vi.importActual<typeof departmentsApi>(
    '../../departments/api/departmentsApi',
  );
  return {
    ...actual,
    fetchDepartments: vi.fn(),
  };
});

vi.mock('../../projects/api/projectsApi', async () => {
  const actual = await vi.importActual<typeof projectsApi>('../../projects/api/projectsApi');
  return {
    ...actual,
    fetchProjects: vi.fn(),
  };
});

vi.mock('../../leave/api/leave', async () => {
  const actual = await vi.importActual<typeof leaveApi>('../../leave/api/leave');
  return {
    ...actual,
    fetchLeavePolicies: vi.fn(),
  };
});

const mockCatalog: ReportSummary[] = [
  {
    name: 'attendance-summary',
    title: 'Attendance summary',
    description: 'Days worked, late, half days, on leave and absent per employee',
    module: 'attendance',
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'workingDays', label: 'Working days' },
      { key: 'daysPresent', label: 'Days present' },
      { key: 'daysLate', label: 'Days late' },
      { key: 'daysAbsent', label: 'Days absent' },
    ],
  },
  {
    name: 'leave-usage',
    title: 'Leave balance and usage',
    description: 'Days allotted, used, pending approval and remaining per employee',
    module: 'leave',
    columns: [
      { key: 'employeeCode', label: 'Code' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'leaveType', label: 'Leave type' },
      { key: 'allotted', label: 'Allotted' },
      { key: 'used', label: 'Used' },
      { key: 'remaining', label: 'Remaining' },
    ],
  },
  {
    name: 'project-status',
    title: 'Project status',
    description: 'Tasks completed, overdue, and percent complete per project',
    module: 'projects',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Project' },
      { key: 'status', label: 'Status' },
      { key: 'percentComplete', label: 'Complete %' },
    ],
  },
];

const mockAttendanceRows: ReportPreviewResponse = {
  data: [
    {
      employeeCode: 'EMP-001',
      employeeName: 'Sarah Connor',
      department: 'Engineering',
      workingDays: 22,
      daysPresent: 20,
      daysLate: 1,
      daysAbsent: 1,
    },
    {
      employeeCode: 'EMP-002',
      employeeName: 'John Smith',
      department: 'Product',
      workingDays: 22,
      daysPresent: 22,
      daysLate: 0,
      daysAbsent: 0,
    },
  ],
  meta: {
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
  },
};

describe('Reports Feature Suite (Issue #15 & #47)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportsApi.fetchReportCatalog).mockResolvedValue(mockCatalog);
    vi.mocked(reportsApi.previewReport).mockResolvedValue(mockAttendanceRows);
    vi.mocked(departmentsApi.fetchDepartments).mockResolvedValue({
      data: [
        {
          id: 'd1',
          name: 'Engineering',
          code: 'ENG',
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      meta: { total: 1, page: 1, pageSize: 100, totalPages: 1 },
    });
    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, pageSize: 100 },
    });
    vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([]);
  });

  it('renders report header, scope badge, filter bar, and data table for Admin', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('report-header')).toBeInTheDocument();
    expect(screen.getByText('Company-wide Scope')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('report-filter-bar')).toBeInTheDocument();
      expect(screen.getByTestId('report-table')).toBeInTheDocument();
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('Working days')).toBeInTheDocument();
    });
  });

  it('shows direct reports scope badge for Team Lead', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Direct Reports Scope')).toBeInTheDocument();
  });

  it('enforces deny-by-default and renders ForbiddenState for Staff members', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(screen.getByText(/Staff members do not have permission/)).toBeInTheDocument();
    expect(screen.queryByTestId('report-table')).not.toBeInTheDocument();
  });

  it('allows switching reports in the catalog and updates column headers and preview', async () => {
    const mockLeaveRows: ReportPreviewResponse = {
      data: [
        {
          employeeCode: 'EMP-001',
          employeeName: 'Sarah Connor',
          leaveType: 'Annual Leave',
          allotted: 18,
          used: 4,
          remaining: 14,
        },
      ],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };

    vi.mocked(reportsApi.previewReport).mockImplementation(async (name) => {
      if (name === 'leave-usage') return mockLeaveRows;
      return mockAttendanceRows;
    });

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('report-selector')).toBeInTheDocument();
    });

    // Switch report to leave-usage
    fireEvent.change(screen.getByTestId('report-selector'), {
      target: { value: 'leave-usage' },
    });

    await waitFor(() => {
      expect(screen.getByText('Leave balance and usage')).toBeInTheDocument();
      expect(screen.getByText('Remaining')).toBeInTheDocument();
      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
    });
  });

  it('triggers CSV and PDF export actions', async () => {
    const mockBlob = new Blob(['sample,data'], { type: 'text/csv' });
    vi.mocked(reportsApi.exportReport).mockResolvedValue({
      filename: 'attendance-summary-2026-11-03.csv',
      blob: mockBlob,
    });

    // Mock URL.createObjectURL and revokeObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-csv-btn'));

    await waitFor(() => {
      expect(reportsApi.exportReport).toHaveBeenCalledWith(
        'attendance-summary',
        'csv',
        expect.any(Object),
      );
    });

    fireEvent.click(screen.getByTestId('export-pdf-btn'));

    await waitFor(() => {
      expect(reportsApi.exportReport).toHaveBeenCalledWith(
        'attendance-summary',
        'pdf',
        expect.any(Object),
      );
    });
  });

  it('displays export error banner when export rejects with size limit', async () => {
    vi.mocked(reportsApi.exportReport).mockRejectedValue(
      new Error('A PDF can hold at most 2000 rows. Use CSV or narrow the filters and try again.'),
    );

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('export-pdf-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('export-pdf-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('export-error-banner')).toBeInTheDocument();
      expect(screen.getByText(/A PDF can hold at most 2000 rows/)).toBeInTheDocument();
    });
  });

  it('renders EmptyState when no records match filters', async () => {
    vi.mocked(reportsApi.previewReport).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ReportsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No data matches these report criteria')).toBeInTheDocument();
    });
  });
});
