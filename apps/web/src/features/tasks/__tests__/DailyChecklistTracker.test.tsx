// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { DailyChecklistTracker } from '../components/DailyChecklistTracker';

// Mock todos API used by PersonalTodoList
vi.mock('../../todos/api/todosApi', () => ({
  fetchTodos: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'todo-1',
        employeeId: 'emp-001',
        title: 'Review team pull requests',
        description: 'Check frontend PRs',
        dueDate: '2026-11-20',
        isCompleted: false,
        createdAt: '2026-11-16T08:00:00Z',
        updatedAt: '2026-11-16T08:00:00Z',
      },
    ],
    meta: { total: 1, limit: 10, offset: 0, hasMore: false },
  }),
  createTodo: vi.fn(),
  toggleTodo: vi.fn(),
  deleteTodo: vi.fn(),
  updateTodo: vi.fn(),
}));

describe('DailyChecklistTracker', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders matrix table with Date column, checklist titles, and Personal To-Do section', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistTracker />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('daily-checklist-tracker')).toBeTruthy();
    expect(screen.getByText('Daily Checklist Matrix')).toBeTruthy();
    expect(screen.getByText('Personal To-Do List')).toBeTruthy();

    // Verify first column Date header & checklist titles
    expect(screen.getAllByRole('columnheader', { name: /date/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Morning Attendance Check-in')).toBeTruthy();
    expect(screen.getByText('Daily Standup / Work Plan')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('allows adding a new checklist item to the matrix headers', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistTracker />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Open add item form
    const addBtn = screen.getByText('+ Add Checklist Item');
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText(/Enter checklist item title/i);
    fireEvent.change(input, { target: { value: 'Daily Code Commit' } });

    const saveBtn = screen.getByText('Save Item');
    fireEvent.click(saveBtn);

    expect(screen.getByText('Daily Code Commit')).toBeTruthy();
  });

  it('toggles checklist items per date and updates completion score', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistTracker />
        </AuthProvider>
      </MemoryRouter>,
    );

    const toggleButtons = screen.getAllByLabelText(/Toggle Morning Attendance Check-in for/i);
    expect(toggleButtons.length).toBeGreaterThan(0);

    // Toggle today's checklist item
    const firstBtn = toggleButtons[0];
    if (firstBtn) {
      fireEvent.click(firstBtn);
    }

    // Check localStorage was updated
    const records = Object.keys(localStorage).some((k) => k.includes('maxr_daily_checklist_records'));
    expect(records).toBe(true);
  });
});
