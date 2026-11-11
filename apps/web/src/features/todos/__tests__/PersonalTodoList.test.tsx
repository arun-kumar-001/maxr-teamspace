// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as todosApi from '../api/todosApi';
import { PersonalTodoList } from '../components/PersonalTodoList';
import type { ListTodosResponse, PersonalTodo } from '../types';

vi.mock('../api/todosApi');

const todo1: PersonalTodo = {
  id: 'todo-1',
  employeeId: 'emp-1',
  title: 'Review PR #123',
  description: null,
  dueDate: '2026-11-01',
  isCompleted: false,
  completedAt: null,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

const todo2: PersonalTodo = {
  id: 'todo-2',
  employeeId: 'emp-1',
  title: 'Update onboarding docs',
  description: 'Add maxr links',
  dueDate: '2099-12-31',
  isCompleted: true,
  completedAt: '2026-11-02T15:00:00Z',
  createdAt: '2026-11-02T10:00:00Z',
  updatedAt: '2026-11-02T15:00:00Z',
};

const mockTodos: PersonalTodo[] = [todo1, todo2];

describe('PersonalTodoList component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state and then renders fetched to-dos with count and overdue tag', async () => {
    const listResponse: ListTodosResponse = {
      data: mockTodos,
      meta: {
        total: 2,
        limit: 10,
        offset: 0,
        hasMore: false,
      },
    };
    vi.mocked(todosApi.fetchTodos).mockResolvedValueOnce(listResponse);

    render(<PersonalTodoList />);

    // Shows loading indicator initially
    expect(screen.getByTestId('todo-loading')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Review PR #123')).toBeDefined();
    });

    expect(screen.getByText('Update onboarding docs')).toBeDefined();
    expect(screen.getByTestId('todo-total-count').textContent).toBe('2');
    // todo-1 has due date in 2026-11-01 which is in the past, so overdue tag is present
    expect(screen.getByTestId('todo-overdue-todo-1')).toBeDefined();
  });

  it('handles quick add submission and reloads list', async () => {
    const initialResponse: ListTodosResponse = {
      data: [todo1],
      meta: { total: 1, limit: 10, offset: 0, hasMore: false },
    };
    const createdTodo: PersonalTodo = {
      id: 'todo-3',
      employeeId: 'emp-1',
      title: 'Submit timesheet',
      description: null,
      dueDate: '2026-11-10',
      isCompleted: false,
      completedAt: null,
      createdAt: '2026-11-06T10:00:00Z',
      updatedAt: '2026-11-06T10:00:00Z',
    };
    const afterAddResponse: ListTodosResponse = {
      data: [createdTodo, todo1],
      meta: { total: 2, limit: 10, offset: 0, hasMore: false },
    };

    vi.mocked(todosApi.fetchTodos)
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValueOnce(afterAddResponse);
    vi.mocked(todosApi.createTodo).mockResolvedValueOnce(createdTodo);

    render(<PersonalTodoList />);
    await waitFor(() => expect(screen.getByText('Review PR #123')).toBeDefined());

    const titleInput = screen.getByTestId('todo-title-input');
    const dateInput = screen.getByTestId('todo-due-date-input');
    const addButton = screen.getByTestId('todo-add-button');

    fireEvent.change(titleInput, { target: { value: 'Submit timesheet' } });
    fireEvent.change(dateInput, { target: { value: '2026-11-10' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(todosApi.createTodo).toHaveBeenCalledWith({
        title: 'Submit timesheet',
        dueDate: '2026-11-10',
      });
      expect(screen.getByText('Submit timesheet')).toBeDefined();
    });
  });

  it('handles toggle completion', async () => {
    const initialResponse: ListTodosResponse = {
      data: [todo1],
      meta: { total: 1, limit: 10, offset: 0, hasMore: false },
    };
    const toggledTodo: PersonalTodo = {
      ...todo1,
      isCompleted: true,
      completedAt: '2026-11-06T12:00:00Z',
    };

    vi.mocked(todosApi.fetchTodos).mockResolvedValueOnce(initialResponse);
    vi.mocked(todosApi.toggleTodo).mockResolvedValueOnce(toggledTodo);

    render(<PersonalTodoList />);
    await waitFor(() => expect(screen.getByText('Review PR #123')).toBeDefined());

    const toggleButton = screen.getByTestId('todo-toggle-todo-1');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(todosApi.toggleTodo).toHaveBeenCalledWith('todo-1');
      expect(screen.getByText('Review PR #123').className).toContain('line-through');
    });
  });

  it('handles switching filter pills between All, Pending, and Done', async () => {
    const allResponse: ListTodosResponse = {
      data: mockTodos,
      meta: { total: 2, limit: 10, offset: 0, hasMore: false },
    };
    const pendingResponse: ListTodosResponse = {
      data: [todo1],
      meta: { total: 1, limit: 10, offset: 0, hasMore: false },
    };
    const doneResponse: ListTodosResponse = {
      data: [todo2],
      meta: { total: 1, limit: 10, offset: 0, hasMore: false },
    };

    vi.mocked(todosApi.fetchTodos)
      .mockResolvedValueOnce(allResponse)
      .mockResolvedValueOnce(pendingResponse)
      .mockResolvedValueOnce(doneResponse);

    render(<PersonalTodoList />);
    await waitFor(() => expect(screen.getByText('Review PR #123')).toBeDefined());

    // Switch to Pending
    const pendingTab = screen.getByTestId('todo-filter-pending');
    fireEvent.click(pendingTab);

    await waitFor(() => {
      expect(todosApi.fetchTodos).toHaveBeenCalledWith({
        completed: false,
        limit: 10,
        offset: 0,
      });
    });

    // Switch to Done
    const doneTab = screen.getByTestId('todo-filter-done');
    fireEvent.click(doneTab);

    await waitFor(() => {
      expect(todosApi.fetchTodos).toHaveBeenCalledWith({
        completed: true,
        limit: 10,
        offset: 0,
      });
    });
  });

  it('handles delete action', async () => {
    const initialResponse: ListTodosResponse = {
      data: [todo1],
      meta: { total: 1, limit: 10, offset: 0, hasMore: false },
    };
    const afterDeleteResponse: ListTodosResponse = {
      data: [],
      meta: { total: 0, limit: 10, offset: 0, hasMore: false },
    };

    vi.mocked(todosApi.fetchTodos)
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValueOnce(afterDeleteResponse);
    vi.mocked(todosApi.deleteTodo).mockResolvedValueOnce();

    render(<PersonalTodoList />);
    await waitFor(() => expect(screen.getByText('Review PR #123')).toBeDefined());

    const deleteButton = screen.getByTestId('todo-delete-todo-1');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(todosApi.deleteTodo).toHaveBeenCalledWith('todo-1');
      expect(screen.getByTestId('todo-empty')).toBeDefined();
    });
  });

  it('handles pagination controls: previous and next page buttons', async () => {
    const page1Response: ListTodosResponse = {
      data: [todo1],
      meta: { total: 2, limit: 1, offset: 0, hasMore: true },
    };
    const page2Response: ListTodosResponse = {
      data: [todo2],
      meta: { total: 2, limit: 1, offset: 1, hasMore: false },
    };

    vi.mocked(todosApi.fetchTodos)
      .mockResolvedValueOnce(page1Response)
      .mockResolvedValueOnce(page2Response)
      .mockResolvedValueOnce(page1Response);

    render(<PersonalTodoList pageSize={1} />);
    await waitFor(() => expect(screen.getByText('Review PR #123')).toBeDefined());

    expect(screen.getByTestId('todo-pagination-range').textContent).toBe('Showing 1-1 of 2');

    const prevButton = screen.getByTestId('todo-pagination-prev') as HTMLButtonElement;
    const nextButton = screen.getByTestId('todo-pagination-next') as HTMLButtonElement;

    expect(prevButton.disabled).toBe(true);
    expect(nextButton.disabled).toBe(false);

    // Click Next
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(todosApi.fetchTodos).toHaveBeenCalledWith({
        completed: undefined,
        limit: 1,
        offset: 1,
      });
      expect(screen.getByText('Update onboarding docs')).toBeDefined();
    });

    expect(prevButton.disabled).toBe(false);
    expect(nextButton.disabled).toBe(true);

    // Click Previous
    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(todosApi.fetchTodos).toHaveBeenCalledWith({
        completed: undefined,
        limit: 1,
        offset: 0,
      });
      expect(screen.getByText('Review PR #123')).toBeDefined();
    });
  });

  it('displays API error banner and allows dismissing it', async () => {
    vi.mocked(todosApi.fetchTodos).mockRejectedValueOnce(new Error('Network error'));

    render(<PersonalTodoList />);

    await waitFor(() => {
      expect(screen.getByTestId('todo-error-banner')).toBeDefined();
      expect(screen.getByText('Network error')).toBeDefined();
    });

    const dismissButton = screen.getByTestId('todo-error-dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByTestId('todo-error-banner')).toBeNull();
  });
});
