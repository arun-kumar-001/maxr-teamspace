// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TaskTodoListSidebar } from '../components/TaskTodoListSidebar';

describe('TaskTodoListSidebar (My Tasks Right-Side To-Do Panel)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the To-Do list panel and default tasks', () => {
    render(<TaskTodoListSidebar />);

    expect(screen.getByTestId('tasks-side-todo-panel')).toBeInTheDocument();
    expect(screen.getByText('To-Do List')).toBeInTheDocument();
    expect(screen.getByText('Daily checklist & quick tasks')).toBeInTheDocument();
    expect(screen.getByTestId('add-todo-btn')).toBeInTheDocument();
    expect(screen.getByTestId('todo-title-todo-1')).toHaveTextContent('Daily standup & team status check');
  });

  it('filters by All, Daily, and Once', () => {
    render(<TaskTodoListSidebar />);

    // Filter to Once only
    fireEvent.click(screen.getByTestId('filter-btn-once'));
    expect(screen.getByTestId('todo-title-todo-3')).toHaveTextContent('Verify onboarding checklist documents');
    expect(screen.queryByTestId('todo-title-todo-1')).not.toBeInTheDocument();

    // Filter to Daily only
    fireEvent.click(screen.getByTestId('filter-btn-daily'));
    expect(screen.getByTestId('todo-title-todo-1')).toHaveTextContent('Daily standup & team status check');
    expect(screen.queryByTestId('todo-title-todo-3')).not.toBeInTheDocument();

    // Filter to All
    fireEvent.click(screen.getByTestId('filter-btn-all'));
    expect(screen.getByTestId('todo-title-todo-1')).toBeInTheDocument();
    expect(screen.getByTestId('todo-title-todo-3')).toBeInTheDocument();
  });

  it('allows adding a new task with Daily or Once frequency and saves to localStorage', () => {
    render(<TaskTodoListSidebar />);

    // Open add form
    fireEvent.click(screen.getByTestId('add-todo-btn'));

    const input = screen.getByTestId('input-new-todo-title');
    fireEvent.change(input, { target: { value: 'Prepare release checklist notes' } });

    // Select Once frequency
    fireEvent.click(screen.getByTestId('add-freq-once'));

    // Submit
    fireEvent.click(screen.getByTestId('save-new-todo-btn'));

    expect(screen.getByText('Prepare release checklist notes')).toBeInTheDocument();

    // Verify localStorage has the new task
    const stored = JSON.parse(localStorage.getItem('maxr_sidebar_todos_v2') || '[]');
    expect(stored.some((item: { title: string }) => item.title === 'Prepare release checklist notes')).toBe(true);
  });

  it('toggles task completion status', () => {
    render(<TaskTodoListSidebar />);

    const checkbox = screen.getByTestId('checkbox-todo-1');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    // Toggle back
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('opens 3-dots desktop menu to edit and delete a task', () => {
    render(<TaskTodoListSidebar />);

    // Open menu for todo-1
    fireEvent.click(screen.getByTestId('menu-btn-todo-1'));
    expect(screen.getByTestId('desktop-menu-todo-1')).toBeInTheDocument();

    // Click Edit
    fireEvent.click(screen.getByTestId('desktop-edit-btn-todo-1'));

    const editInput = screen.getByTestId('input-edit-todo-title');
    fireEvent.change(editInput, { target: { value: 'Updated standup task' } });

    fireEvent.click(screen.getByTestId('save-edit-todo-btn'));

    expect(screen.getByText('Updated standup task')).toBeInTheDocument();

    // Now delete it via 3-dots menu
    fireEvent.click(screen.getByTestId('menu-btn-todo-1'));
    fireEvent.click(screen.getByTestId('desktop-delete-btn-todo-1'));

    expect(screen.queryByText('Updated standup task')).not.toBeInTheDocument();
  });

  it('supports mobile touch swipe-to-reveal gesture for Edit & Delete', () => {
    render(<TaskTodoListSidebar />);

    const todoRow = screen.getByTestId('todo-item-todo-1');

    // Simulate swipe left: start at 120, move/end at 40 (diff = -80 < -40)
    fireEvent.touchStart(todoRow, { touches: [{ clientX: 120 }] });
    fireEvent.touchMove(todoRow, { touches: [{ clientX: 40 }] });
    fireEvent.touchEnd(todoRow);

    // Should have swipe class -translate-x-[155px]
    const swipeCard = screen.getByTestId('swipe-card-todo-1');
    expect(swipeCard.className).toContain('-translate-x-[155px]');

    // Action buttons are clickable
    expect(screen.getByTestId('mobile-edit-btn-todo-1')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-delete-btn-todo-1')).toBeInTheDocument();

    // Swipe right to close: start at 40, end at 120 (diff = 80 > 25)
    fireEvent.touchStart(todoRow, { touches: [{ clientX: 40 }] });
    fireEvent.touchMove(todoRow, { touches: [{ clientX: 120 }] });
    fireEvent.touchEnd(todoRow);

    expect(swipeCard.className).toContain('translate-x-0');
  });

  it('supports mouse/pointer drag gesture simulation for mobile preview tools', () => {
    render(<TaskTodoListSidebar />);

    const todoRow = screen.getByTestId('todo-item-todo-1');

    // Simulate mouse drag left in responsive simulator
    fireEvent.pointerDown(todoRow, { clientX: 200, clientY: 50 });
    fireEvent.pointerMove(todoRow, { clientX: 100, clientY: 50 });
    fireEvent.pointerUp(todoRow);

    const swipeCard = screen.getByTestId('swipe-card-todo-1');
    expect(swipeCard.className).toContain('-translate-x-[155px]');

    // Clicking the swiped card closes it
    fireEvent.click(swipeCard);
    expect(swipeCard.className).toContain('translate-x-0');
  });

  it('calls onToggleCollapse when collapse button is clicked', () => {
    const handleCollapse = vi.fn();
    render(<TaskTodoListSidebar onToggleCollapse={handleCollapse} />);

    const collapseBtn = screen.getByTestId('collapse-todo-btn');
    expect(collapseBtn).toBeInTheDocument();
    fireEvent.click(collapseBtn);
    expect(handleCollapse).toHaveBeenCalledTimes(1);
  });
});
