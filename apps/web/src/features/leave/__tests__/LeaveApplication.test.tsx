// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type {
  LeavePolicy,
  Holiday,
  LeaveBalance,
  LeaveRequest,
  LeaveCalendarEntry,
} from '../types';
import { ApplyLeaveModal } from '../components/ApplyLeaveModal';
import { LeaveRequestCard } from '../components/LeaveRequestCard';
import { LeaveRequestsTable } from '../components/LeaveRequestsTable';
import { LeaveCalendarView } from '../components/LeaveCalendarView';
import { LeaveManagementPage } from '../pages/LeaveManagementPage';
import * as leaveApi from '../api/leave';

vi.mock('../api/leave', () => ({
  fetchLeavePolicies: vi.fn(),
  createLeavePolicy: vi.fn(),
  updateLeavePolicy: vi.fn(),
  fetchHolidays: vi.fn(),
  createHoliday: vi.fn(),
  deleteHoliday: vi.fn(),
  fetchMyLeaveBalances: vi.fn(),
  fetchLeaveBalances: vi.fn(),
  runYearlyAccrual: vi.fn(),
  applyForLeave: vi.fn(),
  fetchMyLeaveRequests: vi.fn(),
  fetchLeaveRequest: vi.fn(),
  cancelLeaveRequest: vi.fn(),
  fetchLeaveCalendar: vi.fn(),
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-001', role: 'staff', name: 'Staff Member' },
    role: 'staff',
    isAuthenticated: true,
  }),
}));

