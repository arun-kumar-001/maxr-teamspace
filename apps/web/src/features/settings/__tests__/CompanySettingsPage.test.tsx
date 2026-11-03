// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Role } from '@maxr/shared';
import { CompanySettingsPage } from '../pages/CompanySettingsPage';
import * as settingsApi from '../api/settingsApi';
import * as authContext from '../../../auth/AuthContext';
import type { CompanySettings } from '../types';

afterEach(cleanup);

describe('CompanySettingsPage Component Suite (Issue #30)', () => {
  const mockSettings: CompanySettings = {
    companyName: 'MAXR Global Technologies',
    timezone: 'Asia/Kolkata',
    workWeek: {
      start: 'Monday',
      end: 'Friday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    integrations: {
      email: true,
      sms: false,
      calendarSync: true,
      payrollExport: false,
    },
    updatedAt: '2026-11-01T10:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function setupAuth(role: Role = 'admin') {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      role,
      user: {
        id: 'u-1',
        employeeId: 'emp-1',
        name: 'Eleanor Vance',
        email: 'eleanor@maxr.internal',
        role,
        roles: [role],
        permissions: ['settings.read', 'settings.update'],
        avatarInitials: 'EV',
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });
  }

  it('renders all configuration sections for Admin role', async () => {
    setupAuth('admin');
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);

    render(
      <MemoryRouter>
        <CompanySettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Company Configuration')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('company-profile-section')).toBeInTheDocument();
      expect(screen.getByTestId('work-week-section')).toBeInTheDocument();
      expect(screen.getByTestId('integrations-section')).toBeInTheDocument();
      expect(screen.getByTestId('security-settings-section')).toBeInTheDocument();
    });

    // Check company name input value
    const nameInput = screen.getByTestId('company-name-input') as HTMLInputElement;
    expect(nameInput.value).toBe('MAXR Global Technologies');

    // Save button should be disabled when nothing is dirty
    const saveBtn = screen.getByTestId('save-settings-btn');
    expect(saveBtn).toBeDisabled();
  });

  it('renders ForbiddenState for unauthorized roles (HR Manager, Team Lead, Staff)', async () => {
    setupAuth('hr_manager');

    render(
      <MemoryRouter>
        <CompanySettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('forbidden-state')).toBeInTheDocument();
    expect(
      screen.getByText(/Only System Administrators can access this configuration/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('company-profile-section')).not.toBeInTheDocument();
  });

  it('enables Save button on change, allows Discard, and saves updates', async () => {
    setupAuth('admin');
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);
    const updateSpy = vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue({
      ...mockSettings,
      companyName: 'MAXR Flow Corp',
    });

    render(
      <MemoryRouter>
        <CompanySettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('company-name-input')).toBeInTheDocument();
    });

    const nameInput = screen.getByTestId('company-name-input');
    fireEvent.change(nameInput, { target: { value: 'MAXR Flow Corp' } });

    // Save and Discard should now be enabled
    const saveBtn = screen.getByTestId('save-settings-btn');
    const discardBtn = screen.getByTestId('discard-changes-btn');
    expect(saveBtn).not.toBeDisabled();
    expect(discardBtn).not.toBeDisabled();

    // Click save
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        companyName: 'MAXR Flow Corp',
      });
    });

    // Success toast appears
    await waitFor(() => {
      expect(screen.getByText('Settings Saved')).toBeInTheDocument();
    });
  });

  it('disables Save button and displays error when work week start equals end', async () => {
    setupAuth('admin');
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);

    render(
      <MemoryRouter>
        <CompanySettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('workweek-end-select')).toBeInTheDocument();
    });

    // Change end day to match start day (Monday)
    const endSelect = screen.getByTestId('workweek-end-select');
    fireEvent.change(endSelect, { target: { value: 'Monday' } });

    // Error message appears
    expect(screen.getByText('Start day and end day cannot be the same day.')).toBeInTheDocument();

    // Save button is disabled
    const saveBtn = screen.getByTestId('save-settings-btn');
    expect(saveBtn).toBeDisabled();
  });

  it('allows toggling integrations', async () => {
    setupAuth('admin');
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);
    const updateSpy = vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue({
      ...mockSettings,
      integrations: { ...mockSettings.integrations, sms: true },
    });

    render(
      <MemoryRouter>
        <CompanySettingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-sms')).toBeInTheDocument();
    });

    const smsToggle = screen.getByTestId('toggle-sms');
    fireEvent.click(smsToggle);

    const saveBtn = screen.getByTestId('save-settings-btn');
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        integrations: { sms: true },
      });
    });
  });
});
