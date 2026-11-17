// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { DailyChecklistPage } from '../pages/DailyChecklistPage';

describe('DailyChecklistPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders daily checklist page with date controls and report download button', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('personal-checklist-page')).toBeTruthy();
    expect(screen.getAllByText('Personal Checklist').length).toBeGreaterThan(0);
    expect(screen.getByTestId('download-checklist-report-btn')).toBeTruthy();
    expect(screen.getByTestId('page-add-checklist-btn')).toBeTruthy();
    expect(screen.getByText('Total Routines')).toBeTruthy();
    expect(screen.getByText('Completed for Date')).toBeTruthy();
    expect(screen.getByText('Daily standup & team status check')).toBeTruthy();
  });

  it('filters items by Daily Habits and One-Time Tasks', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Click Daily Habits
    fireEvent.click(screen.getByTestId('page-filter-daily'));
    expect(screen.getByText('Daily standup & team status check')).toBeTruthy();
    expect(screen.queryByText('Verify onboarding checklist documents')).toBeNull();

    // Click One-Time Tasks
    fireEvent.click(screen.getByTestId('page-filter-once'));
    expect(screen.getByText('Verify onboarding checklist documents')).toBeTruthy();
    expect(screen.queryByText('Daily standup & team status check')).toBeNull();
  });

  it('allows adding a new routine habit inline', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('page-add-checklist-btn'));
    expect(screen.getByTestId('page-add-todo-form')).toBeTruthy();

    const input = screen.getByTestId('page-new-todo-input');
    fireEvent.change(input, { target: { value: 'Weekly sprint retrospective review' } });
    fireEvent.click(screen.getByTestId('page-save-todo-btn'));

    expect(screen.getByText('Weekly sprint retrospective review')).toBeTruthy();
  });

  it('generates day-wise CSV report on download button click', () => {
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const downloadBtn = screen.getByTestId('download-checklist-report-btn');
    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalled();
  });

  it('allows editing an existing checklist item title and saving changes', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DailyChecklistPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    const editBtn = screen.getByTestId('page-edit-btn-todo-1');
    fireEvent.click(editBtn);

    const editInput = screen.getByTestId('page-edit-input-todo-1');
    fireEvent.change(editInput, { target: { value: 'Updated daily standup & team status check' } });

    fireEvent.click(screen.getByTestId('page-save-edit-btn-todo-1'));

    expect(screen.getByText('Updated daily standup & team status check')).toBeTruthy();
  });
});
