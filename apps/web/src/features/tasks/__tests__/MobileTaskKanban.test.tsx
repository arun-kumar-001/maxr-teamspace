// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTaskCard } from '../components/MobileTaskCard';
import { TaskKanbanBoard } from '../components/TaskKanbanBoard';
import type { Task } from '../types';

const MOCK_GENERAL_TASK: Task = {
  id: 'task-gen-1',
  title: 'Audit Log Archival Policy',
  description: 'Archive logs older than 90 days to encrypted storage.',
  projectId: 'proj-1',
  projectName: 'Security Compliance',
  assigneeEmployeeId: 'emp-staff-1',
  assigneeName: 'Venkat Bala',
  assignerEmployeeId: 'emp-admin-1',
  assignerName: 'Mohamed Azad',
  assignerRole: 'Admin',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-12-01',
  isOverdue: false,
  completedAt: null,
  version: 1,
  createdAt: '2026-11-20T10:00:00Z',
  updatedAt: '2026-11-20T10:00:00Z',
};

const MOCK_SELF_TASK: Task = {
  id: 'task-self-1',
  title: 'Update daily timesheet & sprint review',
  description: 'Review my weekly attendance and project hours.',
  projectId: null,
  projectName: null,
  assigneeEmployeeId: 'emp-staff-1',
  assigneeName: 'Venkat Bala',
  assignerEmployeeId: 'emp-staff-1',
  assignerName: 'Venkat Bala',
  assignerRole: 'Staff',
  status: 'in_progress',
  priority: 'medium',
  dueDate: '2026-11-28',
  isOverdue: false,
  completedAt: null,
  version: 1,
  createdAt: '2026-11-21T09:00:00Z',
  updatedAt: '2026-11-21T09:00:00Z',
};

describe('MobileTaskCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders General Task badge with team icon, assigner name, and role', () => {
    const handleSelect = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={handleSelect}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Label and badge
    const badge = screen.getByTestId('task-type-badge-task-gen-1');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('General Task');

    // Title and Project
    expect(screen.getByText('Audit Log Archival Policy')).toBeInTheDocument();
    expect(screen.getByText('Security Compliance')).toBeInTheDocument();

    // Assignment info
    expect(screen.getByText('Assigned by')).toBeInTheDocument();
    expect(screen.getByText('Mohamed Azad (Admin)')).toBeInTheDocument();

    // Priority badge
    expect(screen.getByText('High')).toBeInTheDocument();

    // Progress bar for todo (15%)
    expect(screen.getByText(/15%/)).toBeInTheDocument();
  });

  it('renders Self Task badge with single-person icon and "(You)" attribution', () => {
    const handleSelect = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_SELF_TASK}
        onSelect={handleSelect}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Label and badge
    const badge = screen.getByTestId('task-type-badge-task-self-1');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('Self Task');

    // Attribution
    expect(screen.getByText('Created by')).toBeInTheDocument();
    expect(screen.getByText('Venkat Bala (You)')).toBeInTheDocument();

    // Progress bar for in_progress (50%)
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('provides 3-dot action menu with To Do, In Progress, In Review, and Hold for staff (Completed is hidden)', () => {
    const handleStatusChange = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={handleStatusChange}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Open menu
    const menuBtn = screen.getByTestId('task-menu-btn-task-gen-1');
    fireEvent.click(menuBtn);

    // Permitted options
    expect(screen.getByTestId('menu-move-task-gen-1-to-todo')).toBeInTheDocument();
    expect(screen.getByTestId('menu-move-task-gen-1-to-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('menu-move-task-gen-1-to-in_review')).toBeInTheDocument();
    expect(screen.getByTestId('menu-move-task-gen-1-to-blocked')).toBeInTheDocument();

    // CRITICAL: Staff MUST NOT have Completed in menu
    expect(screen.queryByTestId('menu-move-task-gen-1-to-completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Approve & Complete')).not.toBeInTheDocument();

    // Moving to In Progress triggers callback
    fireEvent.click(screen.getByTestId('menu-move-task-gen-1-to-in_progress'));
    expect(handleStatusChange).toHaveBeenCalledWith('task-gen-1', 'in_progress');
  });

  it('shows "Approve & Complete" in 3-dot menu when user is Admin', () => {
    const handleStatusChange = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={handleStatusChange}
        currentEmployeeId="emp-admin-1"
        isAdmin={true}
      />,
    );

    // Open menu
    const menuBtn = screen.getByTestId('task-menu-btn-task-gen-1');
    fireEvent.click(menuBtn);

    // Admin sees Approve & Complete
    const completeOption = screen.getByTestId('menu-move-task-gen-1-to-completed');
    expect(completeOption).toBeInTheDocument();
    expect(completeOption.textContent).toContain('Approve & Complete');

    fireEvent.click(completeOption);
    expect(handleStatusChange).toHaveBeenCalledWith('task-gen-1', 'completed');
  });

  it('renders a visible six-dot drag handle separate from the 3-dot menu button', () => {
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Both buttons should exist and be distinct
    const dragHandle = screen.getByTestId('drag-handle-task-gen-1');
    const menuBtn = screen.getByTestId('task-menu-btn-task-gen-1');

    expect(dragHandle).toBeInTheDocument();
    expect(menuBtn).toBeInTheDocument();
    expect(dragHandle).not.toBe(menuBtn);
  });

  it('triggers onTouchDragStart when touching the six-dot drag handle', () => {
    const handleTouchDragStart = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        onTouchDragStart={handleTouchDragStart}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    const dragHandle = screen.getByTestId('drag-handle-task-gen-1');
    fireEvent.touchStart(dragHandle, {
      touches: [{ clientX: 100, clientY: 200 }],
    });

    expect(handleTouchDragStart).toHaveBeenCalledTimes(1);
    expect(handleTouchDragStart).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_GENERAL_TASK,
      'handle',
      expect.anything(),
    );
  });

  it('cancels long press drag if touch moves > 8px before 350ms (allows normal scrolling)', () => {
    vi.useFakeTimers();
    const handleTouchDragStart = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        onTouchDragStart={handleTouchDragStart}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    const card = screen.getByTestId('task-card-task-gen-1');
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }],
    });

    // Move vertically by 25px (normal vertical scrolling)
    fireEvent.touchMove(card, {
      touches: [{ clientX: 100, clientY: 125 }],
    });

    // Fast-forward past 350ms
    vi.advanceTimersByTime(400);

    // Should NOT have triggered drag because user was scrolling
    expect(handleTouchDragStart).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('activates touch drag on long press (350ms) when finger stays stationary', () => {
    vi.useFakeTimers();
    const handleTouchDragStart = vi.fn();
    render(
      <MobileTaskCard
        task={MOCK_GENERAL_TASK}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
        onTouchDragStart={handleTouchDragStart}
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    const card = screen.getByTestId('task-card-task-gen-1');
    fireEvent.touchStart(card, {
      touches: [{ clientX: 100, clientY: 100 }],
    });

    // Hold stationary for 350ms
    vi.advanceTimersByTime(360);

    expect(handleTouchDragStart).toHaveBeenCalledTimes(1);
    expect(handleTouchDragStart).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_GENERAL_TASK,
      'longpress',
      expect.anything(),
    );
    vi.useRealTimers();
  });
});

