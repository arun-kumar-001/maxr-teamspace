// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../auth/AuthContext';
import { AttendancePage } from '../pages/AttendancePage';
import { MyAttendanceCalendarBoard } from '../components/MyAttendanceCalendarBoard';
import { MyAttendanceTab } from '../components/MyAttendanceTab';
import type { AttendanceRecord, TodayAttendanceSummary } from '../types';
import { ROLES } from '@maxr/shared';

const mockTodaySummary: TodayAttendanceSummary = {
  workDate: '2026-11-24',
  totalDurationMinutes: 0,
  sessionsCount: 0,
  activeSession: null,
  sessions: [],
};

const mockRecord1: AttendanceRecord = {
  id: 'att-rec-1',
  employeeId: 'emp-1',
  employeeName: 'Staff User',
  employeeCode: 'EMP-0001',
  workDate: '2026-11-23',
  checkInTime: '2026-11-23T09:00:00Z',
  checkOutTime: null,
  durationMinutes: null,
  breakMinutes: 0,
  status: 'absent',
  location: { workMode: 'office' },
  notes: 'Medical checkup',
  createdAt: '2026-11-23T09:00:00Z',
  updatedAt: '2026-11-23T09:00:00Z',
};

const mockRecord2: AttendanceRecord = {
  id: 'att-rec-2',
  employeeId: 'emp-1',
  employeeName: 'Staff User',
  employeeCode: 'EMP-0001',
  workDate: '2026-11-24',
  checkInTime: '2026-11-24T04:45:00Z',
  checkOutTime: '2026-11-24T12:00:00Z',
  durationMinutes: 435,
  breakMinutes: 30,
  status: 'late',
  location: { workMode: 'office' },
  notes: 'Traffic delay on highway',
  createdAt: '2026-11-24T04:45:00Z',
  updatedAt: '2026-11-24T12:00:00Z',
};

