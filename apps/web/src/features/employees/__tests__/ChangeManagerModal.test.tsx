// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as creationApi from '../api/creation';
import * as hierarchyApi from '../api/hierarchy';
import { ChangeManagerModal } from '../components/ChangeManagerModal';

describe('ChangeManagerModal Component (Issue #23)', () => {
  const mockEmployee = {
    id: 'emp-target',
    name: 'Sarah Connor',
    employeeCode: 'ENG-007',
    version: 3,
    manager: {
      id: 'mgr-current',
      name: 'John Smith',
      employeeCode: 'MGR-001',
    },
  };

  const mockEligibleManagers = [
    { id: 'mgr-current', name: 'John Smith', employeeCode: 'MGR-001' },
    { id: 'mgr-2', name: 'Alex Murphy', employeeCode: 'MGR-002' },
    { id: 'emp-target', name: 'Sarah Connor', employeeCode: 'ENG-007' }, // should be filtered out
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(creationApi, 'fetchEligibleManagers').mockResolvedValue(mockEligibleManagers);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders employee info and loads eligible managers excluding self', async () => {
    render(
      <ChangeManagerModal
        isOpen={true}
        onClose={vi.fn()}
        employee={mockEmployee}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Change Reporting Manager')).toBeInTheDocument();
    expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
    expect(screen.getByText('ENG-007')).toBeInTheDocument();
    expect(screen.getByText('John Smith (MGR-001)')).toBeInTheDocument();

    await waitFor(() => {
      // Alex Murphy should be in the select options
      expect(screen.getByRole('option', { name: /Alex Murphy \(MGR-002\)/i })).toBeInTheDocument();
    });

    // Sarah Connor should NOT be in the options (cannot be own manager)
    expect(screen.queryByRole('option', { name: /Sarah Connor/i })).not.toBeInTheDocument();
  });

  it('submits managerId when assigning a new manager', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();
    const changeSpy = vi.spyOn(hierarchyApi, 'changeEmployeeManager').mockResolvedValue({
      id: 'emp-target',
      managerId: 'mgr-2',
      manager: { id: 'mgr-2', employeeCode: 'MGR-002', name: 'Alex Murphy' },
      version: 4,
    });

    render(
      <ChangeManagerModal
        isOpen={true}
        onClose={mockClose}
        employee={mockEmployee}
        onSuccess={mockSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alex Murphy/i })).toBeInTheDocument();
    });

    // Select Alex Murphy
    const select = screen.getByLabelText(/Select New Manager/i);
    fireEvent.change(select, { target: { value: 'mgr-2' } });

    // Submit
    const submitBtn = screen.getByTestId('submit-change-manager-btn');
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith('emp-target', {
        version: 3,
        managerId: 'mgr-2',
      });
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'emp-target',
          managerId: 'mgr-2',
          version: 4,
        }),
      );
      expect(mockClose).toHaveBeenCalledTimes(1);
    });
  });

  it('submits null managerId when removing manager (making root)', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();
    const changeSpy = vi.spyOn(hierarchyApi, 'changeEmployeeManager').mockResolvedValue({
      id: 'emp-target',
      managerId: null,
      manager: null,
      version: 4,
    });

    render(
      <ChangeManagerModal
        isOpen={true}
        onClose={mockClose}
        employee={mockEmployee}
        onSuccess={mockSuccess}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alex Murphy/i })).toBeInTheDocument();
    });

    // Pick "No Manager (Org Root)"
    const radioNone = screen.getByTestId('radio-remove-manager');
    fireEvent.click(radioNone);

    // Submit
    const submitBtn = screen.getByTestId('submit-change-manager-btn');
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled();
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changeSpy).toHaveBeenCalledWith('emp-target', {
        version: 3,
        managerId: null,
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('displays cycle error alert when backend returns 422 loop error', async () => {
    vi.spyOn(hierarchyApi, 'changeEmployeeManager').mockRejectedValue(
      new hierarchyApi.HierarchyApiError(
        422,
        'Reporting cycle: Manager reports to employee or creates a cycle',
      ),
    );

    render(
      <ChangeManagerModal
        isOpen={true}
        onClose={vi.fn()}
        employee={mockEmployee}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alex Murphy/i })).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Select New Manager/i);
    fireEvent.change(select, { target: { value: 'mgr-2' } });

    fireEvent.click(screen.getByTestId('submit-change-manager-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('cycle-alert')).toBeInTheDocument();
      expect(screen.getByText(/Reporting Hierarchy Cycle Detected/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Manager reports to employee or creates a cycle/i),
      ).toBeInTheDocument();
    });
  });

  it('displays conflict alert when backend returns 409 stale version', async () => {
    vi.spyOn(hierarchyApi, 'changeEmployeeManager').mockRejectedValue(
      new hierarchyApi.HierarchyApiError(409, 'Employee version mismatch'),
    );

    render(
      <ChangeManagerModal
        isOpen={true}
        onClose={vi.fn()}
        employee={mockEmployee}
        onSuccess={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Alex Murphy/i })).toBeInTheDocument();
    });

    const select = screen.getByLabelText(/Select New Manager/i);
    fireEvent.change(select, { target: { value: 'mgr-2' } });

    fireEvent.click(screen.getByTestId('submit-change-manager-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('conflict-alert')).toBeInTheDocument();
      expect(screen.getByText(/Concurrent Modification Conflict/i)).toBeInTheDocument();
    });
  });
});
