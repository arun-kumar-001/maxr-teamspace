// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../auth/AuthContext';
import { AttendanceCalendarView } from '../components/AttendanceCalendarView';
import { AttendanceFilters } from '../components/AttendanceFilters';
import { AttendanceStatusBadge } from '../components/AttendanceStatusBadge';
import { AttendanceWidget } from '../components/AttendanceWidget';
import { TeamAttendanceGrid } from '../components/TeamAttendanceGrid';
import { AttendancePage } from '../pages/AttendancePage';
import type { AttendanceRecord, TodayAttendanceSummary } from '../types';
import { ROLES } from '@maxr/shared';

const mockSummaryNotCheckedIn: TodayAttendanceSummary = {
  workDate: '2026-10-31',
  totalDurationMinutes: 0,
  sessionsCount: 0,
  activeSession: null,
  sessions: [],
};

const mockActiveRecord: AttendanceRecord = {
  id: 'att-session-1',
  employeeId: 'emp-101',
  employeeName: 'Jane Doe',
  workDate: '2026-10-31',
  checkInTime: new Date(Date.now() - 3600000).toISOString(), // 1 hr ago
  checkOutTime: null,
  durationMinutes: null,
  status: 'present',
  location: { workMode: 'office' },
  notes: 'Working from headquarters',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockSummaryCheckedIn: TodayAttendanceSummary = {
  workDate: '2026-10-31',
  totalDurationMinutes: 60,
  sessionsCount: 1,
  activeSession: mockActiveRecord,
  sessions: [mockActiveRecord],
};

const mockHistoryRecords: AttendanceRecord[] = [
  {
    id: 'rec-1',
    employeeId: 'emp-101',
    employeeName: 'Jane Doe',
    workDate: '2026-10-30',
    checkInTime: '2026-10-30T09:00:00Z',
    checkOutTime: '2026-10-30T17:30:00Z',
    durationMinutes: 510,
    status: 'present',
    location: { workMode: 'office' },
    notes: 'Completed sprint backlog',
    createdAt: '2026-10-30T09:00:00Z',
    updatedAt: '2026-10-30T17:30:00Z',
  },
  {
    id: 'rec-2',
    employeeId: 'emp-102',
    employeeName: 'Alex Smith',
    workDate: '2026-10-29',
    checkInTime: '2026-10-29T09:45:00Z',
    checkOutTime: '2026-10-29T18:00:00Z',
    durationMinutes: 495,
    status: 'late',
    location: { workMode: 'remote' },
    notes: 'Traffic delay',
    createdAt: '2026-10-29T09:45:00Z',
    updatedAt: '2026-10-29T18:00:00Z',
  },
];

describe('Attendance Feature UI Components & Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('AttendanceStatusBadge', () => {
    it('renders correct labels and styles for each status', () => {
      const { unmount } = render(<AttendanceStatusBadge status="present" />);
      expect(screen.getByText('Present')).toBeDefined();
      expect(screen.getByTestId('attendance-status-present')).toBeDefined();
      unmount();

      render(<AttendanceStatusBadge status="late" />);
      expect(screen.getByText('Late')).toBeDefined();
      expect(screen.getByTestId('attendance-status-late')).toBeDefined();
    });
  });

  describe('AttendanceWidget', () => {
    it('renders checked out state with check-in button and mode toggle', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/v1/attendance/today')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: mockSummaryNotCheckedIn }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }),
      );

      render(<AttendanceWidget />);

      await waitFor(() => {
        expect(screen.getByText('Shift Pending', { exact: false })).toBeDefined();
      });

      expect(screen.getByTestId('mode-office-btn')).toBeDefined();
      expect(screen.getByTestId('mode-remote-btn')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Check In Now' })).toBeDefined();
    });

    it('performs check-in when action button clicked', async () => {
      const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        if (url.includes('/api/v1/attendance/today')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ data: mockSummaryNotCheckedIn }),
          });
        }
        if (url.includes('/api/v1/attendance/check-in') && opts?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ data: mockActiveRecord }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      vi.stubGlobal('fetch', fetchMock);

      render(<AttendanceWidget />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Check In Now' })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Check In Now' }));

      await waitFor(() => {
        const checkInCall = fetchMock.mock.calls.find(([u]) =>
          String(u).includes('/api/v1/attendance/check-in'),
        );
        expect(checkInCall).toBeDefined();
      });
    });

    it('renders active checked-in session with check-out button', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/v1/attendance/today')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: mockSummaryCheckedIn }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }),
      );

      render(<AttendanceWidget />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Check Out for Today' })).toBeDefined();
      });
    });

    it('displays error banner when check-in fails with conflict', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
          if (url.includes('/api/v1/attendance/today')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: mockSummaryNotCheckedIn }),
            });
          }
          if (url.includes('/api/v1/attendance/check-in') && opts?.method === 'POST') {
            return Promise.resolve({
              ok: false,
              status: 409,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () =>
                Promise.resolve({
                  error: { code: 'CONFLICT', message: 'An open session already exists' },
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }),
      );

      render(<AttendanceWidget />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Check In Now' })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Check In Now' }));

      await waitFor(() => {
        expect(screen.getByText('An open session already exists')).toBeDefined();
      });
    });
  });

  describe('AttendanceFilters', () => {
    it('handles start date, end date, status, scope and display mode changes', () => {
      const onStartDateChange = vi.fn();
      const onEndDateChange = vi.fn();
      const onStatusChange = vi.fn();
      const onScopeChange = vi.fn();
      const onDisplayModeChange = vi.fn();
      const onReset = vi.fn();

      render(
        <AttendanceFilters
          startDate="2026-10-01"
          endDate="2026-10-31"
          status="present"
          scope="team"
          displayMode="list"
          canViewTeam={true}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onStatusChange={onStatusChange}
          onScopeChange={onScopeChange}
          onDisplayModeChange={onDisplayModeChange}
          onReset={onReset}
        />,
      );

      expect(screen.getByTestId('attendance-filters')).toBeDefined();

      // Scope change
      fireEvent.click(screen.getByTestId('scope-own-btn'));
      expect(onScopeChange).toHaveBeenCalledWith('own');

      // Display mode change
      fireEvent.click(screen.getByTestId('view-calendar-btn'));
      expect(onDisplayModeChange).toHaveBeenCalledWith('calendar');

      // Reset
      fireEvent.click(screen.getByTestId('reset-filters-button'));
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('AttendanceCalendarView', () => {
    it('renders month grid and displays selected date details', () => {
      render(
        <AttendanceCalendarView
          records={mockHistoryRecords}
          initialDate={new Date('2026-10-15')}
        />,
      );

      expect(screen.getByTestId('attendance-calendar-view')).toBeDefined();
      expect(screen.getByTestId('calendar-days-grid')).toBeDefined();

      // Click on day 30
      const day30 = screen.getByTestId('calendar-day-2026-10-30');
      fireEvent.click(day30);

      expect(screen.getByTestId('selected-day-details')).toBeDefined();
      expect(screen.getByText('Details for 2026-10-30')).toBeDefined();
    });
  });

  describe('TeamAttendanceGrid', () => {
    it('renders team table and mobile cards', () => {
      render(<TeamAttendanceGrid records={mockHistoryRecords} />);

      expect(screen.getByTestId('team-attendance-grid')).toBeDefined();
      expect(screen.getAllByText('Alex Smith')[0]).toBeDefined();
      expect(screen.getByTestId('team-grid-mobile-cards')).toBeDefined();
    });

    it('renders empty state when no team records exist', () => {
      render(<TeamAttendanceGrid records={[]} />);
      expect(screen.getByTestId('team-grid-empty')).toBeDefined();
    });
  });

  describe('AttendancePage Integration', () => {
    it('loads and renders attendance widget and history records', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/v1/attendance/today')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: mockSummaryNotCheckedIn }),
            });
          }
          if (url.includes('/api/v1/attendance/me')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () =>
                Promise.resolve({
                  data: mockHistoryRecords,
                  meta: { page: 1, pageSize: 10, total: 2 },
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        }),
      );

      render(
        <MemoryRouter>
          <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
            <AttendancePage />
          </AuthProvider>
        </MemoryRouter>,
      );

      expect(screen.getByTestId('attendance-page')).toBeDefined();

      await waitFor(() => {
        expect(screen.getAllByText('Completed sprint backlog')[0]).toBeDefined();
      });
    });
  });
});
