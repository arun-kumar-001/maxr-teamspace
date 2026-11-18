// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveApprovalSettingsForm } from '../components/LeaveApprovalSettingsForm';
import { fetchLeaveApprovalSettings, updateLeaveApprovalSettings } from '../api/leave';

vi.mock('../api/leave', () => ({
  fetchLeaveApprovalSettings: vi.fn(),
  updateLeaveApprovalSettings: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchLeaveApprovalSettings).mockResolvedValue({
    approverRole: 'hr_manager',
    version: 1,
  });
});
afterEach(cleanup);

it('loads HR as default and saves a versioned change to Team Lead', async () => {
  vi.mocked(updateLeaveApprovalSettings).mockResolvedValue({
    approverRole: 'team_lead',
    version: 2,
  });
  render(<LeaveApprovalSettingsForm />);
  const select = await screen.findByLabelText('Default approver');
  expect(select).toHaveValue('hr_manager');
  fireEvent.change(select, { target: { value: 'team_lead' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save approval settings' }));
  expect(await screen.findByText('Approval settings saved.')).toBeInTheDocument();
  expect(updateLeaveApprovalSettings).toHaveBeenCalledWith({
    approverRole: 'team_lead',
    version: 1,
  });
  expect(screen.getByRole('button', { name: 'Save approval settings' })).toBeDisabled();
});

it('shows a save conflict and reloads the current version', async () => {
  vi.mocked(updateLeaveApprovalSettings).mockRejectedValue(
    new Error('Approval settings changed. Reload and try again'),
  );
  render(<LeaveApprovalSettingsForm />);
  fireEvent.change(await screen.findByLabelText('Default approver'), {
    target: { value: 'team_lead' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save approval settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Approval settings changed');
  vi.mocked(fetchLeaveApprovalSettings).mockResolvedValue({
    approverRole: 'team_lead',
    version: 3,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reload settings' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save approval settings' })).toBeDisabled(),
  );
});

it('shows a load failure with a retry action', async () => {
  vi.mocked(fetchLeaveApprovalSettings).mockRejectedValue(new Error('Access denied'));
  render(<LeaveApprovalSettingsForm />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.getByRole('button', { name: 'Reload settings' })).toBeEnabled();
});
