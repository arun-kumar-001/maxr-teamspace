// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PersonalChecklistWidget } from '../PersonalChecklistWidget';

describe('PersonalChecklistWidget', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders personal checklist widget with initial default items and counter', () => {
    render(<PersonalChecklistWidget />);

    expect(screen.getByTestId('personal-checklist-widget')).toBeTruthy();
    expect(screen.getByText('Personal Checklist')).toBeTruthy();
    expect(screen.getByText('Daily routine & habits')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.getByText('Daily standup & team status check')).toBeTruthy();
  });

  it('filters items between all, daily, and once', () => {
    render(<PersonalChecklistWidget />);

    // Click daily filter
    fireEvent.click(screen.getByTestId('widget-filter-daily'));
    expect(screen.getByText('Daily standup & team status check')).toBeTruthy();
    expect(screen.queryByText('Verify onboarding checklist documents')).toBeNull();

    // Click once filter
    fireEvent.click(screen.getByTestId('widget-filter-once'));
    expect(screen.getByText('Verify onboarding checklist documents')).toBeTruthy();
    expect(screen.queryByText('Daily standup & team status check')).toBeNull();
  });

  it('toggles item completion and updates progress', () => {
    render(<PersonalChecklistWidget />);

    expect(screen.getByText('0/3')).toBeTruthy();
    const item = screen.getByText('Daily standup & team status check');
    fireEvent.click(item);

    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
  });

  it('allows adding a new routine checklist item inline', () => {
    render(<PersonalChecklistWidget />);

    fireEvent.click(screen.getByTestId('widget-add-checklist-btn'));
    expect(screen.getByTestId('widget-add-todo-form')).toBeTruthy();

    const input = screen.getByTestId('widget-new-todo-input');
    fireEvent.change(input, { target: { value: 'Complete security audit' } });
    fireEvent.click(screen.getByTestId('widget-save-todo-btn'));

    expect(screen.getByText('Complete security audit')).toBeTruthy();
    expect(screen.getByText('0/4')).toBeTruthy();
  });
});
