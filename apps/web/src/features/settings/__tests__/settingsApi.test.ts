import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as client from '../../../api/client';
import {
  getSettings,
  updateSettings,
  getBasicSettings,
  SettingsApiError,
} from '../api/settingsApi';
import type { CompanySettings } from '../types';

describe('settingsApi Suite (Issue #30)', () => {
  const mockSettings: CompanySettings = {
    companyName: 'MAXR Global Technologies',
    timezone: 'Asia/Kolkata',
    workWeek: {
      start: 'Monday',
      end: 'Friday',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    integrations: {
      email: true,
      sms: false,
      calendarSync: true,
      payrollExport: false,
    },
    updatedAt: '2026-11-01T12:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSettings', () => {
    it('returns company settings on successful 200 response', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: mockSettings }),
      } as Response);

      const res = await getSettings();
      expect(res.companyName).toBe('MAXR Global Technologies');
      expect(res.timezone).toBe('Asia/Kolkata');
      expect(res.workWeek.days).toHaveLength(5);
      expect(res.integrations.email).toBe(true);
    });

    it('throws SettingsApiError on non-ok status', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required',
          },
        }),
      } as Response);

      await expect(getSettings()).rejects.toThrow(SettingsApiError);
    });
  });

  describe('updateSettings', () => {
    it('sends PUT request with partial payload and returns updated settings', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { ...mockSettings, companyName: 'MAXR Flow Corp' },
        }),
      } as Response);

      const res = await updateSettings({ companyName: 'MAXR Flow Corp' });

      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: 'MAXR Flow Corp' }),
      });
      expect(res.companyName).toBe('MAXR Flow Corp');
    });

    it('throws SettingsApiError when PUT request fails with 400', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'A work week needs a start day that differs from its end day',
          },
        }),
      } as Response);

      await expect(
        updateSettings({ workWeek: { start: 'Monday', end: 'Monday' } }),
      ).rejects.toThrow(SettingsApiError);
    });
  });

  describe('getBasicSettings', () => {
    it('returns basic settings on success', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            companyName: 'MAXR Global Technologies',
            timezone: 'Asia/Kolkata',
            workWeek: mockSettings.workWeek,
          },
        }),
      } as Response);

      const res = await getBasicSettings();
      expect(res.companyName).toBe('MAXR Global Technologies');
      expect(res.timezone).toBe('Asia/Kolkata');
    });
  });
});
