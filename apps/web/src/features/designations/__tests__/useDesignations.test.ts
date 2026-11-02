// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesignations } from '../hooks/useDesignations';
import * as designationsApi from '../api/designationsApi';
import type { DepartmentOption, Designation } from '../types';

const sampleDepartment: DepartmentOption = {
  id: 'dept-1',
  name: 'Engineering',
  code: 'ENG',
  isActive: true,
};

const sampleDesignation: Designation = {
  id: 'desig-1',
  departmentId: 'dept-1',
  title: 'Principal Engineer',
  code: 'PR_ENG',
  level: 4,
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('useDesignations Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(designationsApi, 'fetchDepartmentOptions').mockResolvedValue([sampleDepartment]);
    vi.spyOn(designationsApi, 'fetchDesignations').mockResolvedValue({
      data: [sampleDesignation],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('initializes with loading true and loads designations and department options', async () => {
    const { result } = renderHook(() => useDesignations());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.designations).toHaveLength(1);
    expect(result.current.designations[0]?.title).toBe('Principal Engineer');
    expect(result.current.departments).toHaveLength(1);
    expect(result.current.departmentMap.get('dept-1')?.name).toBe('Engineering');
    expect(result.current.error).toBeNull();
  });

  it('debounces search by 300ms before re-fetching', async () => {
    const fetchSpy = vi.spyOn(designationsApi, 'fetchDesignations');
    const { result } = renderHook(() => useDesignations());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearch('Architect');
    });

    // Advance 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Advance remaining 200ms
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Architect', page: 1 }),
    );
  });

  it('filters by departmentId and status correctly', async () => {
    const fetchSpy = vi.spyOn(designationsApi, 'fetchDesignations');
    const { result } = renderHook(() => useDesignations());

    await act(async () => {
      vi.runAllTimers();
    });

    act(() => {
      result.current.setDepartmentFilter('dept-1');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 'dept-1', page: 1 }),
    );

    act(() => {
      result.current.setStatusFilter('true');
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ isActive: true, page: 1 }));
  });

  it('manages modal states for create, edit, view, deactivate', async () => {
    const { result } = renderHook(() => useDesignations());

    await act(async () => {
      vi.runAllTimers();
    });

    // Create modal
    expect(result.current.isModalOpen).toBe(false);
    act(() => {
      result.current.openCreate();
    });
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.selectedDesignation).toBeNull();

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.isModalOpen).toBe(false);

    // Edit modal
    act(() => {
      result.current.openEdit(sampleDesignation);
    });
    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.selectedDesignation).toEqual(sampleDesignation);

    // Detail modal
    expect(result.current.detailDesignation).toBeNull();
    act(() => {
      result.current.openDetail(sampleDesignation);
    });
    expect(result.current.detailDesignation).toEqual(sampleDesignation);

    act(() => {
      result.current.closeDetail();
    });
    expect(result.current.detailDesignation).toBeNull();

    // Deactivate dialog
    expect(result.current.deactivatingDesignation).toBeNull();
    act(() => {
      result.current.openDeactivate(sampleDesignation);
    });
    expect(result.current.deactivatingDesignation).toEqual(sampleDesignation);

    act(() => {
      result.current.closeDeactivate();
    });
    expect(result.current.deactivatingDesignation).toBeNull();
  });

  it('handles API errors gracefully and allows retry', async () => {
    vi.spyOn(designationsApi, 'fetchDesignations').mockRejectedValueOnce(
      new designationsApi.DesignationsApiError('Internal Server Error', 500),
    );

    const { result } = renderHook(() => useDesignations());

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error?.message).toBe('Internal Server Error');

    // Retry
    vi.spyOn(designationsApi, 'fetchDesignations').mockResolvedValueOnce({
      data: [sampleDesignation],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });

    await act(async () => {
      result.current.refetch();
      vi.runAllTimers();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.designations).toHaveLength(1);
  });
});
