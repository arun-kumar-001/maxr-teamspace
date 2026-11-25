// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as leaveApi from '../../leave/api/leave';
import * as settingsApi from '../api/settingsApi';
import { useSettings, type CustomLeaveType } from '../hooks/useSettings';
import { leaveCodeFromName, validateLeaveCode } from '../lib/leave-code';
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

const existing: LeavePolicy = {
  id: 'p-al',
  code: 'AL',
  name: 'Annual Leave',
  hasBalance: true,
  isActive: true,
  annualDays: 12,
  carryForwardMax: 0,
  allowHalfDay: true,
  maxBackdateDays: 0,
  version: 1,
  updatedAt: '2026-11-01T00:00:00Z',
};

const newType = (over: Partial<CustomLeaveType>): CustomLeaveType => ({
  id: 'draft-1',
  name: 'Study Leave',
  code: 'STUDY',
  category: 'general',
  frequency: 'yearly',
  quota: 5,
  isPaid: true,
  isActive: true,
  ...over,
});

async function loadAndSave(types: CustomLeaveType[]) {
  vi.spyOn(settingsApi, 'getSettings').mockResolvedValue(settings);
  vi.spyOn(settingsApi, 'updateSettings').mockResolvedValue(settings);
  const hook = renderHook(() => useSettings());
  await act(async () => {
    await Promise.resolve();
  });
  act(() => hook.result.current.updateDraft({ customLeaveTypes: types }));
  let saved = true;
  await act(async () => {
    saved = await hook.result.current.saveSettings();
  });
  return { hook, saved };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(leaveApi.fetchLeavePolicies).mockResolvedValue([existing]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('saving Leave Setup reports what the server refused', () => {
  it('says the save failed, and why, when a new leave type is rejected', async () => {
    vi.mocked(leaveApi.createLeavePolicy).mockRejectedValue(
      new leaveApi.LeaveApiError(
        'Request validation failed (body.name: A leave type with this name already exists)',
        400,
        'VALIDATION_ERROR',
      ),
    );
    const { hook, saved } = await loadAndSave([newType({})]);

    expect(saved).toBe(false);
    expect(hook.result.current.error).toMatch(/"Study Leave" could not be saved/);
    expect(hook.result.current.error).toMatch(/A leave type with this name already exists/);
  });

  it('says the save failed when an existing leave type cannot be updated', async () => {
    vi.mocked(leaveApi.updateLeavePolicy).mockRejectedValue(
      new leaveApi.LeaveApiError('This policy was changed by someone else', 409, 'CONFLICT'),
    );
    const { hook, saved } = await loadAndSave([
      newType({ id: 'p-al', code: 'AL', name: 'Annual Leave', quota: 15 }),
    ]);

    expect(saved).toBe(false);
    expect(hook.result.current.error).toMatch(/"Annual Leave" could not be saved/);
    expect(hook.result.current.error).toMatch(/changed by someone else/);
  });

  it('does not send an invalid code to the server, and says what the code must look like', async () => {
    const { hook, saved } = await loadAndSave([newType({ code: '1ST' })]);

    expect(saved).toBe(false);
    expect(leaveApi.createLeavePolicy).not.toHaveBeenCalled();
    expect(hook.result.current.error).toMatch(/"1ST" is not a valid code/);
    expect(hook.result.current.error).toMatch(/starting with a letter/);
  });

  it('saves a valid new leave type with its code as typed and reports success', async () => {
    vi.mocked(leaveApi.createLeavePolicy).mockResolvedValue({ ...existing, id: 'p-new' });
    const { hook, saved } = await loadAndSave([newType({ code: 'study_2' })]);

    expect(saved).toBe(true);
    expect(hook.result.current.error).toBeNull();
    expect(leaveApi.createLeavePolicy).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STUDY_2', name: 'Study Leave', annualDays: 5 }),
    );
  });

  it('does not create leave types when the server list cannot be read, and says so', async () => {
    vi.mocked(leaveApi.fetchLeavePolicies).mockRejectedValue(new Error('offline'));
    const { hook, saved } = await loadAndSave([newType({})]);

    expect(saved).toBe(false);
    expect(leaveApi.createLeavePolicy).not.toHaveBeenCalled();
    expect(hook.result.current.error).toMatch(/could not be checked on the server \(offline\)/);
  });
});

describe('leave code rule matches the API', () => {
  it('accepts what the API accepts and rejects what it rejects', () => {
    for (const ok of ['AL', 'sick_2', 'A1', 'X'.repeat(30)]) {
      expect(validateLeaveCode(ok).ok).toBe(true);
    }
    for (const bad of ['', 'A', '1A', '_A', 'A-B', 'A B', 'X'.repeat(31)]) {
      expect(validateLeaveCode(bad).ok).toBe(false);
    }
  });

  it('makes a code from a name, or says it could not', () => {
    expect(leaveCodeFromName('Study Leave')).toEqual({ ok: true, value: 'STUDY_LEAVE' });
    expect(leaveCodeFromName('12 Days')).toEqual({ ok: true, value: 'DAYS' });
    expect(leaveCodeFromName('###').ok).toBe(false);
  });
});
