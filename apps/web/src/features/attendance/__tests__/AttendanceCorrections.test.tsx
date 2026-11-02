// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CorrectionStatusBadge } from '../components/CorrectionStatusBadge';
import { RequestCorrectionModal } from '../components/RequestCorrectionModal';
import { CorrectionsHistoryView } from '../components/CorrectionsHistoryView';
import * as attendanceApi from '../api/attendance';
import type { AttendanceCorrection, AttendanceRecord } from '../types';

vi.mock('../api/attendance', () => ({
  requestCorrection: vi.fn(),
  fetchCorrections: vi.fn(),
  cancelCorrection: vi.fn(),
  fetchTodayAttendance: vi.fn(),
  fetchActiveSession: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  fetchMyAttendanceHistory: vi.fn(),
  fetchTeamAttendance: vi.fn(),
}));

const mockRecord: AttendanceRecord = {
  id: 'att-rec-1',
  employeeId: 'emp-101',
  workDate: '2026-10-25',
  checkInTime: '2026-10-25T09:00:00.000Z',
  checkOutTime: '2026-10-25T17:00:00.000Z',
  durationMinutes: 480,
  status: 'present',
  location: { workMode: 'office' },
  notes: null,
  createdAt: '2026-10-25T09:00:00.000Z',
  updatedAt: '2026-10-25T17:00:00.000Z',
};

const mockCorrections: AttendanceCorrection[] = [
  {
    id: 'corr-001',
    attendanceRecordId: 'att-rec-1',
    employeeId: 'emp-101',
    workDate: '2026-10-25',
    originalCheckIn: '2026-10-25T09:00:00.000Z',
    originalCheckOut: '2026-10-25T17:00:00.000Z',
    requestedCheckIn: '2026-10-25T08:30:00.000Z',
    requestedCheckOut: '2026-10-25T17:30:00.000Z',
    reason: 'Forgot to swipe card at gate entrance',
    status: 'pending',
    approvalId: 'app-001',
    createdAt: '2026-10-26T08:00:00.000Z',
    updatedAt: '2026-10-26T08:00:00.000Z',
  },
  {
    id: 'corr-002',
    attendanceRecordId: 'att-rec-2',
    employeeId: 'emp-101',
    workDate: '2026-10-24',
    originalCheckIn: '2026-10-24T09:15:00.000Z',
    originalCheckOut: '2026-10-24T18:00:00.000Z',
    requestedCheckIn: '2026-10-24T09:00:00.000Z',
    requestedCheckOut: '2026-10-24T18:00:00.000Z',
    reason: 'Traffic congestion on bridge',
    status: 'approved',
    approvalId: 'app-002',
    createdAt: '2026-10-25T08:00:00.000Z',
    updatedAt: '2026-10-25T11:00:00.000Z',
  },
];

describe('Attendance Corrections Feature Suite (Issue #36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('CorrectionStatusBadge', () => {
    it('renders correct labels for each correction status', () => {
      const { rerender } = render(<CorrectionStatusBadge status="pending" />);
      expect(screen.getByText('Pending')).toBeInTheDocument();

      rerender(<CorrectionStatusBadge status="approved" />);
      expect(screen.getByText('Approved')).toBeInTheDocument();

      rerender(<CorrectionStatusBadge status="rejected" />);
      expect(screen.getByText('Rejected')).toBeInTheDocument();

      rerender(<CorrectionStatusBadge status="cancelled" />);
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
    });
  });

  describe('RequestCorrectionModal', () => {
    it('validates mandatory reason and prevents submission without it', () => {
      render(<RequestCorrectionModal isOpen={true} onClose={vi.fn()} record={mockRecord} />);

      expect(screen.getByText('Request Attendance Correction')).toBeInTheDocument();
      expect(screen.getByText('2026-10-25')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('submit-correction-button'));

      expect(
        screen.getByText('Please provide a reason explaining this correction request.'),
      ).toBeInTheDocument();
      expect(attendanceApi.requestCorrection).not.toHaveBeenCalled();
    });

    it('submits correction request with valid payload and calls onSuccess', async () => {
      const onSuccess = vi.fn();
      const onClose = vi.fn();
      vi.mocked(attendanceApi.requestCorrection).mockResolvedValue(mockCorrections[0]!);

      render(
        <RequestCorrectionModal
          isOpen={true}
          onClose={onClose}
          record={mockRecord}
          onSuccess={onSuccess}
        />,
      );

      const reasonInput = screen.getByTestId('correction-reason-input');
      fireEvent.change(reasonInput, { target: { value: 'Forgot to swipe card at entrance' } });

      fireEvent.click(screen.getByTestId('submit-correction-button'));

      await waitFor(() => {
        expect(attendanceApi.requestCorrection).toHaveBeenCalledWith(
          expect.objectContaining({
            attendanceRecordId: 'att-rec-1',
            reason: 'Forgot to swipe card at entrance',
          }),
        );
        expect(onSuccess).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('displays error banner if API request fails', async () => {
      vi.mocked(attendanceApi.requestCorrection).mockRejectedValue(
        new Error('A pending correction already exists for this record'),
      );

      render(<RequestCorrectionModal isOpen={true} onClose={vi.fn()} record={mockRecord} />);

      const reasonInput = screen.getByTestId('correction-reason-input');
      fireEvent.change(reasonInput, { target: { value: 'Already submitted' } });

      fireEvent.click(screen.getByTestId('submit-correction-button'));

      await waitFor(() => {
        expect(
          screen.getByText('A pending correction already exists for this record'),
        ).toBeInTheDocument();
      });
    });
  });

  describe('CorrectionsHistoryView', () => {
    it('renders corrections list and allows cancelling pending request', async () => {
      const onCancelCorrection = vi.fn().mockResolvedValue(undefined);

      render(
        <CorrectionsHistoryView
          corrections={mockCorrections}
          meta={{ page: 1, pageSize: 10, total: 2 }}
          onCancelCorrection={onCancelCorrection}
          page={1}
          onPageChange={vi.fn()}
        />,
      );

      expect(screen.getAllByText('2026-10-25').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('2026-10-24').length).toBeGreaterThanOrEqual(1);

      // Pending has cancel button, approved does not
      const cancelButtons = screen.getAllByTestId('cancel-correction-button-corr-001');
      expect(cancelButtons.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByTestId('cancel-correction-button-corr-002')).not.toBeInTheDocument();

      fireEvent.click(cancelButtons[0]!);
      expect(onCancelCorrection).toHaveBeenCalledWith('corr-001');
    });

    it('renders empty state when no corrections exist', () => {
      render(
        <CorrectionsHistoryView
          corrections={[]}
          meta={{ page: 1, pageSize: 10, total: 0 }}
          onCancelCorrection={vi.fn()}
          page={1}
          onPageChange={vi.fn()}
        />,
      );

      expect(screen.getByText('No correction requests')).toBeInTheDocument();
    });
  });
});
