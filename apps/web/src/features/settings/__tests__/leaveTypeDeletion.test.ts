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

const policy = (over: Partial<LeavePolicy>): LeavePolicy => ({
  id: 'p-casual',
  code: 'CASUAL',
  name: 'Casual leave',
  hasBalance: true,
  isActive: true,
  annualDays: 6,
  carryForwardMax: 0,
  allowHalfDay: true,
  maxBackdateDays: 0,
  version: 3,
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

const casual = policy({});
const sick = policy({ id: 'p-sick', code: 'SICK', name: 'Sick leave', annualDays: 12 });

async function load() {
  vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings);
  vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue(settings);
  const hook = renderHook(() => useSettings());
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
}

async function deleteCasualAndSave(hook: Awaited<ReturnType<typeof load>>) {
  const remaining = (hook.result.current.draft?.customLeaveTypes ?? []).filter(
    (t) => t.id !== 'p-casual',
  );
  act(() =>
    hook.result.current.updateDraft({
      customLeaveTypes: remaining,
      removedLeaveTypes: [{ id: 'p-casual', code: 'CASUAL' }],
    }),
  );
  await act(async () => {
    await hook.result.current.saveSettings();
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([casual, sick]);
  vi.mocked(leaveApi.updateLeavePolicy).mockResolvedValue(casual);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('a leave type deleted in Leave Setup is deleted on the server when settings are saved', () => {
  it('deletes the one that was removed and leaves the others alone', async () => {
    vi.mocked(leaveApi.deleteLeavePolicy).mockResolvedValue(undefined);
    const hook = await load();

    await deleteCasualAndSave(hook);

    expect(leaveApi.deleteLeavePolicy).toHaveBeenCalledTimes(1);
    expect(leaveApi.deleteLeavePolicy).toHaveBeenCalledWith('p-casual');
    expect(hook.result.current.leaveNotice).toBeNull();
  });

  it('deactivates it and says so when it has leave history (409)', async () => {
    vi.mocked(leaveApi.deleteLeavePolicy).mockRejectedValue(
      new leaveApi.LeaveApiError('has history', 409, 'CONFLICT'),
    );
    const hook = await load();

    await deleteCasualAndSave(hook);

    expect(leaveApi.updateLeavePolicy).toHaveBeenCalledWith('p-casual', {
      isActive: false,
      version: 3,
    });
    expect(hook.result.current.leaveNotice).toMatch(/Casual leave.*leave history.*deactivated/);
  });

  it('reports a failed delete instead of deactivating or hiding it', async () => {
    vi.mocked(leaveApi.deleteLeavePolicy).mockRejectedValue(
      new leaveApi.LeaveApiError('boom', 500),
    );
    const hook = await load();

    await deleteCasualAndSave(hook);

    expect(leaveApi.updateLeavePolicy).not.toHaveBeenCalled();
    expect(hook.result.current.leaveNotice).toMatch(/could not be deleted \(500: boom\)/);
  });

  it('shows why when the server route is missing, so an old API is easy to spot', async () => {
    vi.mocked(leaveApi.deleteLeavePolicy).mockRejectedValue(
      new leaveApi.LeaveApiError('Route DELETE /api/v1/leave-policies/x not found', 404),
    );
    const hook = await load();

    await deleteCasualAndSave(hook);

    expect(hook.result.current.leaveNotice).toMatch(/404: Route DELETE/);
  });

  it('never deletes a type the admin did not remove, even when the list could not be loaded', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockRejectedValue(new Error('offline'));
    const hook = await load();

    act(() => hook.result.current.updateDraft({ timezone: 'Europe/London' }));
    await act(async () => {
      await hook.result.current.saveSettings();
    });

    expect(leaveApi.deleteLeavePolicy).not.toHaveBeenCalled();
  });
});
