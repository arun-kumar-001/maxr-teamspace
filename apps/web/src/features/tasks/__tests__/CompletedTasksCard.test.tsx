// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompletedTasksCard } from '../components/CompletedTasksCard';
import type { Task } from '../types';

const MOCK_COMPLETED_TASKS: Task[] = [
  {
    id: 'task-c1',
    title: 'Migrate user database to PostgreSQL 16',
    description: 'Complete schema mapping and execute data transfer verification.',
    projectId: 'proj-1',
    projectName: 'Infrastructure Modernization',
    assigneeEmployeeId: 'emp-001',
    assigneeName: 'Alex Mercer',
    assignerEmployeeId: 'emp-002',
    assignerName: 'Sarah Connor',
    status: 'completed',
    priority: 'high',
    dueDate: '2026-11-20',
    isOverdue: false,
    completedAt: '2026-11-19T14:30:00.000Z',
    version: 2,
    createdAt: '2026-11-10T09:00:00.000Z',
    updatedAt: '2026-11-19T14:30:00.000Z',
  },
  {
    id: 'task-c2',
    title: 'Update onboarding security policies',
    description: 'Ensure multi-factor authentication guidelines are documented.',
    projectId: null,
    projectName: null,
    assigneeEmployeeId: 'emp-001',
    assigneeName: 'Alex Mercer',
    assignerEmployeeId: 'emp-002',
    assignerName: 'Sarah Connor',
    status: 'completed',
    priority: 'medium',
    dueDate: null,
    isOverdue: false,
    completedAt: '2026-11-22T11:00:00.000Z',
    version: 1,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-22T11:00:00.000Z',
  },
];

describe('CompletedTasksCard', () => {
  it('renders a single parent card containing vertically stacked task rows with complete metadata', () => {
    const handleSelect = vi.fn();
    render(
      <CompletedTasksCard
        tasks={MOCK_COMPLETED_TASKS}
        onSelectTask={handleSelect}
        currentEmployeeId="emp-001"
      />,
    );

    // 1. One parent card
    const parentCard = screen.getByTestId('completed-tasks-single-card');
    expect(parentCard).toBeTruthy();
    expect(parentCard.className).toContain('w-full');
    expect(parentCard.className).toContain('min-w-0');
    expect(parentCard.className).toContain('rounded-card');

    // Header count
    expect(screen.getByTestId('column-count-completed').textContent).toBe('2');
    expect(screen.getByText('2 tasks done')).toBeTruthy();

    // 2. Vertically stacked rows inside the card
    expect(screen.getByText('Migrate user database to PostgreSQL 16')).toBeTruthy();
    expect(
      screen.getByText('Complete schema mapping and execute data transfer verification.'),
    ).toBeTruthy();
    expect(screen.getByText('Update onboarding security policies')).toBeTruthy();

    // 3. Metadata: Priority, Assignee, Dates, Status, Progress
    expect(screen.getAllByText('✓ Completed').length).toBe(2);
    expect(screen.getAllByText('100% Completed').length).toBe(2);
    expect(screen.getAllByText('Alex Mercer').length).toBe(2);
    expect(screen.getByText('Infrastructure Modernization')).toBeTruthy();

    // 4. Subtle dividers container
    const dividerContainer = parentCard.querySelector('.divide-y');
    expect(dividerContainer).toBeTruthy();

    // 5. Click row triggers select
    fireEvent.click(screen.getByText('Migrate user database to PostgreSQL 16'));
    expect(handleSelect).toHaveBeenCalledWith(MOCK_COMPLETED_TASKS[0]);
  });

  it('renders empty state when no completed tasks exist', () => {
    render(<CompletedTasksCard tasks={[]} onSelectTask={vi.fn()} />);
    expect(screen.getByText('No completed tasks')).toBeTruthy();
    expect(screen.getByTestId('column-count-completed').textContent).toBe('0');
  });
});