describe('Attendance Management – Mobile & Tablet Responsive Specifications', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Header and Action Buttons', () => {
    it('removes unnecessary header text and renders side-by-side equal-width action buttons', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (url.includes('/api/v1/attendance/today')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () => Promise.resolve({ data: mockTodaySummary }),
            });
          }
          if (url.includes('/api/v1/attendance/me')) {
            return Promise.resolve({
              ok: true,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: () =>
                Promise.resolve({
                  data: [mockRecord1, mockRecord2],
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

      // 1. Permanent removals check:
      expect(screen.queryByText('MAXR TEAMSPACE WORKFORCE HUB')).toBeNull();
      expect(
        screen.queryByText(
          'Track your attendance, manage check-in/out, leaves and view team attendance.',
        ),
      ).toBeNull();

      // 2. Main page heading retained:
      expect(
        screen.getByRole('heading', { level: 1, name: 'Attendance Management' }),
      ).toBeDefined();

      // 3. Sub-nav container and attendance tab buttons permanently removed:
      expect(screen.queryByTestId('attendance-subnav')).toBeNull();
      expect(screen.queryByTestId('attendance-tab-my-attendance')).toBeNull();
      expect(screen.queryByTestId('attendance-tab-check-in')).toBeNull();
    });
  });

  describe('2. Calendar Controls & 3. Summary Cards', () => {
    it('renders month title, segmented switcher, navigation buttons, and 6 KPI summary cards', () => {
      render(
        <MyAttendanceCalendarBoard
          records={[mockRecord1, mockRecord2]}
          todaySummary={mockTodaySummary}
          onOpenCorrectionModal={vi.fn()}
          onGoToCheckIn={vi.fn()}
        />,
      );

      // Segmented control buttons
      expect(screen.getByTestId('my-calendar-view-month')).toBeDefined();
      expect(screen.getByTestId('my-calendar-view-week')).toBeDefined();
      expect(screen.getByTestId('my-calendar-view-day')).toBeDefined();

      // Navigation buttons
      expect(screen.getByRole('button', { name: 'Previous period' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next period' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Today' })).toBeDefined();

      // 6 KPI Summary Cards in grid placed above navigation controls
      const kpiGrid = screen.getByTestId('my-attendance-kpi-grid');
      const todayBtn = screen.getByRole('button', { name: 'Today' });
      expect(
        Boolean(kpiGrid.compareDocumentPosition(todayBtn) & Node.DOCUMENT_POSITION_FOLLOWING),
      ).toBe(true);
      expect(kpiGrid.className).toContain('grid-cols-2');
      expect(within(kpiGrid).getByText('Working Days')).toBeDefined();
      expect(within(kpiGrid).getByText('Present')).toBeDefined();
      expect(within(kpiGrid).getByText('Absent')).toBeDefined();
      expect(within(kpiGrid).getByText('Late Arrivals')).toBeDefined();
      expect(within(kpiGrid).getByText('Leave Days')).toBeDefined();
      expect(within(kpiGrid).getByText('Attendance')).toBeDefined();
    });
  });

  describe('4. Monthly & 5. Weekly Views', () => {
    it('weekly calendar displays 7 days with left-side timer axis, short status forms, and handles day selection', () => {
      render(
        <MyAttendanceCalendarBoard
          records={[mockRecord1, mockRecord2]}
          todaySummary={mockTodaySummary}
          onOpenCorrectionModal={vi.fn()}
          onGoToCheckIn={vi.fn()}
        />,
      );

      const weekGrid = screen.getByTestId('my-attendance-week-grid');
      expect(weekGrid).toBeDefined();

      // Left-side time axis present with 9 AM and 6 PM
      const timeline = screen.getByLabelText('Daily work hours timeline');
      expect(within(timeline).getAllByText('9 AM').length).toBeGreaterThan(0);
      expect(within(timeline).getAllByText('6 PM').length).toBeGreaterThan(0);

      // Short status forms rendered for mobile
      expect(screen.getByText('Abs')).toBeDefined();
      expect(screen.getAllByText('Late').length).toBeGreaterThan(0);

      // Day selection opens popover
      const lateCard = screen.getByTestId('week-day-card-2026-11-24');
      fireEvent.click(lateCard);
      expect(screen.getByTestId('attendance-detail-popover')).toBeDefined();

      // Switch to month view
      fireEvent.click(screen.getByTestId('my-calendar-view-month'));
      expect(screen.getByTestId('my-attendance-month-grid')).toBeDefined();

      // Switch to day view
      fireEvent.click(screen.getByTestId('my-calendar-view-day'));
      expect(screen.getByTestId('my-attendance-day-view')).toBeDefined();
    });
  });

  describe('7. Attendance Records & History with Filter Button and Expandable Cards', () => {
    it('renders filter button with active indicator, opens filter dialog, and renders expandable mobile cards', async () => {
      const onOpenCorrectionModal = vi.fn();
      const setStartDate = vi.fn();
      const setEndDate = vi.fn();
      const setStatus = vi.fn();
      const resetFilters = vi.fn();

      render(
        <MyAttendanceTab
          records={[mockRecord1, mockRecord2]}
          meta={{ page: 1, pageSize: 10, total: 2 }}
          isLoading={false}
          error={null}
          scope="own"
          setScope={vi.fn()}
          displayMode="list"
          setDisplayMode={vi.fn()}
          startDate="2026-11-01"
          setStartDate={setStartDate}
          endDate="2026-11-30"
          setEndDate={setEndDate}
          status=""
          setStatus={setStatus}
          page={1}
          setPage={vi.fn()}
          sortBy="workDate"
          sortOrder="desc"
          setSorting={vi.fn()}
          resetFilters={resetFilters}
          refresh={vi.fn().mockResolvedValue(undefined)}
          canViewTeam={false}
          todaySummary={mockTodaySummary}
          corrections={[]}
          correctionsMeta={{ page: 1, pageSize: 10, total: 0 }}
          isCorrectionsLoading={false}
          correctionsError={null}
          correctionsPage={1}
          setCorrectionsPage={vi.fn()}
          onCancelCorrection={vi.fn().mockResolvedValue(undefined)}
          onRefetchCorrections={vi.fn()}
          onOpenCorrectionModal={onOpenCorrectionModal}
          onGoToCheckIn={vi.fn()}
        />,
      );

      // Filter button with active filter dot (only on mobile view, hidden on desktop)
      const filterBtn = screen.getByTestId('attendance-filter-toggle-btn');
      expect(filterBtn).toBeDefined();
      expect(filterBtn.className).toContain('lg:hidden');
      expect(screen.getByLabelText('Active filters applied')).toBeDefined();

      // Open filter dialog / sheet
      fireEvent.click(filterBtn);
      expect(screen.getByLabelText('Filter Attendance Records')).toBeDefined();
      expect(screen.getByText('Filter Attendance Records')).toBeDefined();

      // Click Reset inside filter sheet
      const resetBtn = screen.getByRole('button', { name: 'Reset' });
      fireEvent.click(resetBtn);
      expect(resetFilters).toHaveBeenCalled();

      // Mobile expandable cards
      const mobileCards = screen.getByTestId('attendance-mobile-cards');
      expect(mobileCards).toBeDefined();

      const card1 = screen.getByTestId('attendance-record-card-att-rec-1');
      expect(card1).toBeDefined();

      // Initially collapsed: notes not visible within card
      expect(within(card1).queryByText('Medical checkup')).toBeNull();

      // Click card to expand
      const clickableHeader = within(card1).getByRole('button', { expanded: false });
      fireEvent.click(clickableHeader);

      // Now expanded: notes and "Request Correction" button visible
      expect(within(card1).getByText('Medical checkup')).toBeDefined();
      const correctBtn = within(card1).getByTestId('request-correction-btn-att-rec-1');
      expect(correctBtn).toBeDefined();

      // Trigger correction modal
      fireEvent.click(correctBtn);
      expect(onOpenCorrectionModal).toHaveBeenCalledWith(mockRecord1);
    });

    it('filters attendance records in real-time via search input and handles empty search state', () => {
      render(
        <MyAttendanceTab
          records={[mockRecord1, mockRecord2]}
          meta={{ page: 1, pageSize: 10, total: 2 }}
          isLoading={false}
          error={null}
          scope="own"
          setScope={vi.fn()}
          displayMode="list"
          setDisplayMode={vi.fn()}
          startDate=""
          setStartDate={vi.fn()}
          endDate=""
          setEndDate={vi.fn()}
          status=""
          setStatus={vi.fn()}
          page={1}
          setPage={vi.fn()}
          sortBy="workDate"
          sortOrder="desc"
          setSorting={vi.fn()}
          resetFilters={vi.fn()}
          refresh={vi.fn().mockResolvedValue(undefined)}
          canViewTeam={false}
          todaySummary={mockTodaySummary}
          corrections={[]}
          correctionsMeta={{ page: 1, pageSize: 10, total: 0 }}
          isCorrectionsLoading={false}
          correctionsError={null}
          correctionsPage={1}
          setCorrectionsPage={vi.fn()}
          onCancelCorrection={vi.fn().mockResolvedValue(undefined)}
          onRefetchCorrections={vi.fn()}
          onOpenCorrectionModal={vi.fn()}
          onGoToCheckIn={vi.fn()}
        />,
      );

      const searchInput = screen.getByTestId('attendance-records-search');
      expect(searchInput).toBeDefined();

      // Both records exist initially
      expect(screen.getByTestId('attendance-record-card-att-rec-1')).toBeDefined();
      expect(screen.getByTestId('attendance-record-card-att-rec-2')).toBeDefined();

      // Search by keyword "traffic"
      fireEvent.change(searchInput, { target: { value: 'traffic' } });
      expect(screen.queryByTestId('attendance-record-card-att-rec-1')).toBeNull();
      expect(screen.getByTestId('attendance-record-card-att-rec-2')).toBeDefined();

      // Search with non-matching query
      fireEvent.change(searchInput, { target: { value: 'nonexistentquery' } });
      expect(screen.getByText('No matching records found')).toBeDefined();
      expect(screen.getByText('Clear Search')).toBeDefined();

      // Clear search restores all records
      fireEvent.click(screen.getByText('Clear Search'));
      expect(screen.getByTestId('attendance-record-card-att-rec-1')).toBeDefined();
      expect(screen.getByTestId('attendance-record-card-att-rec-2')).toBeDefined();
    });
  });
});
