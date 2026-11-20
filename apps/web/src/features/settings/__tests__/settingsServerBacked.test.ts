// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as settingsApi from '../api/settingsApi';
import { DEFAULT_LATE_DEDUCTION, useSettings } from '../hooks/useSettings';
import type { CompanySettings } from '../types';

const LOGO = 'data:image/png;base64,iVBORw0KGgo=';

const settings = (over: Partial<CompanySettings> = {}): CompanySettings => ({
  companyName: 'Acme',
  timezone: 'Asia/Kolkata',
  workWeek: {
    start: 'Monday',
    end: 'Friday',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  },
  integrations: { email: true, sms: false, calendarSync: false, payrollExport: false },
  companyLogo: null,
  lateDeductionPolicy: null,
  permissionPolicy: null,
  updatedAt: '2026-11-01T10:00:00Z',
  ...over,
});

const load = async () => {
  const hook = renderHook(() => useSettings());
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
};

describe('logo and policies are company settings kept on the server', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows what the server holds, and the defaults only where nothing was ever saved', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(
      settings({
        companyLogo: LOGO,
        lateDeductionPolicy: { ...DEFAULT_LATE_DEDUCTION, graceMinutes: 7 },
      }),
    );
    const { result } = await load();

    expect(result.current.draft?.companyLogo).toBe(LOGO);
    expect(result.current.draft?.lateDeductionPolicy?.graceMinutes).toBe(7);
    expect(result.current.draft?.permissionPolicy?.enabled).toBeDefined();
    expect(result.current.isDirty).toBe(false);
  });

  it('sends a changed logo and policy to the API when saving', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings());
    const update = vi
      .spyOn(settingsApi, 'updateSettings')
      .mockImplementation(async (payload) => settings({ ...payload } as Partial<CompanySettings>));
    const { result } = await load();

    act(() => {
      result.current.updateDraft({
        companyLogo: LOGO,
        lateDeductionPolicy: { ...DEFAULT_LATE_DEDUCTION, graceMinutes: 5 },
      });
    });
    expect(result.current.isDirty).toBe(true);
    await act(async () => {
      await result.current.saveSettings();
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      companyLogo: LOGO,
      lateDeductionPolicy: { graceMinutes: 5 },
    });
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty('permissionPolicy');
  });

  it('does not copy the logo or the policies into this browser', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings());
    vi.spyOn(settingsApi, 'updateSettings').mockImplementation(async (payload) =>
      settings({ ...payload } as Partial<CompanySettings>),
    );
    const { result } = await load();
    act(() => {
      result.current.updateDraft({
        companyLogo: LOGO,
        lateDeductionPolicy: { ...DEFAULT_LATE_DEDUCTION, graceMinutes: 5 },
      });
    });
    await act(async () => {
      await result.current.saveSettings();
    });

    const everything = JSON.stringify({ ...localStorage });
    expect(everything).not.toContain('iVBORw0KGgo');
    expect(localStorage.getItem('maxr_company_logo')).toBeNull();

    const config = JSON.parse(localStorage.getItem('maxr_company_config') ?? '{}');
    expect(config).not.toHaveProperty('companyLogo');
    expect(config).not.toHaveProperty('lateDeductionPolicy');
    expect(config).not.toHaveProperty('permissionPolicy');

    const cached = JSON.parse(localStorage.getItem('maxr_company_settings') ?? '{}');
    expect(cached.lateDeductionPolicy).toBeNull();
    expect(cached.companyLogo).toBeNull();
  });

  it('does not cache the logo or the policies in this browser when it loads them', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(
      settings({
        companyLogo: LOGO,
        lateDeductionPolicy: { ...DEFAULT_LATE_DEDUCTION, graceMinutes: 7 },
      }),
    );
    await load();

    expect(JSON.stringify({ ...localStorage })).not.toContain('iVBORw0KGgo');
    const cached = JSON.parse(localStorage.getItem('maxr_company_settings') ?? '{}');
    expect(cached.lateDeductionPolicy).toBeNull();
  });

  it('does not report a rejected save as saved, and keeps the change unsaved', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings());
    vi.spyOn(settingsApi, 'updateSettings').mockRejectedValue(
      new settingsApi.SettingsApiError('The logo is too large', 400, 'VALIDATION_ERROR'),
    );
    const { result } = await load();
    act(() => {
      result.current.updateDraft({ companyLogo: LOGO });
    });
    let saved = true;
    await act(async () => {
      saved = await result.current.saveSettings();
    });

    expect(saved).toBe(false);
    expect(result.current.error).toBe('The logo is too large');
    expect(result.current.isDirty).toBe(true);
  });

  it('shows an error, not cached or invented settings, when they cannot be loaded', async () => {
    localStorage.setItem(
      'maxr_company_settings',
      JSON.stringify(settings({ companyName: 'Stale Co' })),
    );
    vi.spyOn(settingsApi, 'getSettings').mockRejectedValue(
      new settingsApi.SettingsApiError('Server down', 503),
    );
    const { result } = await load();

    expect(result.current.settings).toBeNull();
    expect(result.current.draft).toBeNull();
    expect(result.current.error).toBe('Server down');
  });
});