describe('Mobile TaskKanbanBoard Layout & Permissions', () => {
  it('renders all 5 vertically stacked sections in correct order on mobile', () => {
    const columns = {
      todo: [MOCK_GENERAL_TASK],
      in_progress: [MOCK_SELF_TASK],
      in_review: [],
      blocked: [],
      completed: [],
    };

    render(
      <TaskKanbanBoard
        columns={columns}
        onSelectTask={vi.fn()}
        layoutMode="mobile"
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Verify all 5 columns are rendered
    expect(screen.getByTestId('kanban-column-todo')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in_progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in_review')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-completed')).toBeInTheDocument();

    // Verify task counts
    expect(screen.getByTestId('column-count-todo').textContent).toBe('1');
    expect(screen.getByTestId('column-count-in_progress').textContent).toBe('1');
    expect(screen.getByTestId('column-count-in_review').textContent).toBe('0');
    expect(screen.getByTestId('column-count-blocked').textContent).toBe('0');
    expect(screen.getByTestId('column-count-completed').textContent).toBe('0');
  });

  it('prevents non-admin employees from dropping tasks into Completed and displays alert notice', () => {
    const columns = {
      todo: [MOCK_GENERAL_TASK],
      in_progress: [],
      in_review: [],
      blocked: [],
      completed: [],
    };
    const handleStatusChange = vi.fn();

    render(
      <TaskKanbanBoard
        columns={columns}
        onSelectTask={vi.fn()}
        onStatusChange={handleStatusChange}
        layoutMode="mobile"
        currentEmployeeId="emp-staff-1"
        isAdmin={false}
      />,
    );

    // Simulate drag start on task card
    const taskCard = screen.getByTestId('task-card-task-gen-1');
    const dataTransfer = { setData: vi.fn(), effectAllowed: 'move' };
    fireEvent.dragStart(taskCard, { dataTransfer });

    // Attempt to drop into completed column
    const completedCol = screen.getByTestId('kanban-column-completed');
    fireEvent.drop(completedCol, { preventDefault: vi.fn() });

    // Callback should not be called
    expect(handleStatusChange).not.toHaveBeenCalled();

    // Alert notice displayed
    expect(
      screen.getByText(
        'Employees cannot move tasks directly to Completed. An Administrator must review and approve.',
      ),
    ).toBeInTheDocument();
  });
});
