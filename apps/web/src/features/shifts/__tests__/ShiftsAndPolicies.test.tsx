// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ShiftCard } from '../components/ShiftCard';
import { ShiftFormModal } from '../components/ShiftFormModal';
import { AttendancePolicyCard } from '../components/AttendancePolicyCard';
import { ShiftsAndPoliciesPage } from '../pages/ShiftsAndPoliciesPage';
import * as shiftsApi from '../api/shifts';
import type { AttendancePolicy, Shift } from '../types';

vi.mock('../api/shifts', () => ({
  fetchShifts: vi.fn(),
  fetchShift: vi.fn(),
  createShift: vi.fn(),
  updateShift: vi.fn(),
  fetchAttendancePolicy: vi.fn(),
  updateAttendancePolicy: vi.fn(),
  fetchEmployeeShiftAssignments: vi.fn(),
  assignShift: vi.fn(),
}));

const mockShifts: Shift[] = [
  {
    id: 'shift-001',
    code: 'GENERAL',
    name: 'General Shift',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    crossesMidnight: false,
    isActive: true,
    createdAt: '2026-10-30T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
  },
  {
    id: 'shift-002',
    code: 'NIGHT',
    name: 'Night Owl Shift',
    startTime: '22:00',
    endTime: '06:00',
    graceMinutes: 30,
    crossesMidnight: true,
    isActive: true,
    createdAt: '2026-10-30T00:00:00Z',
    updatedAt: '2026-10-30T00:00:00Z',
  },
];

const mockPolicy: AttendancePolicy = {
  id: 'policy-001',
  fullDayMinutes: 480,
  halfDayMinutes: 240,
  defaultShiftId: 'shift-001',
  timezone: 'Asia/Kolkata',
  workWeek: [1, 2, 3, 4, 5],
  updatedAt: '2026-10-30T00:00:00Z',
};

describe('Shifts & Attendance Policies Feature Suite (Issue #33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('ShiftCard', () => {
    it('renders shift details and overnight indicator', () => {
      const onEdit = vi.fn();
      render(<ShiftCard shift={mockShifts[1]!} isDefault={false} onEdit={onEdit} />);

      expect(screen.getByText('NIGHT')).toBeInTheDocument();
      expect(screen.getByText('Night Owl Shift')).toBeInTheDocument();
      expect(screen.getByText(/22:00/)).toBeInTheDocument();
      expect(screen.getByText(/30 mins/)).toBeInTheDocument();
      expect(screen.getByText('Overnight shift (crosses midnight)')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('edit-shift-btn-shift-002'));
      expect(onEdit).toHaveBeenCalledWith(mockShifts[1]);
    });
  });

  describe('ShiftFormModal', () => {
    it('validates start and end time uniqueness and required fields', () => {
      render(<ShiftFormModal isOpen={true} onClose={vi.fn()} shift={null} onSubmit={vi.fn()} />);

      expect(screen.getByText('Create New Shift')).toBeInTheDocument();

      // Enter same start and end time
      fireEvent.change(screen.getByTestId('shift-code-input'), { target: { value: 'SPL' } });
      fireEvent.change(screen.getByTestId('shift-name-input'), { target: { value: 'Special' } });
      fireEvent.change(screen.getByTestId('shift-start-input'), { target: { value: '10:00' } });
      fireEvent.change(screen.getByTestId('shift-end-input'), { target: { value: '10:00' } });

      fireEvent.click(screen.getByTestId('submit-shift-btn'));

      expect(
        screen.getByText('Shift start time and end time cannot be identical.'),
      ).toBeInTheDocument();
    });

    it('submits valid shift creation payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      render(<ShiftFormModal isOpen={true} onClose={onClose} shift={null} onSubmit={onSubmit} />);

      fireEvent.change(screen.getByTestId('shift-code-input'), { target: { value: 'EARLY' } });
      fireEvent.change(screen.getByTestId('shift-name-input'), { target: { value: 'Early Bird' } });
      fireEvent.change(screen.getByTestId('shift-start-input'), { target: { value: '07:00' } });
      fireEvent.change(screen.getByTestId('shift-end-input'), { target: { value: '15:30' } });
      fireEvent.change(screen.getByTestId('shift-grace-input'), { target: { value: '10' } });

      fireEvent.click(screen.getByTestId('submit-shift-btn'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          code: 'EARLY',
          name: 'Early Bird',
          startTime: '07:00',
          endTime: '15:30',
          graceMinutes: 10,
        });
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('AttendancePolicyCard', () => {
    it('validates half day threshold < full day threshold and submits update', async () => {
      const onUpdate = vi.fn().mockResolvedValue(undefined);

      render(<AttendancePolicyCard policy={mockPolicy} shifts={mockShifts} onUpdate={onUpdate} />);

      expect(screen.getByText('Company Attendance Policy')).toBeInTheDocument();
      expect(screen.getByText('Asia/Kolkata')).toBeInTheDocument();

      // Enter invalid half day >= full day
      const halfDayInput = screen.getByTestId('half-day-input');
      fireEvent.change(halfDayInput, { target: { value: '500' } });

      fireEvent.click(screen.getByTestId('save-policy-btn'));
      expect(
        screen.getByText('Half day duration must be strictly less than full day duration.'),
      ).toBeInTheDocument();
      expect(onUpdate).not.toHaveBeenCalled();

      // Correct to valid half day
      fireEvent.change(halfDayInput, { target: { value: '240' } });
      fireEvent.click(screen.getByTestId('save-policy-btn'));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith({
          fullDayMinutes: 480,
          halfDayMinutes: 240,
          defaultShiftId: 'shift-001',
        });
      });
    });
  });

  describe('ShiftsAndPoliciesPage', () => {
    it('renders page layout, policy card, and shifts table & cards', async () => {
      vi.mocked(shiftsApi.fetchShifts).mockResolvedValue(mockShifts);
      vi.mocked(shiftsApi.fetchAttendancePolicy).mockResolvedValue(mockPolicy);

      render(<ShiftsAndPoliciesPage />);

      await waitFor(() => {
        expect(screen.getByText('Shift & Attendance Policies')).toBeInTheDocument();
      });

      expect(screen.getByText('Company Attendance Policy')).toBeInTheDocument();
      expect(screen.getAllByText('General Shift').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Night Owl Shift').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId('shifts-mobile-cards')).toBeInTheDocument();
    });
  });
});
