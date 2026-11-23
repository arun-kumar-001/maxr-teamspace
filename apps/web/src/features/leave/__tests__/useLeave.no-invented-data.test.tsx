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
