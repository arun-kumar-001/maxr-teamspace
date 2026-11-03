// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as profileApi from '../api/profileApi';
import { MyProfilePage } from '../pages/MyProfilePage';
import type { EmployeeProfile } from '../types';

describe('MyProfilePage Component Suite (Issue #22)', () => {
  const mockStaffProfile: EmployeeProfile = {
    id: 'emp-001',
    employeeCode: 'EMP-001',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98765 00000',
    department: { id: 'dept-1', name: 'Product', code: 'PROD' },
    designation: { id: 'desig-1', title: 'Product Specialist', code: 'PROD-SP' },
    manager: {
      id: 'mgr-001',
      firstName: 'Kavita',
      lastName: 'Iyer',
      employeeCode: 'MGR-001',
    },
    status: 'active',
    joiningDate: '2025-06-01',
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    version: 1,
    // Note: Staff profile does NOT have the account block!
  };

  const mockAdminProfile: EmployeeProfile = {
    ...mockStaffProfile,
    id: 'emp-admin',
    employeeCode: 'ADM-001',
    firstName: 'Arun',
    lastName: 'Admin',
    email: 'admin@example.com',
    account: {
      userId: 'usr-admin',
      isActive: true,
      lastLoginAt: '2026-11-01T08:30:00.000Z',
      roles: ['admin'],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading skeleton initially while data is resolving', () => {
    // Return a promise that does not resolve immediately
    vi.spyOn(profileApi, 'fetchProfile').mockReturnValueOnce(new Promise(() => {}));

    render(<MyProfilePage />);

    expect(screen.getByTestId('profile-loading-skeleton')).toBeInTheDocument();
  });

  it('renders error state with retry button when profile fetch fails', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockRejectedValueOnce(
      new Error('Failed to fetch profile from server'),
    );

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load profile')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to fetch profile from server')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders complete profile details (Header, Personal, Employment) for active staff', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-profile-page')).toBeInTheDocument();
    });

    // Profile Header checks
    expect(screen.getByTestId('profile-header')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PS')).toBeInTheDocument(); // Initials
    expect(screen.getAllByText('EMP-001').length).toBeGreaterThanOrEqual(1);

    // Personal Information checks
    expect(screen.getByTestId('personal-info-card')).toBeInTheDocument();
    expect(screen.getByText('priya.sharma@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('profile-phone-display')).toHaveTextContent('+91 98765 00000');

    // Employment Information checks
    expect(screen.getByTestId('employment-info-card')).toBeInTheDocument();
    expect(screen.getByText('Product Specialist')).toBeInTheDocument();
    expect(screen.getAllByText('Product').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Kavita Iyer (MGR-001)')).toBeInTheDocument();

    // STRICT CHECK: Staff profile does NOT have account block -> Account card must NOT exist
    expect(screen.queryByTestId('account-info-card')).not.toBeInTheDocument();
  });

  it('renders Account Information card ONLY when account data is provided by API (Admin/HR)', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockAdminProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-profile-page')).toBeInTheDocument();
    });

    // Account card MUST be rendered for Admin
    expect(screen.getByTestId('account-info-card')).toBeInTheDocument();
    expect(screen.getByText('Account & System Access')).toBeInTheDocument();
    expect(screen.getByText('Active Login')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument(); // Role display
  });

  it('allows editing phone number, validates input, and updates UI on success', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);
    const updatedProfile = {
      ...mockStaffProfile,
      phone: '+91 91111 22222',
      version: 2,
    };
    const updateSpy = vi
      .spyOn(profileApi, 'updateProfilePhone')
      .mockResolvedValueOnce(updatedProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('profile-phone-display')).toBeInTheDocument();
    });

    // Click Edit Phone button
    const editButton = screen.getByTestId('edit-phone-button');
    fireEvent.click(editButton);

    // Phone editor form appears
    expect(screen.getByTestId('phone-editor-form')).toBeInTheDocument();
    const phoneInput = screen.getByTestId('phone-input');
    expect(phoneInput).toHaveValue('+91 98765 00000');

    // Change input value
    fireEvent.change(phoneInput, { target: { value: '+91 91111 22222' } });

    // Save phone
    const saveButton = screen.getByTestId('save-phone-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        version: 1,
        phone: '+91 91111 22222',
      });
    });

    // Verify success toast and updated display
    await waitFor(() => {
      expect(screen.getByText('Phone number updated successfully.')).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-phone-display')).toHaveTextContent('+91 91111 22222');
    expect(screen.queryByTestId('phone-editor-form')).not.toBeInTheDocument();
  });

  it('allows clearing phone number with empty input (sends null to API)', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);
    const clearedProfile = {
      ...mockStaffProfile,
      phone: null,
      version: 2,
    };
    const updateSpy = vi
      .spyOn(profileApi, 'updateProfilePhone')
      .mockResolvedValueOnce(clearedProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-phone-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-phone-button'));
    const phoneInput = screen.getByTestId('phone-input');

    // Clear input
    fireEvent.change(phoneInput, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('save-phone-button'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        version: 1,
        phone: null,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-phone-display')).toHaveTextContent('Not provided');
    });
  });

  it('shows inline validation error when typing invalid phone number format', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);
    const updateSpy = vi.spyOn(profileApi, 'updateProfilePhone');

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-phone-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-phone-button'));
    const phoneInput = screen.getByTestId('phone-input');

    // Type invalid text
    fireEvent.change(phoneInput, { target: { value: 'not-a-number' } });
    fireEvent.click(screen.getByTestId('save-phone-button'));

    await waitFor(() => {
      expect(screen.getByTestId('save-error-alert')).toBeInTheDocument();
    });
    expect(
      screen.getAllByText(/Phone number must be 6 to 50 characters/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('cancels phone editing when clicking Cancel button and reverts draft', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('edit-phone-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-phone-button'));
    const phoneInput = screen.getByTestId('phone-input');

    fireEvent.change(phoneInput, { target: { value: '+91 99999 99999' } });
    fireEvent.click(screen.getByTestId('cancel-phone-button'));

    // Form disappears and original phone remains
    expect(screen.queryByTestId('phone-editor-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-phone-display')).toHaveTextContent('+91 98765 00000');
  });

  it('handles deactivated profile by making page strictly read-only and hiding Edit button', async () => {
    const deactivatedProfile: EmployeeProfile = {
      ...mockStaffProfile,
      status: 'deactivated',
    };
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(deactivatedProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-profile-page')).toBeInTheDocument();
    });

    // Deactivated status badge and warning banner
    expect(screen.getAllByText('Deactivated').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Account Deactivated:/i)).toBeInTheDocument();

    // Edit phone button MUST NOT be rendered
    expect(screen.queryByTestId('edit-phone-button')).not.toBeInTheDocument();
  });

  it('renders View Full Record link with link to user canonical employee detail (Issue #155)', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockStaffProfile);

    render(<MyProfilePage />);

    await waitFor(() => {
      expect(screen.getByTestId('my-profile-page')).toBeInTheDocument();
    });

    const fullRecordLink = screen.getByTestId('view-full-record-link');
    expect(fullRecordLink).toBeInTheDocument();
    expect(fullRecordLink).toHaveAttribute('href', `/employees/${mockStaffProfile.id}`);
    expect(fullRecordLink).toHaveTextContent('View Full Record');
  });
});
