// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { LeaveSetupSection } from '../components/LeaveSetupSection';
import type { SettingsDraft } from '../hooks/useSettings';

afterEach(cleanup);

describe('Dynamic LeaveSetupSection Suite', () => {
  const baseDraft: SettingsDraft = {
    companyName: 'MAXR Technologies',
    timezone: 'Asia/Kolkata',
    workWeekStart: 'Monday',
    workWeekEnd: 'Friday',
    integrations: {
      email: true,
      sms: false,
      calendarSync: true,
      payrollExport: false,
    },
    customLeaveTypes: [], // Starts empty!
    leavePolicies: [],
  };

  it('renders clean initial empty state when no leave types are configured', () => {
    const handleUpdate = vi.fn();
    render(<LeaveSetupSection draft={baseDraft} onUpdate={handleUpdate} />);

    expect(screen.getByText('No Leave Types Configured')).toBeInTheDocument();
    expect(
      screen.getByText(/Every company configures its leave types and policies independently/),
    ).toBeInTheDocument();
    expect(screen.getByTestId('create-leave-type-btn')).toBeInTheDocument();
  });

  it('displays summary metrics and leave type creation in unified single page', () => {
    const handleUpdate = vi.fn();
    render(<LeaveSetupSection draft={baseDraft} onUpdate={handleUpdate} />);

    expect(screen.getByText('Dynamic Leave Policy & Quota Management')).toBeInTheDocument();
    expect(screen.getByTestId('create-leave-type-btn')).toBeInTheDocument();
  });

  it('opens create leave type modal and creates a custom leave type', () => {
    const handleUpdate = vi.fn();
    render(<LeaveSetupSection draft={baseDraft} onUpdate={handleUpdate} />);

    // Open modal
    fireEvent.click(screen.getByTestId('create-leave-type-btn'));
    expect(screen.getByText('Create Custom Leave Type')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Leave Type Name/i), {
      target: { value: 'Casual Leave' },
    });
    fireEvent.change(screen.getByLabelText(/Short Code/i), {
      target: { value: 'CL' },
    });

    // Save
    fireEvent.click(screen.getByRole('button', { name: 'Save Leave Type' }));

    expect(handleUpdate).toHaveBeenCalledTimes(1);
    const updatedPayload = handleUpdate.mock.calls[0]![0];
    expect(updatedPayload.customLeaveTypes).toHaveLength(1);
    expect(updatedPayload.customLeaveTypes[0].name).toBe('Casual Leave');
    expect(updatedPayload.customLeaveTypes[0].code).toBe('CL');
  });

  it('renders table with actions when leave types exist', () => {
    const handleUpdate = vi.fn();
    const draftWithLeaves: SettingsDraft = {
      ...baseDraft,
      customLeaveTypes: [
        {
          id: 'cl-1',
          name: 'Casual Leave',
          code: 'CL',
          category: 'casual',
          frequency: 'monthly',
          quota: 12,
          isPaid: true,
          accrualMethod: 'monthly',
          carryForwardEnabled: false,
          encashmentEnabled: false,
          isActive: true,
        },
      ],
    };

    render(<LeaveSetupSection draft={draftWithLeaves} onUpdate={handleUpdate} />);

    expect(screen.getByText('Casual Leave')).toBeInTheDocument();
    expect(screen.getAllByText('CL')[0]).toBeInTheDocument();
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // 3-dot action menu
    const actionMenuBtn = screen.getByLabelText(/Actions for Casual Leave/i);
    expect(actionMenuBtn).toBeInTheDocument();

    // Clicking 3-dot button opens the actions dropdown
    fireEvent.click(actionMenuBtn);
    expect(screen.getByTitle('Edit leave type')).toBeInTheDocument();
    expect(screen.getByTitle('Deactivate leave type')).toBeInTheDocument();
    expect(screen.getByTitle('Delete leave type')).toBeInTheDocument();
  });

  it('opens permission modal and allows configuring short permission', () => {
    const handleUpdate = vi.fn();
    render(<LeaveSetupSection draft={baseDraft} onUpdate={handleUpdate} />);

    // Click Create Permission button
    fireEvent.click(screen.getByTestId('create-permission-btn'));
    expect(screen.getByText('Configure Permission')).toBeInTheDocument();

    // Fill custom permission name and code
    const nameInput = screen.getByLabelText(/Permission Name/i);
    const codeInput = screen.getByLabelText(/Short Code/i);
    fireEvent.change(nameInput, { target: { value: 'Staff Permission' } });
    fireEvent.change(codeInput, { target: { value: 'SP' } });

    // Save Permission
    fireEvent.click(screen.getByTestId('save-permission-modal-btn'));

    expect(handleUpdate).toHaveBeenCalledTimes(1);
    const updatedPayload = handleUpdate.mock.calls[0]![0];
    expect(updatedPayload.permissionPolicy).toBeDefined();
    expect(updatedPayload.permissionPolicy.enabled).toBe(true);
    expect(updatedPayload.permissionPolicy.maxPermissionsPerMonth).toBe(2);
    expect(updatedPayload.permissionPolicy.maxHoursPerPermission).toBe(2);
    expect(updatedPayload.customLeaveTypes).toHaveLength(1);
    expect(updatedPayload.customLeaveTypes[0].name).toBe('Staff Permission');
    expect(updatedPayload.customLeaveTypes[0].code).toBe('SP');
    expect(updatedPayload.customLeaveTypes[0].category).toBe('permission');
  });
});
