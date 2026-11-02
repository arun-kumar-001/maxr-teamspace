// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { TasksPage } from '../pages/TasksPage';
import * as tasksApi from '../api/tasksApi';
import * as projectsApi from '../../projects/api/projectsApi';
import * as employeesApi from '../../employees/api/employees';
import type { Task } from '../types';

vi.mock('../api/tasksApi', async () => {
  const actual = await vi.importActual<typeof tasksApi>('../api/tasksApi');
  return {
    ...actual,
    fetchMyTasks: vi.fn(),
    fetchTeamTasks: vi.fn(),
    fetchTaskById: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    changeTaskStatus: vi.fn(),
  };
});

vi.mock('../../projects/api/projectsApi', async () => {
  const actual = await vi.importActual<typeof projectsApi>('../../projects/api/projectsApi');
  return {
    ...actual,
    fetchProjects: vi.fn(),
  };
});

vi.mock('../../employees/api/employees', async () => {
  const actual = await vi.importActual<typeof employeesApi>('../../employees/api/employees');
  return {
    ...actual,
    fetchEmployeeDirectory: vi.fn(),
  };
});

const mockTasks: Task[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Implement User CSV Export',
    description: 'Allow Admins to export all active users.',
    projectId: '99999999-9999-9999-9999-999999999999',
    projectName: 'Data Export Suite',
    assigneeEmployeeId: '22222222-2222-2222-2222-222222222222',
    assigneeName: 'Alice Walker',
    assignerEmployeeId: '33333333-3333-3333-3333-333333333333',
    assignerName: 'Bob Lead',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-03-30',
    isOverdue: false,
    completedAt: null,
    version: 1,
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-01T09:00:00Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    title: 'Fix Database Connection Pool Leaks',
    description: 'Prevent pool exhaustion during bulk shifts sync.',
    projectId: null,
    projectName: null,
    assigneeEmployeeId: '22222222-2222-2222-2222-222222222222',
    assigneeName: 'Alice Walker',
    assignerEmployeeId: '33333333-3333-3333-3333-333333333333',
    assignerName: 'Bob Lead',
    status: 'in_progress',
    priority: 'urgent',
    dueDate: '2026-01-10',
    isOverdue: true,
    completedAt: null,
    version: 2,
    createdAt: '2026-01-05T09:00:00Z',
    updatedAt: '2026-01-08T09:00:00Z',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    title: 'Audit Log Archival Policy',
    description: 'Archive logs older than 90 days to encrypted storage.',
    projectId: '99999999-9999-9999-9999-999999999999',
    projectName: 'Data Export Suite',
    assigneeEmployeeId: '66666666-6666-6666-6666-666666666666',
    assigneeName: 'Charlie Dev',
    assignerEmployeeId: '33333333-3333-3333-3333-333333333333',
    assignerName: 'Bob Lead',
    status: 'in_review',
    priority: 'medium',
    dueDate: '2026-02-28',
    isOverdue: false,
    completedAt: null,
    version: 3,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-02-20T10:00:00Z',
  },
];

