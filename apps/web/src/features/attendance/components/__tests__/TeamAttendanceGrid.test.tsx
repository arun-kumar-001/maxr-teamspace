// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceApiClient } from '../../api/attendanceApi';
import { AttendanceRecord } from '../../types/attendance';
import { TeamAttendanceGrid } from '../TeamAttendanceGrid';

describe('TC-35-UI: TeamAttendanceGrid Component Unit Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const team = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Alex Johnson', department: 'Engineering' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Sam Rivera', department: 'Engineering' },
  ];

  const sampleRecords: AttendanceRecord[] = [
    {
      id: 'r1000000-0000-4000-8000-000000000001',
      employeeId: '11111111-1111-4111-8111-111111111111',
      workDate: '2026-10-29',
      checkInTime: '2026-10-29T09:00:00Z',
      checkOutTime: null,
      durationMinutes: null,
      status: 'PRESENT',
      createdAt: '2026-10-29T09:00:00Z',
      updatedAt: '2026-10-29T09:00:00Z',
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
      getMyHistory: vi.fn(),
      listAttendance: vi.fn().mockResolvedValue({
        data: [...sampleRecords],
        meta: { total: 1, page: 1, pageSize: 10 },
      }),
    };
  }

  it('renders team roster grid with present and not checked-in members', async () => {
    const api = createMockApi();
    render(<TeamAttendanceGrid api={api} teamMembers={team} workDate="2026-10-29" />);

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Alex Johnson')).toBeDefined();
    });

    expect(screen.getByText('Sam Rivera')).toBeDefined();
    expect(screen.getByText('PRESENT')).toBeDefined();
    expect(screen.getAllByText('Not Checked In').length).toBeGreaterThan(0);
  });

  it('updates selected date and triggers refreshed attendance query', async () => {
    const api = createMockApi();
    render(<TeamAttendanceGrid api={api} teamMembers={team} workDate="2026-10-29" />);

    await waitFor(() => {
      expect(screen.getByText('Alex Johnson')).toBeDefined();
    });

    const dateInput = screen.getByLabelText(/selected date/i);
    fireEvent.change(dateInput, { target: { value: '2026-10-28' } });

    await waitFor(() => {
      expect(api.listAttendance).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2026-10-28',
          endDate: '2026-10-28',
        }),
      );
    });
  });
});
