// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceApiClient } from '../../api/attendanceApi';
import { AttendanceRecord, TodayAttendanceSummary } from '../../types/attendance';
import { AttendanceWidget } from '../AttendanceWidget';

describe('TC-34-UI: AttendanceWidget Component', () => {
  afterEach(() => {
    cleanup();
  });
  let mockApi: AttendanceApiClient;
  const sampleActiveSession: AttendanceRecord = {
    id: 'att-session-123',
    employeeId: 'emp-456',
    workDate: '2026-10-29',
    checkInTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    checkOutTime: null,
    durationMinutes: null,
    status: 'PRESENT',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sampleInitialSummary: TodayAttendanceSummary = {
    date: '2026-10-29',
    activeSession: null,
    completedSessions: [],
    totalWorkedMinutes: 0,
    status: 'ON_LEAVE',
  };

  beforeEach(() => {
    mockApi = {
      getActiveSession: vi.fn().mockResolvedValue(null),
      getTodaySummary: vi.fn().mockResolvedValue(sampleInitialSummary),
      checkIn: vi.fn().mockResolvedValue(sampleActiveSession),
      checkOut: vi.fn().mockResolvedValue({
        ...sampleActiveSession,
        checkOutTime: new Date().toISOString(),
        durationMinutes: 60,
      }),
      getMyHistory: vi
        .fn()
        .mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 10 } }),
      listAttendance: vi
        .fn()
        .mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 10 } }),
    };
  });

  it('renders initial checked-out state with disabled Check Out button', async () => {
    render(<AttendanceWidget api={mockApi} initialSummary={sampleInitialSummary} />);

    expect(screen.getByText("Today's Attendance")).toBeDefined();
    expect(screen.getByText(/Checked Out/i)).toBeDefined();

    const checkInBtn = screen.getByTestId('attendance-checkin-btn');
    const checkOutBtn = screen.getByTestId('attendance-checkout-btn');

    expect(checkInBtn).toBeDefined();
    expect(checkInBtn.hasAttribute('disabled')).toBe(false);
    expect(checkOutBtn.hasAttribute('disabled')).toBe(true);

    const totalWorked = screen.getByTestId('attendance-total-worked');
    expect(totalWorked.textContent).toContain('0h 0m');
  });

  it('triggers check-in and updates to active session timer display', async () => {
    render(<AttendanceWidget api={mockApi} initialSummary={sampleInitialSummary} />);

    const checkInBtn = screen.getByTestId('attendance-checkin-btn');
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(mockApi.checkIn).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/Session In Progress/i)).toBeDefined();
      expect(screen.getByText(/Active session timer:/i)).toBeDefined();
    });
  });

  it('triggers check-out successfully when session is active', async () => {
    const activeSummary: TodayAttendanceSummary = {
      ...sampleInitialSummary,
      activeSession: sampleActiveSession,
      status: 'PRESENT',
    };

    render(<AttendanceWidget api={mockApi} initialSummary={activeSummary} />);

    expect(screen.getByText(/Session In Progress/i)).toBeDefined();
    const checkInBtn = screen.getByTestId('attendance-checkin-btn');
    const checkOutBtn = screen.getByTestId('attendance-checkout-btn');

    expect(checkInBtn.hasAttribute('disabled')).toBe(true);
    expect(checkOutBtn.hasAttribute('disabled')).toBe(false);

    fireEvent.click(checkOutBtn);

    await waitFor(() => {
      expect(mockApi.checkOut).toHaveBeenCalledTimes(1);
    });
  });

  it('displays accessible error alert when check-in fails (e.g. 409 conflict)', async () => {
    mockApi.checkIn = vi
      .fn()
      .mockRejectedValue(new Error('An active attendance session is already open'));

    render(<AttendanceWidget api={mockApi} initialSummary={sampleInitialSummary} />);

    const checkInBtn = screen.getByTestId('attendance-checkin-btn');
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain('An active attendance session is already open');
    });

    // Dismiss error alert
    const dismissBtn = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
