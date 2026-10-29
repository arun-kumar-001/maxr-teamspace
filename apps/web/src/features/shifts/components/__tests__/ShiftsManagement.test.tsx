// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShiftsApiClient } from '../../api/shiftsApi';
import { AttendancePolicy, Shift } from '../../types/shifts';
import { ShiftsManagement } from '../ShiftsManagement';

describe('TC-33-UI: ShiftsManagement Component Unit Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const sampleShifts: Shift[] = [
    {
      id: 's1000000-0000-4000-8000-000000000001',
      name: 'General Morning Shift',
      code: 'GEN-01',
      startTime: '09:00:00',
      endTime: '17:30:00',
      breakMinutes: 60,
      isActive: true,
      createdAt: '2026-10-29T00:00:00Z',
      updatedAt: '2026-10-29T00:00:00Z',
    },
  ];

  const samplePolicy: AttendancePolicy = {
    id: 'p1000000-0000-4000-8000-000000000001',
    name: 'Standard Working Policy',
    gracePeriodMinutes: 15,
    halfDayThresholdMinutes: 240,
    fullDayThresholdMinutes: 480,
    timezone: 'UTC',
    isDefault: true,
    createdAt: '2026-10-29T00:00:00Z',
    updatedAt: '2026-10-29T00:00:00Z',
  };

  function createMockApi(): ShiftsApiClient {
    return {
      listShifts: vi.fn().mockResolvedValue({
        data: [...sampleShifts],
        meta: { total: 1, page: 1, pageSize: 10 },
      }),
      createShift: vi.fn().mockImplementation((req) => {
        return Promise.resolve({
          id: 's2000000-0000-4000-8000-000000000002',
          ...req,
          breakMinutes: req.breakMinutes ?? 60,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }),
      getPolicy: vi.fn().mockResolvedValue({ ...samplePolicy }),
      updatePolicy: vi.fn().mockImplementation((req) => {
        return Promise.resolve({
          ...samplePolicy,
          ...req,
          updatedAt: new Date().toISOString(),
        });
      }),
    };
  }

  it('renders configured shifts list', async () => {
    const api = createMockApi();
    render(<ShiftsManagement api={api} />);

    expect(screen.getByRole('status')).toBeDefined();

    await waitFor(() => {
      expect(screen.getAllByText('General Morning Shift').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('GEN-01').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('opens modal and submits new shift creation', async () => {
    const api = createMockApi();
    render(<ShiftsManagement api={api} />);

    await waitFor(() => {
      expect(screen.getByText('+ Create New Shift')).toBeDefined();
    });

    fireEvent.click(screen.getByText('+ Create New Shift'));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Create New Shift')).toBeDefined();

    const nameInput = screen.getByLabelText(/shift name/i);
    const codeInput = screen.getByLabelText(/shift code/i);

    fireEvent.change(nameInput, { target: { value: 'Night Shift' } });
    fireEvent.change(codeInput, { target: { value: 'NIGHT-01' } });

    const submitBtn = screen.getByRole('button', { name: /^create shift$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createShift).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Night Shift',
          code: 'NIGHT-01',
        }),
      );
    });
  });

  it('switches to attendance policy tab and saves updated policy', async () => {
    const api = createMockApi();
    render(<ShiftsManagement api={api} />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /attendance rules/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('tab', { name: /attendance rules/i }));

    expect(screen.getByLabelText(/grace period/i)).toBeDefined();

    const graceInput = screen.getByLabelText(/grace period/i);
    fireEvent.change(graceInput, { target: { value: '25' } });

    const saveBtn = screen.getByRole('button', { name: /save attendance policy/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updatePolicy).toHaveBeenCalledWith(
        expect.objectContaining({
          gracePeriodMinutes: 25,
        }),
      );
    });
  });
});
