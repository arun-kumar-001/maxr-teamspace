// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUsers } from '../hooks/useUsers';
import * as usersApi from '../api/usersApi';
import type { UserAccount, UserListResponse } from '../types';

describe('useUsers hook (Issue #27)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUsers: UserAccount[] = [
    {
      id: 'u-1',
      employeeId: 'emp-1',
      employeeCode: 'MAX001',
      name: 'Alice Admin',
      email: 'alice@maxr.internal',
      isActive: true,
      roles: ['admin'],
      lastLoginAt: '2026-11-01T10:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'u-2',
      employeeId: 'emp-2',
      employeeCode: 'MAX002',
      name: 'Bob Staff',
      email: 'bob@maxr.internal',
      isActive: false,
      roles: ['staff'],
      lastLoginAt: null,
      createdAt: '2026-02-01T00:00:00Z',
    },
  ];

  const mockResponse: UserListResponse = {
    data: mockUsers,
    meta: {
      page: 1,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    },
  };

  it('fetches users on initial mount', async () => {
    const apiSpy = vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUsers());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiSpy).toHaveBeenCalled();
    expect(result.current.users).toHaveLength(2);
    expect(result.current.meta.total).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('updates search, role, and active status filters and resets page', async () => {
    vi.spyOn(usersApi, 'getUsers').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useUsers({ page: 2 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearch('Alice');
    });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
      expect(result.current.filters.search).toBe('Alice');
    });

    act(() => {
      result.current.setRole('admin');
    });

    await waitFor(() => {
      expect(result.current.filters.role).toBe('admin');
    });

    act(() => {
      result.current.setIsActive(true);
    });

    await waitFor(() => {
      expect(result.current.filters.isActive).toBe(true);
    });

    act(() => {
      result.current.resetFilters();
    });

    await waitFor(() => {
      expect(result.current.filters.search).toBe('');
      expect(result.current.filters.role).toBe('');
      expect(result.current.filters.isActive).toBe('');
    });
  });

  it('handles API errors gracefully', async () => {
    vi.spyOn(usersApi, 'getUsers').mockRejectedValue(
      new usersApi.UsersApiError(500, 'Internal Server Error'),
    );

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('Internal Server Error');
  });
});
