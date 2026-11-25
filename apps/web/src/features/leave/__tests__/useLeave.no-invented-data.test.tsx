// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as leaveApi from '../api/leave';
import { useLeave } from '../hooks/useLeave';
import type { ApplyForLeavePayload } from '../types';

vi.mock('../api/leave', () => ({
  fetchLeavePolicies: vi.fn(),
  fetchHolidays: vi.fn(),
  fetchMyLeaveBalances: vi.fn(),
  fetchMyLeaveRequests: vi.fn(),
  fetchLeaveCalendar: vi.fn(),
  applyForLeave: vi.fn(),
  cancelLeaveRequest: vi.fn(),
  createHoliday: vi.fn(),
}));

const payload = {
  leaveTypeId: 'p1',
  startDate: '2026-12-01',
  endDate: '2026-12-01',
  halfDay: false,
  reason: 'x',
} as ApplyForLeavePayload;

const serverEmpty = () => {
  vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([]);
  vi.mocked(leaveApi.fetchHolidays).mockResolvedValue([]);
  vi.mocked(leaveApi.fetchMyLeaveBalances).mockResolvedValue([]);
  vi.mocked(leaveApi.fetchMyLeaveRequests).mockResolvedValue({
    data: [],
    meta: { page: 1, pageSize: 20, total: 0 },
  });
  vi.mocked(leaveApi.fetchLeaveCalendar).mockResolvedValue([]);
};

describe('useLeave never shows invented data outside a development demo', () => {
  afterEach(() => vi.resetAllMocks());

  it('shows nothing, not sample leave, when the server has nothing', async () => {
    serverEmpty();
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));
    expect(result.current.policies).toEqual([]);
    expect(result.current.balances).toEqual([]);
    expect(result.current.requests).toEqual([]);
    expect(result.current.calendarEntries).toEqual([]);
  });

  it('ignores leave types saved in the browser: balances come from the server only', async () => {
    localStorage.setItem(
      'maxr_company_config',
      JSON.stringify({
        customLeaveTypes: [{ name: 'Sick Leave', code: 'SL', quota: 12, isActive: true }],
      }),
    );
    serverEmpty();
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));
    expect(result.current.policies).toEqual([]);
    expect(result.current.balances).toEqual([]);
    localStorage.clear();
  });

  it('reports the failure instead of falling back to sample data', async () => {
    serverEmpty();
    vi.mocked(leaveApi.fetchMyLeaveRequests).mockRejectedValue(new Error('boom'));
    vi.mocked(leaveApi.fetchMyLeaveBalances).mockRejectedValue(new Error('no balances'));
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.requestsError).toBe('boom'));
    await waitFor(() => expect(result.current.balanceError).toBe('no balances'));
    expect(result.current.requests).toEqual([]);
    expect(result.current.balances).toEqual([]);
  });

  it('does not add a request the server rejected', async () => {
    serverEmpty();
    vi.mocked(leaveApi.applyForLeave).mockRejectedValue(new Error('Insufficient balance'));
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));
    await act(async () => {
      await expect(result.current.applyLeave(payload)).rejects.toThrow('Insufficient balance');
    });
    expect(result.current.requests).toEqual([]);
  });

  it('does not pretend a cancellation worked', async () => {
    serverEmpty();
    vi.mocked(leaveApi.cancelLeaveRequest).mockRejectedValue(new Error('Too late'));
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));
    await act(async () => {
      await expect(result.current.cancelRequest('r1')).rejects.toThrow('Too late');
    });
    expect(result.current.requests).toEqual([]);
  });

  it('refuses to edit a submitted request, since the server cannot', async () => {
    serverEmpty();
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));
    await expect(result.current.editLeave('r1', payload)).rejects.toThrow('cannot be edited');
    expect(result.current.requests).toEqual([]);
  });
});

describe('adding a holiday', () => {
  afterEach(() => vi.resetAllMocks());

  it('goes to the holiday year and reads it back when it is not the year on screen', async () => {
    serverEmpty();
    const holiday = { id: 'h1', date: '2025-12-25', name: 'Christmas Day' };
    vi.mocked(leaveApi.createHoliday).mockResolvedValue(holiday as never);
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));

    vi.mocked(leaveApi.fetchHolidays).mockResolvedValue([holiday] as never);
    await act(async () => {
      await result.current.createHoliday({ date: '2025-12-25', name: 'Christmas Day' } as never);
    });

    // It is not left in 2026's list (where a refresh would drop it): the screen moved to 2025.
    await waitFor(() => expect(result.current.selectedYear).toBe(2025));
    expect(leaveApi.fetchHolidays).toHaveBeenLastCalledWith(2025);
    await waitFor(() => expect(result.current.holidays).toEqual([holiday]));
  });

  it('adds it straight to the list when it is in the year on screen', async () => {
    serverEmpty();
    const holiday = { id: 'h2', date: '2026-08-15', name: 'Independence Day' };
    vi.mocked(leaveApi.createHoliday).mockResolvedValue(holiday as never);
    const { result } = renderHook(() => useLeave(2026));
    await waitFor(() => expect(result.current.isLoadingRequests).toBe(false));

    await act(async () => {
      await result.current.createHoliday({ date: '2026-08-15', name: 'Independence Day' } as never);
    });

    expect(result.current.selectedYear).toBe(2026);
    expect(result.current.holidays).toEqual([holiday]);
  });
});
