// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as profileApi from '../api/profileApi';
import { useOwnPhone, type OwnPhoneSource } from '../hooks/useOwnPhone';
import type { EmployeeProfile } from '../types';

const source: OwnPhoneSource = { phone: '+91 91234 56789', version: 3, status: 'active' };
const saved = { phone: '+91 99999 00000', version: 4 } as unknown as EmployeeProfile;

function setup(over: Partial<OwnPhoneSource> = {}) {
  const reload = vi.fn(async () => undefined);
  const hook = renderHook(() => useOwnPhone({ ...source, ...over }, reload));
  return { reload, hook };
}

describe('useOwnPhone: the employee editing their own phone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts with the saved phone, follows what is typed, and cancel puts it back', () => {
    const { hook } = setup();
    expect(hook.result.current.state.isEditingPhone).toBe(false);

    act(() => hook.result.current.state.onStartEditPhone());
    expect(hook.result.current.state.isEditingPhone).toBe(true);
    expect(hook.result.current.state.phoneDraft).toBe('+91 91234 56789');

    act(() => hook.result.current.state.onDraftChange('+91 11111 22222'));
    expect(hook.result.current.state.phoneDraft).toBe('+91 11111 22222');

    act(() => hook.result.current.state.onCancelEditPhone());
    expect(hook.result.current.state.isEditingPhone).toBe(false);
    expect(hook.result.current.state.phoneDraft).toBe('+91 91234 56789');
  });

  it('saves with the record version, reloads, and says it worked', async () => {
    const update = vi.spyOn(profileApi, 'updateProfilePhone').mockResolvedValue(saved);
    const { hook, reload } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onDraftChange('+91 99999 00000'));
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() =>
      expect(hook.result.current.successMessage).toBe('Phone number updated successfully.'),
    );
    expect(update).toHaveBeenCalledWith({ version: 3, phone: '+91 99999 00000' });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.isEditingPhone).toBe(false);
  });

  it('sends null when the phone is cleared', async () => {
    const update = vi.spyOn(profileApi, 'updateProfilePhone').mockResolvedValue(saved);
    const { hook } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onDraftChange(''));
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() => expect(update).toHaveBeenCalledWith({ version: 3, phone: null }));
  });

  it('does not call the API when nothing changed', async () => {
    const update = vi.spyOn(profileApi, 'updateProfilePhone');
    const { hook } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() =>
      expect(hook.result.current.successMessage).toBe('Phone number is unchanged.'),
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses a malformed phone before calling the API', async () => {
    const update = vi.spyOn(profileApi, 'updateProfilePhone');
    const { hook } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onDraftChange('abc'));
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() => expect(hook.result.current.state.saveError).toBeTruthy());
    expect(update).not.toHaveBeenCalled();
    expect(hook.result.current.state.isEditingPhone).toBe(true);
  });

  it('on a stale version (409): reloads, keeps what was typed and asks to save again', async () => {
    vi.spyOn(profileApi, 'updateProfilePhone').mockRejectedValue(
      new profileApi.ProfileApiError('conflict', 409, 'CONFLICT'),
    );
    const { hook, reload } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onDraftChange('+91 99999 00000'));
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() =>
      expect(hook.result.current.state.conflictWarning).toMatch(/modified in another session/),
    );
    expect(reload).toHaveBeenCalled();
    expect(hook.result.current.state.phoneDraft).toBe('+91 99999 00000');
    expect(hook.result.current.state.isEditingPhone).toBe(true);
  });

  it('on a deactivated account (422): says so, reloads and stops editing', async () => {
    vi.spyOn(profileApi, 'updateProfilePhone').mockRejectedValue(
      new profileApi.ProfileApiError('deactivated', 422, 'UNPROCESSABLE'),
    );
    const { hook, reload } = setup();

    act(() => hook.result.current.state.onStartEditPhone());
    act(() => hook.result.current.state.onDraftChange('+91 99999 00000'));
    act(() => hook.result.current.state.onSavePhone());

    await waitFor(() => expect(hook.result.current.state.saveError).toMatch(/deactivated/));
    await waitFor(() => expect(hook.result.current.state.isEditingPhone).toBe(false));
    expect(reload).toHaveBeenCalled();
  });

  it('does not let a deactivated employee start editing or save', async () => {
    const update = vi.spyOn(profileApi, 'updateProfilePhone');
    const { hook } = setup({ status: 'deactivated' });

    act(() => hook.result.current.state.onStartEditPhone());
    expect(hook.result.current.state.isEditingPhone).toBe(false);

    act(() => hook.result.current.state.onSavePhone());
    await waitFor(() => expect(hook.result.current.state.saveError).toMatch(/Deactivated/));
    expect(update).not.toHaveBeenCalled();
  });
});