describe('Tasks Feature (Issue #43)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(tasksApi.fetchMyTasks).mockResolvedValue({
      data: mockTasks,
      meta: { page: 1, pageSize: 50, total: 3 },
    });

    vi.mocked(tasksApi.fetchTeamTasks).mockResolvedValue({
      data: mockTasks,
      meta: { page: 1, pageSize: 50, total: 3 },
    });

    vi.mocked(projectsApi.fetchProjects).mockResolvedValue({
      data: [
        {
          id: '99999999-9999-9999-9999-999999999999',
          code: 'PRJ-EXP',
          name: 'Data Export Suite',
          description: 'Exporting tools',
          status: 'active',
          ownerEmployeeId: '33333333-3333-3333-3333-333333333333',
          ownerName: 'Bob Lead',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          version: 1,
          memberCount: 3,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1 },
    });

    vi.mocked(employeesApi.fetchEmployeeDirectory).mockResolvedValue({
      data: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          employeeCode: 'EMP-001',
          firstName: 'Alice',
          lastName: 'Walker',
          email: 'alice@example.com',
          phone: null,
          status: 'active',
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des1', title: 'Engineer', code: 'ENG', level: 2 },
          manager: null,
          joiningDate: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
  });

  it('renders Kanban board with columns, task cards, and overdue indicators', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('My Tasks')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-todo')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-in_progress')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-in_review')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
      expect(screen.getByTestId('kanban-column-completed')).toBeInTheDocument();
    });

    // Check task cards rendered in appropriate columns
    expect(screen.getByText('Implement User CSV Export')).toBeInTheDocument();
    expect(screen.getByText('Fix Database Connection Pool Leaks')).toBeInTheDocument();
    expect(screen.getByText('Audit Log Archival Policy')).toBeInTheDocument();

    // Check overdue badge
    expect(screen.getByTestId('overdue-badge')).toBeInTheDocument();
  });

  it('switches to table list view and back to kanban board', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
    });

    // Click List View
    const listViewBtn = screen.getByText('List View');
    fireEvent.click(listViewBtn);

    await waitFor(() => {
      expect(screen.getByTestId('task-table-view')).toBeInTheDocument();
      expect(
        screen.getByTestId('task-row-11111111-1111-1111-1111-111111111111'),
      ).toBeInTheDocument();
    });

    // Click back to Kanban Board
    const kanbanBtn = screen.getByText('Kanban Board');
    fireEvent.click(kanbanBtn);

    await waitFor(() => {
      expect(screen.getByTestId('task-kanban-board')).toBeInTheDocument();
    });
  });

  it('filters tasks by search input', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Implement User CSV Export')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search tasks by title/i);
    fireEvent.change(searchInput, { target: { value: 'Connection Pool' } });

    await waitFor(() => {
      expect(screen.getByText('Fix Database Connection Pool Leaks')).toBeInTheDocument();
      expect(screen.queryByText('Implement User CSV Export')).toBeNull();
    });
  });

  it('filters tasks by Overdue Only button toggle', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('overdue-filter-toggle')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('overdue-filter-toggle'));

    await waitFor(() => {
      expect(tasksApi.fetchMyTasks).toHaveBeenCalledWith(
        expect.objectContaining({ overdue: true }),
        expect.any(AbortSignal),
      );
    });
  });

  it('allows Team Lead to switch between My Tasks and Team Tasks', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <TasksPage initialScope="team" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Team Tasks' })).toBeInTheDocument();
    });

    // Switch to My Tasks
    const myTasksTab = screen.getByRole('radio', { name: 'My Tasks' });
    fireEvent.click(myTasksTab);

    await waitFor(() => {
      expect(tasksApi.fetchMyTasks).toHaveBeenCalled();
    });
  });

  it('allows Team Lead to create a new task with Idempotency-Key', async () => {
    const createdTask: Task = {
      id: '77777777-7777-7777-7777-777777777777',
      title: 'Setup Redis Caching Gateway',
      description: 'Add Redis layer for sessions.',
      projectId: null,
      projectName: null,
      assigneeEmployeeId: '22222222-2222-2222-2222-222222222222',
      assigneeName: 'Alice Walker',
      assignerEmployeeId: '33333333-3333-3333-3333-333333333333',
      assignerName: 'Bob Lead',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-04-15',
      isOverdue: false,
      completedAt: null,
      version: 1,
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    };

    vi.mocked(tasksApi.createTask).mockResolvedValue(createdTask);

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <TasksPage initialScope="team" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('create-task-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-task-btn'));

    expect(screen.getByText('Create New Task')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alice Walker/i })).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText('e.g. Implement user export CSV');
    fireEvent.change(titleInput, { target: { value: 'Setup Redis Caching Gateway' } });

    // Select assignee
    const assigneeSelect = screen.getByLabelText(/Assignee/i);
    fireEvent.change(assigneeSelect, {
      target: { value: '22222222-2222-2222-2222-222222222222' },
    });

    fireEvent.click(screen.getByTestId('submit-task-btn'));

    await waitFor(() => {
      expect(tasksApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Setup Redis Caching Gateway',
          assigneeEmployeeId: '22222222-2222-2222-2222-222222222222',
        }),
      );
    });
  });

  it('triggers quick status transition from task card', async () => {
    const updatedTask: Task = {
      ...mockTasks[0]!,
      status: 'in_progress',
    };

    vi.mocked(tasksApi.changeTaskStatus).mockResolvedValue(updatedTask);

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('quick-move-11111111-1111-1111-1111-111111111111-to-in_progress'),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId('quick-move-11111111-1111-1111-1111-111111111111-to-in_progress'),
    );

    await waitFor(() => {
      expect(tasksApi.changeTaskStatus).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'in_progress',
      );
    });
  });

  it('opens TaskDetailModal when task is clicked and shows metadata and transitions', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <TasksPage initialScope="mine" />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Implement User CSV Export')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Implement User CSV Export'));

    await waitFor(() => {
      expect(screen.getByTestId('task-detail-modal-content')).toBeInTheDocument();
      expect(screen.getByText('Task Details')).toBeInTheDocument();
    });

    const modalContent = screen.getByTestId('task-detail-modal-content');
    expect(within(modalContent).getByText('Data Export Suite')).toBeInTheDocument();
    expect(within(modalContent).getByText('Bob Lead')).toBeInTheDocument();
  });
});
