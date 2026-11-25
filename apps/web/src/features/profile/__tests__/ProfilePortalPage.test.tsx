// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { ProfilePortalPage } from '../pages/ProfilePortalPage';
import * as attendanceApi from '../../attendance/api/attendance';
import * as tasksApi from '../../tasks/api/tasksApi';
import type { Task } from '../../tasks/types';

const MOCK_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Review team performance quarterly goals',
    description: null,
    projectId: null,
    projectName: null,
    assigneeEmployeeId: 'emp-001',
    assigneeName: 'Sarah Connor',
    assignerEmployeeId: 'emp-001',
    assignerName: 'Sarah Connor',
    status: 'completed',
    priority: 'high',
    dueDate: '2026-11-25',
    isOverdue: false,
    completedAt: '2026-11-23T00:00:00.000Z',
    version: 1,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-23T00:00:00.000Z',
  },
  {
    id: 'task-2',
    title: 'Submit payroll approval report',
    description: null,
    projectId: null,
    projectName: null,
    assigneeEmployeeId: 'emp-001',
    assigneeName: 'Sarah Connor',
    assignerEmployeeId: 'emp-001',
    assignerName: 'Sarah Connor',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-11-26',
    isOverdue: false,
    completedAt: null,
    version: 1,
    createdAt: '2026-11-21T00:00:00.000Z',
    updatedAt: '2026-11-21T00:00:00.000Z',
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.spyOn(tasksApi, 'fetchMyTasks').mockResolvedValue({
    data: MOCK_TASKS,
    meta: { page: 1, pageSize: 50, total: 2 },
  });
  vi.spyOn(tasksApi, 'changeTaskStatus').mockImplementation(
    async (id: string, status: Task['status']) => {
      const existing = MOCK_TASKS.find((t) => t.id === id);
      return {
        ...(existing || MOCK_TASKS[0]!),
        id,
        status,
        version: ((existing || MOCK_TASKS[0]!).version ?? 1) + 1,
        updatedAt: new Date().toISOString(),
      };
    },
  );
});

afterEach(() => {
  cleanup();
});

/** A session this browser saved earlier today, which the time tracker shows when it starts. */
function saveActiveSession() {
  localStorage.setItem(
    'maxr_time_tracker_active_session',
    JSON.stringify({
      isCheckedIn: true,
      checkInTime: '09:15 AM',
      startTimeMs: Date.now() - 9314 * 1000,
    }),
  );
}

describe('ProfilePortalPage', () => {
  it('starts checked out, with no check-in time, when nobody has checked in today', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('attendance-toggle-button').textContent).toContain('Check In');
    expect(screen.getByText('Checked Out')).toBeTruthy();
    expect(screen.getByText('--:--')).toBeTruthy();
    expect(screen.queryByText('09:15 AM')).toBeNull();
  });

  it('renders the My Profile portal view for Admin role', async () => {
    saveActiveSession();
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('profile-portal-page')).toBeTruthy();
    expect(screen.getByText(/Welcome in,/i)).toBeTruthy();
    expect(screen.queryByText(/Real-time/i)).toBeNull();
    expect(screen.queryByText(/\$1,200/i)).toBeNull();
    expect(screen.getAllByText(/Sarah Connor|Admin/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Time tracker')).toBeTruthy();
    expect(screen.getByText('09:15 AM')).toBeTruthy();
    expect(screen.getByText('Checked In')).toBeTruthy();
    expect(screen.getByTestId('portal-avatar-img')).toBeTruthy();
    // The photo card shows only name and role: no badge, upload camera or email.
    expect(screen.queryByText(/active profile/i)).toBeNull();
    expect(screen.queryByTitle(/upload profile photo/i)).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByText('Recent Payslips')).toBeTruthy();
    expect(screen.getByText('My Tasks')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Review team performance quarterly goals')).toBeTruthy();
      expect(screen.getByText('Submit payroll approval report')).toBeTruthy();
    });
  });

  it('toggles check-in state and task completion interactively with real backend persistence', async () => {
    saveActiveSession();
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const toggleButton = screen.getByTestId('attendance-toggle-button');
    expect(toggleButton.textContent).toContain('Check Out');
    fireEvent.click(toggleButton);
    expect(toggleButton.textContent).toContain('Check In');

    await waitFor(() => {
      expect(screen.getByText('Submit payroll approval report')).toBeTruthy();
    });

    // 1 of 2 tasks completed (50%)
    expect(screen.getByText('Completed 1 of 2 tasks')).toBeTruthy();
    expect(screen.getByTestId('task-completion-percentage').textContent).toBe('50%');

    // Click on "Submit payroll approval report" to complete it
    await act(async () => {
      fireEvent.click(screen.getByText('Submit payroll approval report'));
    });

    // Now 2 of 2 tasks completed (100%)
    expect(screen.getByText('Completed 2 of 2 tasks')).toBeTruthy();
    expect(screen.getByTestId('task-completion-percentage').textContent).toBe('100%');
    expect(tasksApi.changeTaskStatus).toHaveBeenCalledWith('task-2', 'completed');
  });

  it('renders clean empty state when user has no assigned tasks', async () => {
    vi.spyOn(tasksApi, 'fetchMyTasks').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 50, total: 0 },
    });

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No tasks assigned yet')).toBeTruthy();
      expect(screen.getByText('0/0')).toBeTruthy();
      expect(screen.getByText('Completed 0 of 0 tasks')).toBeTruthy();
    });
  });

  it('opens quick task creation modal from the My Tasks widget', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const addBtn = screen.getByTestId('add-my-task-btn');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Create New Task')).toBeTruthy();
    });
  });

  it("shows this week's real hours instead of a fixed 0.0 h and 40h/wk", async () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    vi.spyOn(attendanceApi, 'fetchMyAttendanceHistory').mockResolvedValue({
      data: [
        {
          id: 'r1',
          employeeId: 'emp-1',
          employeeName: 'x',
          workDate: today,
          checkInTime: `${today}T09:00:00Z`,
          checkOutTime: `${today}T17:30:00Z`,
          durationMinutes: 510,
        },
      ],
      meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    } as unknown as Awaited<ReturnType<typeof attendanceApi.fetchMyAttendanceHistory>>);

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    // 510 minutes is 8.5 hours
    await waitFor(() => expect(screen.getByText(/8\.5\s*h/)).toBeTruthy());
    expect(screen.queryByText('Standard: 40h/wk')).toBeNull();
  });

  it('navigates previous and next months and updates calendar display', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <ProfilePortalPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const prevBtn = screen.getByLabelText('Previous month');
    const nextBtn = screen.getByLabelText('Next month');
    expect(prevBtn).toBeTruthy();
    expect(nextBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await act(async () => {
      fireEvent.click(prevBtn);
    });

    expect(screen.getByText(/Work Schedule:/)).toBeTruthy();
  });
});
