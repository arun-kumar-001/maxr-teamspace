// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { ProfilePortalPage } from '../pages/ProfilePortalPage';

afterEach(() => {
  cleanup();
});

describe('ProfilePortalPage', () => {
  it('renders the My Profile portal view for Admin role', () => {
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
    expect(screen.getByText('Recent Payslips')).toBeTruthy();
    expect(screen.getByText('My Tasks')).toBeTruthy();
  });

  it('toggles check-in state and task completion interactively', () => {
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

    expect(screen.getByText('Daily standup & team status check')).toBeTruthy();
    expect(screen.getByText('Completed 0 of 3 tasks')).toBeTruthy();
    fireEvent.click(screen.getByText('Daily standup & team status check'));
    expect(screen.getByText('Completed 1 of 3 tasks')).toBeTruthy();
  });
});
