// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../auth/AuthContext';
import { AdminDashboard } from '../AdminDashboard';
import { StaffDashboard } from '../StaffDashboard';
import {
  FALLBACK_TASKS,
  notifyTaskStatusChanged,
} from '../../features/tasks';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
});

describe('Dashboard Task Completion & Progress Updates (Issue #4)', () => {
  it('StaffDashboard updates Task Completion Process interactively when toggling tasks', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <StaffDashboard />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Initial 2 of 8 tasks are completed (25%)
    const pctElement = screen.getByTestId('task-completion-percentage');
    expect(pctElement.textContent).toBe('25%');

    // Click on "Update sprint tasks" to complete it
    const sprintTask = screen.getByText('Update sprint tasks');
    fireEvent.click(sprintTask);

    // Now 3 of 8 tasks are completed (3 / 8 = 38%)
    expect(pctElement.textContent).toBe('38%');
    expect(screen.getByText(/3 \/ 8 tasks/i)).toBeTruthy();

    // Toggle again to uncomplete
    fireEvent.click(sprintTask);
    expect(pctElement.textContent).toBe('25%');
  });

  it('AdminDashboard reflects live task completion and updates progress bar and counts', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <AdminDashboard />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('admin-dashboard')).toBeTruthy();

    // Initial tasks from FALLBACK_TASKS have 1 completed out of 3 (33%)
    expect(screen.getByText(/Task Overview/i)).toBeTruthy();
    expect(screen.getByText('Priority Tasks')).toBeTruthy();

    // Broadcast a status change for "Implement User CSV Export" to completed
    act(() => {
      notifyTaskStatusChanged(FALLBACK_TASKS[0]!.id, 'completed');
    });

    // Both task 1 and task 3 are now completed (2 / 3 = 67%)
    expect(screen.getByText(/2 \/ 3 Tasks/i)).toBeTruthy();

    // Clicking the Priority Task badge directly toggles status and progress
    const completedBadge = screen.getAllByRole('button', { name: /Completed/i })[0]!;
    await act(async () => {
      fireEvent.click(completedBadge);
    });

    // Toggled back to in_progress, so now 1 / 3 Tasks
    expect(screen.getByText(/1 \/ 3 Tasks/i)).toBeTruthy();
  });
});
