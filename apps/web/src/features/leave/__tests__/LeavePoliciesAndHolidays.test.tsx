// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { LeavePolicy, Holiday, LeaveBalance } from '../types';
import { LeavePolicyCard } from '../components/LeavePolicyCard';
import { LeavePolicyFormModal } from '../components/LeavePolicyFormModal';
import { AddHolidayModal } from '../components/AddHolidayModal';
import { HolidayCalendar } from '../components/HolidayCalendar';
import { LeaveBalancesSummary } from '../components/LeaveBalancesSummary';
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
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-001', role: 'hr_manager', name: 'HR Manager' },
    role: 'hr_manager',
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
    code: 'UNPAID',
    name: 'Unpaid Leave',
    hasBalance: false,
    isActive: true,
    annualDays: 0,
    carryForwardMax: 0,
    allowHalfDay: false,
    maxBackdateDays: 0,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const mockHolidays: Holiday[] = [
  {
    id: 'hol-001',
    date: '2026-01-26',
    name: 'Republic Day',
  },
  {
    id: 'hol-002',
    date: '2026-08-15',
    name: 'Independence Day',
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
];

describe('Leave Policies, Balances and Holidays Suite (Issue #38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('LeavePolicyCard', () => {
    it('renders policy details, quotas, and edit button', () => {
      const onEdit = vi.fn();
      render(<LeavePolicyCard policy={mockPolicies[0]!} onEdit={onEdit} canManage={true} />);

      expect(screen.getByText('PTO')).toBeInTheDocument();
      expect(screen.getByText('Paid Time Off')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Quota Managed')).toBeInTheDocument();
      expect(screen.getByText('18 days')).toBeInTheDocument();
      expect(screen.getByText('5 days')).toBeInTheDocument();

      const editBtn = screen.getByTestId('edit-policy-btn-pol-001');
      fireEvent.click(editBtn);
      expect(onEdit).toHaveBeenCalledWith(mockPolicies[0]!);
    });
  });

  describe('LeavePolicyFormModal', () => {
    it('validates policy code regex format', async () => {
      const onSubmit = vi.fn();
      render(
        <LeavePolicyFormModal isOpen={true} onClose={vi.fn()} policy={null} onSubmit={onSubmit} />,
      );

      const codeInput = screen.getByTestId('leave-policy-code-input');
      const submitBtn = screen.getByTestId('submit-leave-policy-btn');

      // Invalid code starting with digit
      fireEvent.change(codeInput, { target: { value: '1INVALID' } });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Policy code must start with a letter/i)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits valid policy creation payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <LeavePolicyFormModal isOpen={true} onClose={onClose} policy={null} onSubmit={onSubmit} />,
      );

      fireEvent.change(screen.getByTestId('leave-policy-code-input'), {
        target: { value: 'CASUAL' },
      });
      fireEvent.change(screen.getByTestId('leave-policy-name-input'), {
        target: { value: 'Casual Leave' },
      });
      fireEvent.change(screen.getByTestId('leave-policy-annual-input'), {
        target: { value: '12' },
      });
      fireEvent.change(screen.getByTestId('leave-policy-carry-input'), {
        target: { value: '3' },
      });

      fireEvent.click(screen.getByTestId('submit-leave-policy-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          code: 'CASUAL',
          name: 'Casual Leave',
          hasBalance: true,
          annualDays: 12,
          carryForwardMax: 3,
          allowHalfDay: true,
          maxBackdateDays: 3,
        });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('AddHolidayModal', () => {
    it('validates holiday date and submits input', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(
        <AddHolidayModal isOpen={true} onClose={onClose} onSubmit={onSubmit} defaultYear={2026} />,
      );

      fireEvent.change(screen.getByTestId('holiday-date-input'), {
        target: { value: '2026-10-02' },
      });
      fireEvent.change(screen.getByTestId('holiday-name-input'), {
        target: { value: 'Gandhi Jayanti' },
      });

      fireEvent.click(screen.getByTestId('submit-holiday-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          date: '2026-10-02',
          name: 'Gandhi Jayanti',
        });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('HolidayCalendar', () => {
    it('renders grouped months and handles holiday deletion', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <HolidayCalendar
          holidays={mockHolidays}
          year={2026}
          onYearChange={vi.fn()}
          onDeleteHoliday={onDelete}
          canManage={true}
        />,
      );

      expect(screen.getByText('Company Holiday Calendar')).toBeInTheDocument();
      expect(screen.getByText('January')).toBeInTheDocument();
      expect(screen.getByText('August')).toBeInTheDocument();
      expect(screen.getByText('Republic Day')).toBeInTheDocument();
      expect(screen.getByText('Independence Day')).toBeInTheDocument();

      const deleteBtn = screen.getByTestId('delete-holiday-btn-hol-001');
      fireEvent.click(deleteBtn);

      expect(onDelete).toHaveBeenCalledWith('hol-001', 'Republic Day');
    });
  });

  describe('LeaveBalancesSummary', () => {
    it('renders balance metrics and breakdown', () => {
      render(<LeaveBalancesSummary balances={mockBalances} year={2026} />);

      expect(screen.getByText('Paid Time Off')).toBeInTheDocument();
      expect(screen.getByText('15 days left')).toBeInTheDocument();
      expect(screen.getByText('Used: 5d')).toBeInTheDocument();
      expect(screen.getByText('Total: 20d')).toBeInTheDocument();
    });
  });

  describe('LeaveManagementPage', () => {
    it('renders tabs and allows switching views', async () => {
      vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue(mockPolicies);
      vi.mocked(leaveApi.fetchHolidays).mockResolvedValue(mockHolidays);
      vi.mocked(leaveApi.fetchMyLeaveBalances).mockResolvedValue(mockBalances);

      render(<LeaveManagementPage initialTab="balances" />);

      await waitFor(() => {
        expect(screen.getByText('Leave & Holiday Management')).toBeInTheDocument();
      });

      // Default balances tab content
      expect(screen.getByText('Leave Entitlements & Balances')).toBeInTheDocument();

      // Switch to Holiday Calendar
      fireEvent.click(screen.getByRole('radio', { name: 'Holiday Calendar' }));
      expect(screen.getByText('Company Holiday Calendar')).toBeInTheDocument();

      // Switch to Leave Policies
      fireEvent.click(screen.getByRole('radio', { name: 'Leave Policies' }));
      expect(screen.getByText('Configured Leave Policies')).toBeInTheDocument();
      expect(screen.getByText('New Policy')).toBeInTheDocument();
    });
  });
});
