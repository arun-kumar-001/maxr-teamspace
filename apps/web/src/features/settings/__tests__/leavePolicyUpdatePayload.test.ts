// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as leaveApi from '../../leave/api/leave';
import * as settingsApi from '../api/settingsApi';
import { useSettings } from '../hooks/useSettings';
import type { LeavePolicy } from '../../leave/types';
import type { CompanySettings } from '../types';

vi.mock('../../leave/api/leave', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../leave/api/leave')>()),
  fetchLeavePolicies: vi.fn(),
  createLeavePolicy: vi.fn(),
  updateLeavePolicy: vi.fn(),
  deleteLeavePolicy: vi.fn(),
}));

const settings: CompanySettings = {
  companyName: 'MAXR',
  timezone: 'Asia/Kolkata',
  workWeek: { start: 'Monday', end: 'Friday', days: ['Monday', 'Tuesday'] },
  integrations: { email: true, sms: false, calendarSync: false, payrollExport: false },
  companyLogo: null,
  lateDeductionPolicy: null,
  permissionPolicy: null,
  updatedAt: '2026-11-01T10:00:00Z',
};

const sick: LeavePolicy = {
  id: 'p-sick',
  code: 'SL',
  name: 'Sick Leave',
  hasBalance: false,
  isActive: true,
  annualDays: 0,
  carryForwardMax: 0,
  allowHalfDay: true,
  maxBackdateDays: 0,
  version: 3,
  updatedAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([sick]);
  vi.mocked(leaveApi.updateLeavePolicy).mockResolvedValue(sick);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('Leave Setup sends what makes balances follow the setup', () => {
  it('turns on the balance and applies the quota to this year when an unpaid type becomes paid', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings);
    vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue(settings);
    const hook = renderHook(() => useSettings());
    await act(async () => {
      await Promise.resolve();
    });

    const types = (hook.result.current.draft?.customLeaveTypes ?? []).map((t) =>
      t.id === 'p-sick' ? { ...t, isPaid: true, quota: 12, annualEntitlement: 12 } : t,
    );
    act(() => hook.result.current.updateDraft({ customLeaveTypes: types }));
    await act(async () => {
      await hook.result.current.saveSettings();
    });

    expect(leaveApi.updateLeavePolicy).toHaveBeenCalledWith(
      'p-sick',
      expect.objectContaining({
        hasBalance: true,
        annualDays: 12,
        applyToCurrentBalances: true,
        version: 3,
      }),
    );
  });
});
