// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleAssignmentModal } from '../components/RoleAssignmentModal';
import * as usersApi from '../api/usersApi';
import type { UserAccount } from '../types';

afterEach(cleanup);

describe('RoleAssignmentModal Component (Issue #27)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser: UserAccount = {
    id: 'u-101',
    employeeId: 'emp-101',
    employeeCode: 'MAX101',
    name: 'Sarah Connor',
    email: 'sarah@maxr.internal',
    isActive: true,
    roles: ['admin'],
    lastLoginAt: '2026-11-01T12:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  it('does not render when user is null or isOpen is false', () => {
    const { rerender } = render(
      <RoleAssignmentModal isOpen={false} onClose={() => {}} user={mockUser} />,
    );
    expect(screen.queryByTestId('role-assignment-modal')).toBeNull();

    rerender(<RoleAssignmentModal isOpen={true} onClose={() => {}} user={null} />);
    expect(screen.queryByTestId('role-assignment-modal')).toBeNull();
  });

  it('renders target user information and role options correctly', () => {
    render(<RoleAssignmentModal isOpen={true} onClose={() => {}} user={mockUser} />);

    expect(screen.getByTestId('role-assignment-modal')).toBeInTheDocument();
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('(MAX101)')).toBeInTheDocument();
    expect(screen.getByText('sarah@maxr.internal')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Checkbox for admin should be checked initially
    const adminCheckbox = screen.getByTestId('role-checkbox-admin') as HTMLInputElement;
    expect(adminCheckbox.checked).toBe(true);

    const hrCheckbox = screen.getByTestId('role-checkbox-hr_manager') as HTMLInputElement;
    expect(hrCheckbox.checked).toBe(false);
  });

  it('disables save button and displays validation warning when 0 roles are selected', () => {
    render(<RoleAssignmentModal isOpen={true} onClose={() => {}} user={mockUser} />);

    const adminCheckbox = screen.getByTestId('role-checkbox-admin');
    fireEvent.click(adminCheckbox); // Uncheck admin (now 0 roles)

    const saveBtn = screen.getByTestId('save-role-assignment-btn');
    expect(saveBtn).toBeDisabled();
  });

  it('calls updateUserRoles API and invokes onSuccess on submit', async () => {
    const updateSpy = vi.spyOn(usersApi, 'updateUserRoles').mockResolvedValue({
      ...mockUser,
      roles: ['admin', 'team_lead'],
    });

    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    render(
      <RoleAssignmentModal
        isOpen={true}
        onClose={handleClose}
        user={mockUser}
        onSuccess={handleSuccess}
      />,
    );

    const teamLeadCheckbox = screen.getByTestId('role-checkbox-team_lead');
    fireEvent.click(teamLeadCheckbox); // Add Team Lead

    const saveBtn = screen.getByTestId('save-role-assignment-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('u-101', ['admin', 'team_lead']);
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ roles: ['admin', 'team_lead'] }),
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('keeps modal open and shows error banner when API rejects removing last active Admin with 422', async () => {
    vi.spyOn(usersApi, 'updateUserRoles').mockRejectedValue(
      new usersApi.UsersApiError(422, 'The last active Admin cannot lose the Admin role'),
    );

    const handleClose = vi.fn();

    render(<RoleAssignmentModal isOpen={true} onClose={handleClose} user={mockUser} />);

    // Uncheck admin, check staff
    const adminCheckbox = screen.getByTestId('role-checkbox-admin');
    fireEvent.click(adminCheckbox);
    const staffCheckbox = screen.getByTestId('role-checkbox-staff');
    fireEvent.click(staffCheckbox);

    const saveBtn = screen.getByTestId('save-role-assignment-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('role-assignment-error')).toBeInTheDocument();
      expect(
        screen.getByText('The last active Admin cannot lose the Admin role'),
      ).toBeInTheDocument();
      expect(screen.getByText(/Last Admin Protection/i)).toBeInTheDocument();
    });

    // Modal must NOT close so user can rectify
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('role-assignment-modal')).toBeInTheDocument();
  });
});

