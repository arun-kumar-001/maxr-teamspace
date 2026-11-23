// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as leaveApi from '../../leave/api/leave';
import { LeaveSetupSection } from '../components/LeaveSetupSection';
import type { SettingsDraft } from '../hooks/useSettings';
import type { LeavePolicy } from '../../leave/types';

vi.mock('../../leave/api/leave', () => ({
  fetchLeavePolicies: vi.fn(),
  createLeavePolicy: vi.fn(),
  updateLeavePolicy: vi.fn(),
}));

const baseDraft: SettingsDraft = {
  companyName: 'MAXR Technologies',
  timezone: 'Asia/Kolkata',
  workWeekStart: 'Monday',
  workWeekEnd: 'Friday',
  integrations: { email: true, sms: false, calendarSync: true, payrollExport: false },
  leavePolicies: [],
};

const sick: LeavePolicy = {
  id: 'p-sick',
  code: 'SICK',
  name: 'Sick Leave',
  hasBalance: true,
  isActive: true,
  annualDays: 8,
  carryForwardMax: 0,
  allowHalfDay: true,
  maxBackdateDays: 3,
  version: 2,
  updatedAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('LeaveSetupSection: leave types are stored on the server', () => {
  it('shows an empty state when the server has no leave types', async () => {
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);

    expect(await screen.findByText('No Leave Types Configured')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-types-list')).not.toBeInTheDocument();
  });

  it('lists exactly the leave types the server returned', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([sick]);
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);

    expect(await screen.findByTestId('leave-type-SICK')).toHaveTextContent('Sick Leave');
    expect(screen.getByTestId('leave-type-SICK')).toHaveTextContent('8 days a year');
  });

  it('creates a leave type through the server and reloads the list', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValueOnce([]).mockResolvedValue([sick]);
    vi.mocked(leaveApi.createLeavePolicy).mockResolvedValue(sick);
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);
    await screen.findByText('No Leave Types Configured');

    fireEvent.click(screen.getByTestId('create-leave-type-btn'));
    fireEvent.change(await screen.findByLabelText(/Code/i), { target: { value: 'SICK' } });
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Sick Leave' } });
    fireEvent.click(screen.getByTestId('submit-leave-policy-btn'));

    await waitFor(() =>
      expect(leaveApi.createLeavePolicy).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SICK', name: 'Sick Leave', hasBalance: true }),
      ),
    );
    expect(await screen.findByTestId('leave-type-SICK')).toBeInTheDocument();
  });

  it('deactivates a leave type with its current version', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([sick]);
    vi.mocked(leaveApi.updateLeavePolicy).mockResolvedValue({ ...sick, isActive: false });
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    await waitFor(() =>
      expect(leaveApi.updateLeavePolicy).toHaveBeenCalledWith('p-sick', {
        isActive: false,
        version: 2,
      }),
    );
  });

  it('says so when the leave types cannot be loaded, instead of showing an empty list', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockRejectedValue(new Error('boom'));
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);

    expect(await screen.findByTestId('leave-types-error')).toHaveTextContent('boom');
    expect(screen.queryByText('No Leave Types Configured')).not.toBeInTheDocument();
  });

  it('keeps the short-permission limits in the settings draft', async () => {
    const onUpdate = vi.fn();
    render(<LeaveSetupSection draft={baseDraft} onUpdate={onUpdate} />);
    await screen.findByText('No Leave Types Configured');

    fireEvent.change(screen.getByLabelText(/Permissions per month/i), { target: { value: '3' } });

    expect(onUpdate).toHaveBeenCalledWith({
      permissionPolicy: expect.objectContaining({ maxPermissionsPerMonth: 3 }),
    });
  });

  it('Create Permission starts a leave type without a yearly balance', async () => {
    vi.mocked(leaveApi.createLeavePolicy).mockResolvedValue(sick);
    render(<LeaveSetupSection draft={baseDraft} onUpdate={vi.fn()} />);
    await screen.findByText('No Leave Types Configured');

    fireEvent.click(screen.getByTestId('create-permission-btn'));
    fireEvent.click(await screen.findByTestId('submit-leave-policy-btn'));

    await waitFor(() =>
      expect(leaveApi.createLeavePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PM',
          name: 'Short Permission',
          hasBalance: false,
          annualDays: 0,
        }),
      ),
    );
  });
});
