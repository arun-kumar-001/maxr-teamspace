// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
import * as leaveApi from '../api/leave';
import * as employeeApi from '../../employees/api/employees';

vi.mock('../api/leave', () => ({
  fetchLeaveBalances: vi.fn(),
}));

vi.mock('../../employees/api/employees', () => ({
  fetchEmployeeDirectory: vi.fn(),
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-admin-1',
      employeeId: 'emp-001',
      email: 'admin@maxr.internal',
      name: 'Sarah Connor',
      role: 'admin',
      department: 'Engineering',
    },
    role: 'admin',
    isAuthenticated: true,
  }),
}));

const mockTeamBalances = [
  {
    employeeId: 'emp-001',
    employeeName: 'Sarah Connor',
    leaveTypeId: 'lt-al',
    code: 'AL',
    name: 'Annual Leave',
    year: 2026,
    allotted: 18,
    carriedForward: 2,
    used: 5,
    remaining: 15,
  },
  {
    employeeId: 'emp-002',
    employeeName: 'John Doe',
    leaveTypeId: 'lt-sl',
    code: 'SL',
    name: 'Sick Leave',
    year: 2026,
    allotted: 10,
    carriedForward: 0,
    used: 2,
    remaining: 8,
  },
  {
    employeeId: 'emp-002',
    employeeName: 'John Doe',
    leaveTypeId: 'lt-cl',
    code: 'CL',
    name: 'Casual Leave',
    year: 2026,
    allotted: 6,
    carriedForward: 0,
    used: 1,
    remaining: 5,
  },
  {
    employeeId: 'emp-003',
    employeeName: 'Alex OtherDept',
    leaveTypeId: 'lt-al',
    code: 'AL',
    name: 'Annual Leave',
    year: 2026,
    allotted: 18,
    carriedForward: 0,
    used: 4,
    remaining: 14,
  },
];

const mockDirectory = [
  {
    id: 'emp-001',
    employeeCode: 'ENG-001',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'admin@maxr.internal',
    department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    designation: { id: 'des-1', title: 'Tech Lead' },
    status: 'active',
  },
  {
    id: 'emp-002',
    employeeCode: 'ENG-002',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@maxr.internal',
    department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    designation: { id: 'des-2', title: 'Software Engineer' },
    status: 'active',
  },
  {
    id: 'emp-003',
    employeeCode: 'OPS-001',
    firstName: 'Alex',
    lastName: 'OtherDept',
    email: 'alex@maxr.internal',
    department: { id: 'dept-ops', name: 'Operations', code: 'OPS' },
    designation: { id: 'des-3', title: 'Operations Specialist' },
    status: 'active',
  },
];

describe('Issue #11 - Same Team Leave Balances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(leaveApi.fetchLeaveBalances).mockResolvedValue({
      data: mockTeamBalances as any,
      meta: { page: 1, pageSize: 50, total: mockTeamBalances.length },
    });
    vi.mocked(employeeApi.fetchEmployeeDirectory).mockResolvedValue({
      data: mockDirectory as any,
      meta: { page: 1, pageSize: 50, total: mockDirectory.length, totalPages: 1 },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Same Team Leave Balances with filtered team members belonging to admin department', async () => {
    render(<LeaveBalancesSummary balances={[]} year={2026} />);

    await waitFor(() => {
      expect(screen.getByTestId('same-team-leave-balances')).toBeInTheDocument();
      expect(screen.getByText('Same Team Leave Balances')).toBeInTheDocument();
      expect(screen.getByText(/Team: Engineering/i)).toBeInTheDocument();
    });

    // Sarah Connor and John Doe (Engineering) should be displayed
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getByText('ENG-001')).toBeInTheDocument();
    expect(screen.getAllByText('ENG-002').length).toBeGreaterThan(0);

    // Other department employee (Alex OtherDept) should NOT be displayed
    expect(screen.queryByText('Alex OtherDept')).not.toBeInTheDocument();

    // Verify allocated, used, remaining counts
    expect(screen.getByText('20d')).toBeInTheDocument(); // Sarah AL 18+2
    expect(screen.getByText('15d left')).toBeInTheDocument();
  });

  it('filters by leave type (Annual, Sick, Casual)', async () => {
    render(<LeaveBalancesSummary balances={[]} year={2026} />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    });

    // Filter to Sick Leave only
    const sickFilterBtn = screen.getByTestId('team-leave-filter-sick');
    fireEvent.click(sickFilterBtn);

    const section = screen.getByTestId('same-team-leave-balances');
    const withinSection = within(section);

    // Sick leave row should remain in table, Annual Leave row should be hidden from table
    expect(withinSection.getByTestId('team-balance-row-emp-002-SL')).toBeInTheDocument();
    expect(withinSection.queryByTestId('team-balance-row-emp-001-AL')).not.toBeInTheDocument();

    // Filter back to All Types
    const allFilterBtn = screen.getByTestId('team-leave-filter-all');
    fireEvent.click(allFilterBtn);
    expect(withinSection.getByTestId('team-balance-row-emp-001-AL')).toBeInTheDocument();
    expect(withinSection.getByTestId('team-balance-row-emp-002-SL')).toBeInTheDocument();
  });

  it('searches employees by name or employee code', async () => {
    render(<LeaveBalancesSummary balances={[]} year={2026} />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('team-leave-search-input');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Only John Doe should appear
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sarah Connor')).not.toBeInTheDocument();

    // Search by code
    fireEvent.change(searchInput, { target: { value: 'ENG-001' } });
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });
});
