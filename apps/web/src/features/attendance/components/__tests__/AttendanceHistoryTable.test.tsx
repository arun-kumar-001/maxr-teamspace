// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceApiClient } from '../../api/attendanceApi';
import { AttendanceRecord } from '../../types/attendance';
import { AttendanceHistoryTable } from '../AttendanceHistoryTable';

describe('TC-35-UI: AttendanceHistoryTable Component Unit Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleRecords: AttendanceRecord[] = [
    {
      id: 'r1000000-0000-4000-8000-000000000001',
      employeeId: 'e1000000-0000-4000-8000-000000000001',
      workDate: '2026-10-29',
      checkInTime: '2026-10-29T09:00:00Z',
      checkOutTime: '2026-10-29T17:30:00Z',
      durationMinutes: 510,
      status: 'PRESENT',
      location: { latitude: 12.97, longitude: 77.59, address: 'Bangalore Office' },
      notes: 'Full shift completed',
      createdAt: '2026-10-29T09:00:00Z',
      updatedAt: '2026-10-29T17:30:00Z',
    },
  ];

  function createMockApi(): AttendanceApiClient {
    return {
      getActiveSession: vi.fn().mockResolvedValue(null),
      getTodaySummary: vi.fn().mockResolvedValue({
        date: '2026-10-29',
        activeSession: null,
        completedSessions: [],
        totalWorkedMinutes: 0,
        status: 'ON_LEAVE',
      }),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
      getMyHistory: vi.fn().mockResolvedValue({
        data: [...sampleRecords],
        meta: { total: 1, page: 1, pageSize: 10 },
      }),
      listAttendance: vi.fn().mockResolvedValue({
        data: [...sampleRecords],
        meta: { total: 1, page: 1, pageSize: 10 },
      }),
    };
  }

  it('renders personal attendance history table for staff member', async () => {
    const api = createMockApi();
    render(<AttendanceHistoryTable api={api} isStaffOnly={true} />);

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('2026-10-29').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('PRESENT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8h 30m').length).toBeGreaterThan(0);
    expect(api.getMyHistory).toHaveBeenCalled();
  });

  it('filters history by status change', async () => {
    const api = createMockApi();
    render(<AttendanceHistoryTable api={api} isStaffOnly={true} />);

    await waitFor(() => {
      expect(screen.getAllByText('2026-10-29').length).toBeGreaterThan(0);
    });

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'LATE' } });

    await waitFor(() => {
      expect(api.getMyHistory).toHaveBeenCalledWith(expect.objectContaining({ status: 'LATE' }));
    });
  });

  it('renders empty state when no attendance records exist for criteria', async () => {
    const api = createMockApi();
    (api.getMyHistory as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [],
      meta: { total: 0, page: 1, pageSize: 10 },
    });

    render(<AttendanceHistoryTable api={api} isStaffOnly={true} />);

    await waitFor(() => {
      expect(screen.getByText('No attendance records found')).toBeDefined();
    });
  });
});
