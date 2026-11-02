// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEmployeeDirectory } from '../hooks/useEmployeeDirectory';
import * as directoryApi from '../api/employees';
import { ApiError } from '../api/employees';
import type { EmployeeDirectoryItem } from '../types';

const mockSampleItem: EmployeeDirectoryItem = {
  id: 'emp-101',
  employeeCode: 'MAX001',
  firstName: 'David',
  lastName: 'Miller',
  email: 'david@maxr.com',
  phone: '+1 555-0199',
  department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-1', title: 'Tech Lead', code: 'TL', level: 4 },
  manager: { id: 'mgr-1', firstName: 'Sarah', lastName: 'Connor', employeeCode: 'MGR01' },
  status: 'active',
  joiningDate: '2024-03-01',
  createdAt: '2024-03-01T00:00:00Z',
  updatedAt: '2024-03-01T00:00:00Z',
};

describe('useEmployeeDirectory Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(directoryApi, 'fetchDepartments').mockResolvedValue([
      { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    ]);
    vi.spyOn(directoryApi, 'fetchDesignations').mockResolvedValue([
      { id: 'desig-1', title: 'Tech Lead', code: 'TL', level: 4 },
    ]);
    vi.spyOn(directoryApi, 'fetchManagerOptions').mockResolvedValue([
      { id: 'mgr-1', name: 'Sarah Connor', employeeCode: 'MGR01' },
    ]);
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockResolvedValue({
      data: [mockSampleItem],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with default values and triggers initial data load', async () => {
    const { result } = renderHook(() => useEmployeeDirectory());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.id).toBe('emp-101');
    expect(result.current.meta.total).toBe(1);
    expect(result.current.departments).toHaveLength(1);
    expect(result.current.designations).toHaveLength(1);
    expect(result.current.managers).toHaveLength(1);
  });

  it('debounces search input by 300ms before triggering API fetch', async () => {
    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    vi.clearAllMocks();

    act(() => {
      result.current.setSearch('David');
    });

    // Immediate state reflects input
    expect(result.current.filters.search).toBe('David');
    // API not yet called before timer fires
    expect(directoryApi.fetchEmployeeDirectory).not.toHaveBeenCalled();

    // Fast-forward 290ms - still not fired
    act(() => {
      vi.advanceTimersByTime(290);
    });
    expect(directoryApi.fetchEmployeeDirectory).not.toHaveBeenCalled();

    // Fast-forward remaining 10ms - fires at 300ms
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    expect(directoryApi.fetchEmployeeDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'David', page: 1 }),
    );
  });

  it('resets page to 1 whenever filters change', async () => {
    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    // Advance to page 2
    act(() => {
      result.current.setPage(2);
    });
    expect(result.current.meta.page).toBe(1); // will update after fetch

    // Change department filter -> page resets to 1
    act(() => {
      result.current.setDepartmentId('dept-1');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(directoryApi.fetchEmployeeDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 'dept-1', page: 1 }),
    );
  });

  it('updates sorting and preserves page 1', async () => {
    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    act(() => {
      result.current.setSort('employeeCode', 'desc');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.sorting.sortBy).toBe('employeeCode');
    expect(result.current.sorting.sortOrder).toBe('desc');
    expect(directoryApi.fetchEmployeeDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'employeeCode', sortOrder: 'desc', page: 1 }),
    );
  });

  it('resets all filters back to default values', async () => {
    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    act(() => {
      result.current.setSearch('Test');
      result.current.setDepartmentId('dept-1');
      result.current.setStatus('active');
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.resetFilters();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.filters.search).toBe('');
    expect(result.current.filters.departmentId).toBe('');
    expect(result.current.filters.status).toBe('');
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('sets isForbidden to true when API returns 403', async () => {
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockRejectedValueOnce(
      new ApiError('Forbidden', 403, 'FORBIDDEN'),
    );

    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isForbidden).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error state when API returns 500 or network fails', async () => {
    vi.spyOn(directoryApi, 'fetchEmployeeDirectory').mockRejectedValueOnce(
      new ApiError('Database failure', 500, 'INTERNAL_ERROR'),
    );

    const { result } = renderHook(() => useEmployeeDirectory());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isForbidden).toBe(false);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error?.message).toBe('Database failure');
  });
});
