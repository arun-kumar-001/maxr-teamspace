// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as profileApi from '../api/profileApi';
import { useProfile } from '../hooks/useProfile';
import type { EmployeeProfile } from '../types';

describe('useProfile Hook Suite (Issue #22)', () => {
  const mockProfile: EmployeeProfile = {
    id: 'emp-101',
    employeeCode: 'EMP-101',
    firstName: 'Vijay',
    lastName: 'Kumar',
    email: 'vijay@example.com',
    phone: '+91 91234 56789',
    department: { id: 'dept-1', name: 'Design', code: 'DES' },
    designation: { id: 'desig-1', title: 'Lead Designer', code: 'DES-LD' },
    manager: null,
    status: 'active',
    joiningDate: '2024-03-01',
    createdAt: '2024-03-01T00:00:00.000Z',
    updatedAt: '2024-03-01T00:00:00.000Z',
    version: 1,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches profile on mount and sets state', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useProfile());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.profile).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.phoneDraft).toBe('+91 91234 56789');
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error on mount', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockRejectedValueOnce(
      new profileApi.ProfileApiError('Network connection failed', 500),
    );

    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBe('Network connection failed');
  });

  it('manages phone edit state: start, change draft, and cancel', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEditingPhone).toBe(false);

    // Start editing
    act(() => {
      result.current.startEditingPhone();
    });
    expect(result.current.isEditingPhone).toBe(true);
    expect(result.current.phoneDraft).toBe('+91 91234 56789');

    // Change draft
    act(() => {
      result.current.setPhoneDraft('+91 99999 00000');
    });
    expect(result.current.phoneDraft).toBe('+91 99999 00000');

    // Cancel edit reverts to current profile phone
    act(() => {
      result.current.cancelEditingPhone();
    });
    expect(result.current.isEditingPhone).toBe(false);
    expect(result.current.phoneDraft).toBe('+91 91234 56789');
  });

  it('saves updated phone successfully and updates version', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);
    const updatedProfile: EmployeeProfile = {
      ...mockProfile,
      phone: '+91 98888 77777',
      version: 2,
    };
    const updateSpy = vi
      .spyOn(profileApi, 'updateProfilePhone')
      .mockResolvedValueOnce(updatedProfile);

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.startEditingPhone();
      result.current.setPhoneDraft('+91 98888 77777');
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePhone();
    });

    expect(success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith({
      version: 1,
      phone: '+91 98888 77777',
    });
    expect(result.current.profile?.phone).toBe('+91 98888 77777');
    expect(result.current.profile?.version).toBe(2);
    expect(result.current.isEditingPhone).toBe(false);
    expect(result.current.successMessage).toBe('Phone number updated successfully.');
  });

  it('does not send API request if phone is unchanged', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);
    const updateSpy = vi.spyOn(profileApi, 'updateProfilePhone');

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.startEditingPhone();
      // Set to same phone with extra spaces that get trimmed
      result.current.setPhoneDraft('  +91 91234 56789  ');
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePhone();
    });

    expect(success).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.current.isEditingPhone).toBe(false);
    expect(result.current.successMessage).toBe('Phone number is unchanged.');
  });

  it('rejects invalid phone input client-side without calling API', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);
    const updateSpy = vi.spyOn(profileApi, 'updateProfilePhone');

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.startEditingPhone();
      result.current.setPhoneDraft('invalid-text');
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePhone();
    });

    expect(success).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(result.current.saveError).toContain('Phone number must be 6 to 50 characters');
    expect(result.current.isEditingPhone).toBe(true);
  });

  it('CRITICAL 409 CONFLICT: refetches fresh profile, updates version, preserves user draft, informs user', async () => {
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(mockProfile);

    // Initial load
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Stale version error from update
    vi.spyOn(profileApi, 'updateProfilePhone').mockRejectedValueOnce(
      new profileApi.ProfileApiError('Version mismatch', 409, 'VERSION_CONFLICT'),
    );

    // Fresh profile on refetch has version 2
    const freshProfile: EmployeeProfile = {
      ...mockProfile,
      version: 2,
    };
    const fetchSpy = vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(freshProfile);

    act(() => {
      result.current.startEditingPhone();
      result.current.setPhoneDraft('+91 94444 33333');
    });

    let success = true;
    await act(async () => {
      success = await result.current.savePhone();
    });

    expect(success).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();

    // Verify stored profile has updated to version 2
    expect(result.current.profile?.version).toBe(2);

    // Verify user draft is strictly PRESERVED and editing is still OPEN
    expect(result.current.phoneDraft).toBe('+91 94444 33333');
    expect(result.current.isEditingPhone).toBe(true);
    expect(result.current.conflictWarning).toContain('modified in another session');

    // User clicks save again -> uses updated version 2!
    const finalProfile: EmployeeProfile = {
      ...mockProfile,
      phone: '+91 94444 33333',
      version: 3,
    };
    const updateSpy2 = vi
      .spyOn(profileApi, 'updateProfilePhone')
      .mockResolvedValueOnce(finalProfile);

    await act(async () => {
      success = await result.current.savePhone();
    });

    expect(success).toBe(true);
    expect(updateSpy2).toHaveBeenCalledWith({
      version: 2,
      phone: '+91 94444 33333',
    });
    expect(result.current.profile?.version).toBe(3);
    expect(result.current.profile?.phone).toBe('+91 94444 33333');
    expect(result.current.isEditingPhone).toBe(false);
  });

  it('CRITICAL 422 DEACTIVATED: disables editing and displays error', async () => {
    const deactivatedProfile: EmployeeProfile = {
      ...mockProfile,
      status: 'deactivated',
    };
    vi.spyOn(profileApi, 'fetchProfile').mockResolvedValueOnce(deactivatedProfile);

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Trying to start editing should be blocked
    act(() => {
      result.current.startEditingPhone();
    });
    expect(result.current.isEditingPhone).toBe(false);

    // If somehow triggered, savePhone returns false
    let success = true;
    await act(async () => {
      success = await result.current.savePhone();
    });
    expect(success).toBe(false);
    expect(result.current.saveError).toContain('Deactivated');
  });
});
