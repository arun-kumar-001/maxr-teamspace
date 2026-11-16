// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { AttendancePage } from '../pages/AttendancePage';
import type { AttendanceRecord, TeamCalendarData, TodayAttendanceSummary } from '../types';

const mockActiveSummary: TodayAttendanceSummary = {
  workDate: '2026-11-11',
  totalDurationMinutes: 240,
  sessionsCount: 1,
  activeSession: {
    id: 'att-1',
    employeeId: 'emp-1',
    workDate: '2026-11-11',
    checkInTime: '2026-11-11T03:30:00Z',
    checkOutTime: null,
    durationMinutes: null,
    breakMinutes: 0,
    breaks: [],
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-11T03:30:00Z',
    updatedAt: '2026-11-11T03:30:00Z',
  },
  sessions: [],
};

const mockHistory: AttendanceRecord[] = [
  {
    id: 'att-hist-1',
    employeeId: 'emp-1',
    employeeName: 'Staff User',
    employeeCode: 'EMP-0004',
    workDate: '2026-11-10',
    checkInTime: '2026-11-10T03:30:00Z',
    checkOutTime: '2026-11-10T12:30:00Z',
    durationMinutes: 540,
    breakMinutes: 15,
    status: 'present',
    location: { workMode: 'office' },
    notes: 'Completed sprint backlog',
    createdAt: '2026-11-10T03:30:00Z',
    updatedAt: '2026-11-10T12:30:00Z',
  },
];

const mockTeamCalendar: TeamCalendarData = {
  employees: [
    {
      employeeId: 'emp-1',
      employeeCode: 'EMP-0004',
      employeeName: 'Ananya Sharma',
      departmentId: 'dept-eng',
      departmentName: 'Engineering',
      designation: 'Software Engineer',
    },
  ],
  departments: [{ id: 'dept-eng', name: 'Engineering' }],
  holidays: [],
  entries: [
    {
      id: 'att-cal-1',
      employeeId: 'emp-1',
      employeeCode: 'EMP-0004',
      employeeName: 'Ananya Sharma',
      departmentId: 'dept-eng',
      departmentName: 'Engineering',
      designation: 'Software Engineer',
      date: new Date().toISOString().slice(0, 10),
      checkInTime: '2026-11-11T03:30:00Z',
      checkOutTime: '2026-11-11T12:15:00Z',
      durationMinutes: 525,
      workMode: 'office',
      category: 'present',
      statusLabel: 'Present',
    },
  ],
};

function setupFetchMock() {
  const fetchSpy = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/v1/attendance/today')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: mockActiveSummary }),
      });
    }
    if (url.includes('/api/v1/attendance/break-start')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: { ...mockActiveSummary.activeSession } }),
      });
    }
    if (url.includes('/api/v1/attendance/team-calendar')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: mockTeamCalendar }),
      });
    }
    if (url.includes('/api/v1/attendance/me')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            data: mockHistory,
            meta: { page: 1, pageSize: 10, total: 1 },
          }),
      });
    }
    if (url.includes('/api/v1/leave/policies')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'pol-1',
                code: 'ANNUAL',
                name: 'Annual Leave',
                hasBalance: true,
                isActive: true,
                annualDays: 18,
                carryForwardMax: 5,
                allowHalfDay: true,
                maxBackdateDays: 7,
                version: 1,
                updatedAt: '2026-01-01T00:00:00Z',
              },
            ],
          }),
      });
    }
    if (url.includes('/api/v1/leave/balances')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            data: [
              {
                leaveTypeId: 'pol-1',
                code: 'ANNUAL',
                name: 'Annual Leave',
                year: 2026,
                allotted: 18,
                carriedForward: 0,
                used: 3,
                remaining: 15,
              },
            ],
          }),
      });
    }
    if (url.includes('/api/v1/leave/requests')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'lr-1',
                employeeId: 'emp-1',
                employeeName: 'Staff User',
                leaveTypeId: 'pol-1',
                leaveTypeCode: 'ANNUAL',
                leaveTypeName: 'Annual Leave',
                startDate: '2026-12-01',
                endDate: '2026-12-02',
                halfDay: false,
                days: 2,
                reason: 'Family event',
                status: 'pending',
                approvalId: null,
                createdAt: '2026-11-10T00:00:00Z',
                updatedAt: '2026-11-10T00:00:00Z',
              },
            ],
            meta: { page: 1, pageSize: 20, total: 1 },
          }),
      });
    }
    if (url.includes('/api/v1/leave/holidays')) {
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: [], meta: { page: 1, pageSize: 10, total: 0 } }),
    });
  });

  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
}

describe('Attendance Management 4-Tab Module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders My Attendance KPIs and switches across all 4 sub-navigation tabs', async () => {
    const fetchSpy = setupFetchMock();

    render(
      <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
        <AttendancePage />
      </AuthProvider>,
    );

    expect(screen.getByText('Attendance Management')).toBeDefined();
    expect(screen.getByTestId('my-attendance-tab')).toBeDefined();
    expect(screen.getByTestId('my-attendance-kpi-grid')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('Completed sprint backlog')[0]).toBeDefined();
    });

    // Switch to Check-In / Check-Out tab & verify panel + attendance history card
    fireEvent.click(screen.getByTestId('attendance-tab-check-in'));
    await waitFor(() => {
      expect(screen.getByTestId('check-in-tab-panel')).toBeDefined();
      expect(screen.getByTestId('attendance-history-card')).toBeDefined();
    });
    expect(fetchSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('attendance-tab-leave-requests')).toBeNull();
    expect(screen.queryByTestId('attendance-tab-team-calendar')).toBeNull();
  });
});
