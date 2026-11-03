// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import * as auditLogsApi from '../api/auditLogsApi';
import type { AuditLogListResponse } from '../types';

describe('useAuditLogs hook (Issue #28)', () => {
  const mockResponse: AuditLogListResponse = {
    data: [
      {
        id: 'log-1',
        occurredAt: '2026-11-01T12:00:00Z',
        action: 'auth.login',
        outcome: 'success',
        actor: { id: 'u-1', name: 'Eleanor Vance', role: 'admin' },
        entityType: 'user',
        entityId: 'u-1',
        requestId: 'req-1',
        changes: null,
        metadata: null,
      },
    ],
    meta: {
      page: 1,
      pageSize: 50,
      total: 1,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches logs on initial render', async () => {
    const fetchSpy = vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuditLogs());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.id).toBe('log-1');
  });

  it('updates filters and resets page to 1', async () => {
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuditLogs({ page: 3 }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.query.page).toBe(3);

    act(() => {
      result.current.updateFilters({ module: 'leave', outcome: 'denied' });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.query.page).toBe(1);
    expect(result.current.query.module).toBe('leave');
    expect(result.current.query.outcome).toBe('denied');
  });

  it('toggles sort order', async () => {
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuditLogs());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.setSortOrder('asc');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.query.sortOrder).toBe('asc');
  });

  it('resets filters cleanly', async () => {
    vi.spyOn(auditLogsApi, 'getAuditLogs').mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useAuditLogs({ module: 'tasks', outcome: 'failure', page: 2 }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.resetFilters();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.query.page).toBe(1);
    expect(result.current.query.pageSize).toBe(50);
    expect(result.current.query.sortOrder).toBe('desc');
    expect(result.current.query.module).toBeUndefined();
    expect(result.current.query.outcome).toBeUndefined();
  });
});
