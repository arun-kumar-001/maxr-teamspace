// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as creation from '../api/creation';
import { useCreateEmployee } from '../hooks/useCreateEmployee';

vi.mock('../api/creation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/creation')>()),
  fetchActiveDepartments: vi.fn(),
  fetchDesignationsByDepartment: vi.fn(),
  fetchEligibleManagers: vi.fn(),
}));

const FAKE = /Engineering|Human Resources|Operations|Digital Marketing|Product Division|Finance/;

afterEach(() => vi.resetAllMocks());

describe('create employee reference data is what the server has, never invented', () => {
  it('has no departments or managers when the server has none', async () => {
    vi.mocked(creation.fetchActiveDepartments).mockResolvedValue([]);
    vi.mocked(creation.fetchEligibleManagers).mockResolvedValue([]);
    const { result } = renderHook(() => useCreateEmployee({}));

    await waitFor(() => expect(result.current.isLoadingDepartments).toBe(false));
    expect(result.current.departments).toEqual([]);
    expect(result.current.managers).toEqual([]);
    expect(JSON.stringify(result.current.departments)).not.toMatch(FAKE);
  });

  it('reports the failure instead of offering sample departments', async () => {
    vi.mocked(creation.fetchActiveDepartments).mockRejectedValue(new Error('down'));
    vi.mocked(creation.fetchEligibleManagers).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCreateEmployee({}));

    await waitFor(() =>
      expect(result.current.departmentError).toMatch(/Could not load departments/),
    );
    expect(result.current.departments).toEqual([]);
    expect(result.current.managerError).toMatch(/Could not load managers/);
  });

  it('shows the departments the server returned, and no designations when it has none', async () => {
    vi.mocked(creation.fetchActiveDepartments).mockResolvedValue([
      { id: 'd1', name: 'Warehouse', code: 'WH' },
    ]);
    vi.mocked(creation.fetchEligibleManagers).mockResolvedValue([]);
    vi.mocked(creation.fetchDesignationsByDepartment).mockResolvedValue([]);
    const { result } = renderHook(() => useCreateEmployee({}));
    await waitFor(() => expect(result.current.departments).toHaveLength(1));
    expect(result.current.departments[0]?.name).toBe('Warehouse');

    act(() => result.current.setFieldValue('departmentId', 'd1'));
    await waitFor(() => expect(result.current.isLoadingDesignations).toBe(false));
    expect(result.current.designations).toEqual([]);
  });

  it('reports the failure to load designations instead of offering sample ones', async () => {
    vi.mocked(creation.fetchActiveDepartments).mockResolvedValue([
      { id: 'd1', name: 'Warehouse', code: 'WH' },
    ]);
    vi.mocked(creation.fetchEligibleManagers).mockResolvedValue([]);
    vi.mocked(creation.fetchDesignationsByDepartment).mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCreateEmployee({}));
    await waitFor(() => expect(result.current.departments).toHaveLength(1));

    act(() => result.current.setFieldValue('departmentId', 'd1'));
    await waitFor(() =>
      expect(result.current.designationError).toMatch(/Could not load designations/),
    );
    expect(result.current.designations).toEqual([]);
  });
});