const mockPolicies: LeavePolicy[] = [
  {
    id: 'pol-001',
    code: 'PTO',
    name: 'Paid Time Off',
    hasBalance: true,
    isActive: true,
    annualDays: 18,
    carryForwardMax: 5,
    allowHalfDay: true,
    maxBackdateDays: 3,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-002',
    code: 'SICK',
    name: 'Sick Leave',
    hasBalance: true,
    isActive: true,
    annualDays: 12,
    carryForwardMax: 0,
    allowHalfDay: false,
    maxBackdateDays: 5,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockBalances: LeaveBalance[] = [
  {
    leaveTypeId: 'pol-001',
    code: 'PTO',
    name: 'Paid Time Off',
    year: 2026,
    allotted: 18,
    carriedForward: 2,
    used: 5,
    remaining: 15,
  },
  {
    leaveTypeId: 'pol-002',
    code: 'SICK',
    name: 'Sick Leave',
    year: 2026,
    allotted: 12,
    carriedForward: 0,
    used: 10,
    remaining: 2,
  },
];

const mockHolidays: Holiday[] = [
  {
    id: 'hol-001',
    date: '2026-11-26',
    name: 'Thanksgiving',
  },
];

const mockRequests: LeaveRequest[] = [
  {
    id: 'req-001',
    employeeId: 'emp-001',
    employeeName: 'Staff Member',
    leaveTypeId: 'pol-001',
    leaveTypeCode: 'PTO',
    leaveTypeName: 'Paid Time Off',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    halfDay: false,
    days: 3,
    reason: 'Family vacation',
    status: 'pending',
    approvalId: 'app-001',
    createdAt: '2026-11-01T09:00:00Z',
    updatedAt: '2026-11-01T09:00:00Z',
  },
  {
    id: 'req-002',
    employeeId: 'emp-001',
    employeeName: 'Staff Member',
    leaveTypeId: 'pol-001',
    leaveTypeCode: 'PTO',
    leaveTypeName: 'Paid Time Off',
    startDate: '2026-10-05',
    endDate: '2026-10-05',
    halfDay: true,
    days: 0.5,
    reason: 'Doctor appointment',
    status: 'approved',
    approvalId: 'app-002',
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-02T09:00:00Z',
  },
];

const mockCalendarEntries: LeaveCalendarEntry[] = [
  {
    requestId: 'req-001',
    employeeId: 'emp-001',
    employeeName: 'Staff Member',
    leaveTypeCode: 'PTO',
    leaveTypeName: 'Paid Time Off',
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    halfDay: false,
    days: 3,
    status: 'pending',
  },
];

describe('Leave Application & Management Suite (Issue #39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('ApplyLeaveModal', () => {
    it('validates dates, insufficient balance, and submits valid leave application', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApplyLeaveModal
          isOpen={true}
          onClose={onClose}
          policies={mockPolicies}
          balances={mockBalances}
          holidays={mockHolidays}
          onSubmit={onSubmit}
        />,
      );

      expect(screen.getByText('Apply for Leave')).toBeInTheDocument();

      // Check balance limit: Select SICK which has 2 days remaining
      const policySelect = screen.getByLabelText('Select Leave Type');
      fireEvent.change(policySelect, { target: { value: 'pol-002' } });

      // Request 5 days (e.g. 2026-11-16 to 2026-11-20: Mon to Fri = 5 days)
      const startDateInput = screen.getByTestId('apply-start-date-input');
      const endDateInput = screen.getByTestId('apply-end-date-input');

      fireEvent.change(startDateInput, { target: { value: '2026-11-16' } });
      fireEvent.change(endDateInput, { target: { value: '2026-11-20' } });

      const submitBtn = screen.getByTestId('submit-leave-request-btn');
      fireEvent.click(submitBtn);

      expect(
        screen.getByText(
          /Insufficient leave balance. You are requesting 5 days, but only have 2 days remaining/i,
        ),
      ).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();

      // Fix by switching to PTO (which has 15 days available)
      fireEvent.change(policySelect, { target: { value: 'pol-001' } });
      const reasonInput = screen.getByTestId('apply-reason-input');
      fireEvent.change(reasonInput, { target: { value: 'Holiday trip' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          leaveTypeId: 'pol-001',
          startDate: '2026-11-16',
          endDate: '2026-11-20',
          halfDay: false,
          reason: 'Holiday trip',
        });
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('enforces single day for half-day requests and submits', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApplyLeaveModal
          isOpen={true}
          onClose={onClose}
          policies={mockPolicies}
          balances={mockBalances}
          holidays={mockHolidays}
          onSubmit={onSubmit}
        />,
      );

      const halfDayToggle = screen.getByTestId('apply-half-day-toggle');
      fireEvent.click(halfDayToggle);

      const startDateInput = screen.getByTestId('apply-start-date-input');
      fireEvent.change(startDateInput, { target: { value: '2026-11-17' } });

      // End date input should be hidden when half-day is checked
      expect(screen.queryByTestId('apply-end-date-input')).not.toBeInTheDocument();

      const submitBtn = screen.getByTestId('submit-leave-request-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          leaveTypeId: 'pol-001',
          startDate: '2026-11-17',
          endDate: '2026-11-17',
          halfDay: true,
          reason: undefined,
        });
      });
    });

    it('opens dropdown, filters on typing, and selects option with mouse', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApplyLeaveModal
          isOpen={true}
          onClose={onClose}
          policies={mockPolicies}
          balances={mockBalances}
          holidays={mockHolidays}
          onSubmit={onSubmit}
        />,
      );

      // Open dropdown via arrow button
      const dropdownBtn = screen.getByTestId('leave-type-dropdown-btn');
      fireEvent.click(dropdownBtn);

      expect(screen.getByTestId('leave-type-options-list')).toBeInTheDocument();
      expect(screen.getByTestId('leave-type-option-pol-001')).toBeInTheDocument();
      expect(screen.getByTestId('leave-type-option-pol-002')).toBeInTheDocument();

      // Search / filter by typing
      const searchInput = screen.getByTestId('apply-leave-type-search-input');
      fireEvent.change(searchInput, { target: { value: 'Sick' } });

      // Only Sick Leave should match
      expect(screen.queryByTestId('leave-type-option-pol-001')).not.toBeInTheDocument();
      expect(screen.getByTestId('leave-type-option-pol-002')).toBeInTheDocument();

      // Click the option
      fireEvent.click(screen.getByTestId('leave-type-option-pol-002'));

      // Dropdown closes after selection
      expect(screen.queryByTestId('leave-type-options-list')).not.toBeInTheDocument();
    });

    it('supports keyboard navigation (ArrowDown, Enter, Escape)', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <ApplyLeaveModal
          isOpen={true}
          onClose={onClose}
          policies={mockPolicies}
          balances={mockBalances}
          holidays={mockHolidays}
          onSubmit={onSubmit}
        />,
      );

      const searchInput = screen.getByTestId('apply-leave-type-search-input');

      // Press ArrowDown to open dropdown
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      expect(screen.getByTestId('leave-type-options-list')).toBeInTheDocument();

      // Press Escape to close
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      expect(screen.queryByTestId('leave-type-options-list')).not.toBeInTheDocument();

      // Press ArrowDown to open, ArrowDown to highlight second item, then Enter
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      expect(screen.queryByTestId('leave-type-options-list')).not.toBeInTheDocument();
    });

    it('renders fallback options gracefully when policies prop is empty', () => {
      render(
        <ApplyLeaveModal
          isOpen={true}
          onClose={vi.fn()}
          policies={[]}
          balances={[]}
          holidays={[]}
          onSubmit={vi.fn()}
        />,
      );

      const dropdownBtn = screen.getByTestId('leave-type-dropdown-btn');
      fireEvent.click(dropdownBtn);

      expect(screen.getByText('Annual Leave')).toBeInTheDocument();
      expect(screen.getByText('Sick Leave')).toBeInTheDocument();
      expect(screen.getByText('Casual Leave')).toBeInTheDocument();
      expect(screen.getByText('Work From Home')).toBeInTheDocument();
      expect(screen.getByText('Permission / Other')).toBeInTheDocument();
    });
  });

  describe('LeaveRequestCard', () => {
    it('renders request details and triggers cancellation on click', async () => {
      const onCancel = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<LeaveRequestCard request={mockRequests[0]!} onCancel={onCancel} />);

      expect(screen.getByText('PTO')).toBeInTheDocument();
      expect(screen.getByText('Paid Time Off')).toBeInTheDocument();
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      expect(screen.getByText('3 days')).toBeInTheDocument();
      expect(screen.getByText('Family vacation')).toBeInTheDocument();

      const cancelBtn = screen.getByTestId('cancel-leave-btn-req-001');
      fireEvent.click(cancelBtn);

      expect(onCancel).toHaveBeenCalledWith('req-001');
    });
  });

  describe('LeaveRequestsTable', () => {
    it('filters requests by status and renders desktop table & mobile cards', () => {
      render(<LeaveRequestsTable requests={mockRequests} onCancelRequest={vi.fn()} />);

      expect(screen.getByText('All (2)')).toBeInTheDocument();
      expect(screen.getByText('Pending (1)')).toBeInTheDocument();
      expect(screen.getByText('Approved (1)')).toBeInTheDocument();

      // Click Pending filter
      fireEvent.click(screen.getByTestId('filter-status-pending'));
      expect(screen.getAllByText('Family vacation')[0]).toBeInTheDocument();
      expect(screen.queryByText('Doctor appointment')).not.toBeInTheDocument();
    });
  });

  describe('LeaveCalendarView', () => {
    it('renders team calendar entries', () => {
      render(<LeaveCalendarView entries={mockCalendarEntries} />);

      expect(screen.getByText('Team Leave Calendar')).toBeInTheDocument();
      expect(screen.getByText('Staff Member')).toBeInTheDocument();
      expect(screen.getByText('3 days')).toBeInTheDocument();
    });
  });

  describe('LeaveManagementPage Integration', () => {
    it('renders page, opens apply leave modal, and handles leave application', async () => {
      vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue(mockPolicies);
      vi.mocked(leaveApi.fetchHolidays).mockResolvedValue(mockHolidays);
      vi.mocked(leaveApi.fetchMyLeaveBalances).mockResolvedValue(mockBalances);
      vi.mocked(leaveApi.fetchMyLeaveRequests).mockResolvedValue({
        data: mockRequests,
        meta: { page: 1, pageSize: 20, total: 2 },
      });
      vi.mocked(leaveApi.fetchLeaveCalendar).mockResolvedValue(mockCalendarEntries);

      render(<LeaveManagementPage initialTab="requests" />);

      await waitFor(() => {
        expect(screen.getByText('Leave & Holiday Management')).toBeInTheDocument();
      });

      expect(screen.getByTestId('leave-requests-container')).toBeInTheDocument();

      // Open Apply Leave modal
      const applyBtn = screen.getByTestId('apply-leave-btn');
      fireEvent.click(applyBtn);

      expect(screen.getByRole('heading', { name: 'Apply for Leave' })).toBeInTheDocument();

      // Cancel modal
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Apply for Leave' })).not.toBeInTheDocument();
      });
    });
  });
});
