// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddUserModal } from '../components/AddUserModal';
import * as usersApi from '../api/usersApi';
import type { UserAccount } from '../types';

const createdUser: UserAccount = {
  id: 'u-99',
  employeeId: 'emp-99',
  employeeCode: 'USR-ABC123',
  name: 'Nadia Roy',
  email: 'nadia.roy@maxr.internal',
  isActive: true,
  roles: ['team_lead', 'staff'],
  lastLoginAt: null,
  createdAt: '2026-11-11T00:00:00Z',
};

describe('AddUserModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates required fields inline before submitting', async () => {
    const createSpy = vi.spyOn(usersApi, 'createUser');
    render(<AddUserModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('submit-add-user-btn'));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Work email is required.')).toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('submits user without password and displays generated temporary password', async () => {
    const onCreated = vi.fn();
    const createSpy = vi.spyOn(usersApi, 'createUser').mockResolvedValue({
      user: createdUser,
      temporaryPassword: 'Maxr#TempPassword1!',
    });

    render(<AddUserModal isOpen={true} onClose={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Roy' } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: 'nadia.roy@maxr.internal' },
    });
    fireEvent.click(screen.getByTestId('add-user-role-team_lead'));
    fireEvent.click(screen.getByTestId('submit-add-user-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        firstName: 'Nadia',
        lastName: 'Roy',
        email: 'nadia.roy@maxr.internal',
        roles: ['staff', 'team_lead'],
        isActive: true,
      });
    });

    expect(onCreated).toHaveBeenCalledWith(createdUser);
    expect(await screen.findByTestId('add-user-success')).toBeInTheDocument();
    expect(screen.getByTestId('generated-temp-password')).toHaveTextContent('Maxr#TempPassword1!');
  });

  it('displays API errors such as duplicate email without closing', async () => {
    vi.spyOn(usersApi, 'createUser').mockRejectedValue(
      new usersApi.UsersApiError(409, 'A user with this email address already exists', 'CONFLICT'),
    );

    render(<AddUserModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: 'Nadia' } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: 'Roy' } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), {
      target: { value: 'nadia.roy@maxr.internal' },
    });
    fireEvent.click(screen.getByTestId('submit-add-user-btn'));

    expect(await screen.findByTestId('add-user-error')).toHaveTextContent(
      'A user with this email address already exists',
    );
  });
});
