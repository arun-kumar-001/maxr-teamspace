// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../hooks/useSettings';
import * as settingsApi from '../api/settingsApi';
import type { CompanySettings } from '../types';

describe('useSettings hook (Issue #30)', () => {
  const mockSettings: CompanySettings = {
    companyName: 'MAXR Technologies',
    timezone: 'Asia/Kolkata',
    workWeek: {
      start: 'Monday',
      end: 'Friday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    integrations: {
      email: true,
      sms: false,
      calendarSync: false,
      payrollExport: true,
    },
    updatedAt: '2026-11-01T10:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches settings on mount and initializes draft', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useSettings());

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.draft?.companyName).toBe('MAXR Technologies');
    expect(result.current.isDirty).toBe(false);
  });

  it('detects dirty changes and allows resetting draft', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.updateDraft({ companyName: 'New MAXR Corp' });
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.draft?.companyName).toBe('New MAXR Corp');

    act(() => {
      result.current.resetDraft();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.draft?.companyName).toBe('MAXR Technologies');
  });

  it('detects work week start == end error', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hasWorkWeekError).toBe(false);

    act(() => {
      result.current.updateDraft({ workWeekEnd: 'Monday' });
    });

    expect(result.current.hasWorkWeekError).toBe(true);
    expect(result.current.workWeekErrorMessage).toContain('cannot be the same day');
  });

  it('saves only dirty fields in update payload', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(mockSettings);
    const updateSpy = vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue({
      ...mockSettings,
      timezone: 'Europe/London',
    });

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.updateDraft({ timezone: 'Europe/London' });
    });

    let success = false;
    await act(async () => {
      success = await result.current.saveSettings();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({
      timezone: 'Europe/London',
    });
    expect(result.current.isDirty).toBe(false);
  });
});
