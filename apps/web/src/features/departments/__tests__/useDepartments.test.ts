// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDepartments } from '../hooks/useDepartments';
import * as departmentsApi from '../api/departmentsApi';
import type { Department } from '../types';

const sampleDepartment: Department = {
  id: 'dept-1',
  name: 'Engineering',
  code: 'ENG',
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('useDepartments Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(departmentsApi, 'fetchDepartments').mockResolvedValue({
      data: [sampleDepartment],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with loading true and loads department data on mount', async () => {
    const { result } = renderHook(() => useDepartments());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.departments).toHaveLength(1);
    expect(result.current.departments[0]?.name).toBe('Engineering');
    expect(result.current.error).toBeNull();
  });

  it('debounces search by 300ms before re-fetching', async () => {
    const fetchSpy = vi.spyOn(departmentsApi, 'fetchDepartments');
    const { result } = renderHook(() => useDepartments());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearch('Product');
    });

    // Advance 100ms - should not have triggered fetch yet
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance remaining 200ms (total 300ms)
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Product', page: 1 }),
    );
  });

  it('filters by status correctly (active / inactive / all)', async () => {
    const fetchSpy = vi.spyOn(departmentsApi, 'fetchDepartments');
    const { result } = renderHook(() => useDepartments());

    await act(async () => {
      vi.runAllTimers();
    });

    act(() => {
      result.current.setStatusFilter('true');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: true, page: 1 }));

    act(() => {
      result.current.setStatusFilter('false');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false, page: 1 }),
    );
  });

  it('manages modal states for create, edit, view, deactivate', async () => {
    const { result } = renderHook(() => useDepartments());

    await act(async () => {
      vi.runAllTimers();
    });

    // Create modal
    expect(result.current.isModalOpen).toBe(false);
    act(() => {
      result.current.openCreate();
    });
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.selectedDepartment).toBeNull();

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.isModalOpen).toBe(false);

    // Edit modal
    act(() => {
      result.current.openEdit(sampleDepartment);
    });
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.selectedDepartment).toEqual(sampleDepartment);

    // Detail modal
    expect(result.current.detailDepartment).toBeNull();
    act(() => {
      result.current.openDetail(sampleDepartment);
    });
    expect(result.current.detailDepartment).toEqual(sampleDepartment);

    act(() => {
      result.current.closeDetail();
    });
    expect(result.current.detailDepartment).toBeNull();

    // Deactivate dialog
    expect(result.current.deactivatingDepartment).toBeNull();
    act(() => {
      result.current.openDeactivate(sampleDepartment);
    });
    expect(result.current.deactivatingDepartment).toEqual(sampleDepartment);

    act(() => {
      result.current.closeDeactivate();
    });
    expect(result.current.deactivatingDepartment).toBeNull();
  });

  it('handles API errors gracefully and allows retry', async () => {
    vi.spyOn(departmentsApi, 'fetchDepartments').mockRejectedValueOnce(
      new departmentsApi.DepartmentsApiError('Internal Server Error', 500),
    );

    const { result } = renderHook(() => useDepartments());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toBe('Internal Server Error');

    // Retry
    vi.spyOn(departmentsApi, 'fetchDepartments').mockResolvedValueOnce({
      data: [sampleDepartment],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    await act(async () => {
      result.current.refetch();
      vi.runAllTimers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.departments).toHaveLength(1);
  });
});
