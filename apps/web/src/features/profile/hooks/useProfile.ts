import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchProfile,
  ProfileApiError,
  updateProfilePhone,
  validatePhoneInput,
} from '../api/profileApi';
import type { EmployeeProfile } from '../types';

export interface UseProfileReturn {
  profile: EmployeeProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveError: string | null;
  conflictWarning: string | null;
  successMessage: string | null;
  isEditingPhone: boolean;
  phoneDraft: string;
  setPhoneDraft: (phone: string) => void;
  startEditingPhone: () => void;
  cancelEditingPhone: () => void;
  savePhone: () => Promise<boolean>;
  refetch: () => Promise<void>;
  clearMessages: () => void;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [phoneDraft, setPhoneDraft] = useState<string>('');

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProfile(signal);
      if (isMountedRef.current) {
        setProfile(data);
        setPhoneDraft(data.phone ?? '');
      }
    } catch (err) {
      if (isMountedRef.current) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof ProfileApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load profile. Please try again.';
        setError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile]);

  const startEditingPhone = useCallback(() => {
    if (!profile || profile.status === 'deactivated') return;
    setPhoneDraft(profile.phone ?? '');
    setSaveError(null);
    setConflictWarning(null);
    setSuccessMessage(null);
    setIsEditingPhone(true);
  }, [profile]);

  const cancelEditingPhone = useCallback(() => {
    setPhoneDraft(profile?.phone ?? '');
    setSaveError(null);
    setConflictWarning(null);
    setIsEditingPhone(false);
  }, [profile]);

  const clearMessages = useCallback(() => {
    setSaveError(null);
    setConflictWarning(null);
    setSuccessMessage(null);
  }, []);

  const savePhone = useCallback(async (): Promise<boolean> => {
    if (!profile) return false;

    if (profile.status === 'deactivated') {
      setSaveError('Deactivated employee accounts cannot update profile information.');
      return false;
    }

    // Client-side validation check
    const validation = validatePhoneInput(phoneDraft);
    if (!validation.isValid) {
      setSaveError(validation.error || 'Invalid phone number format.');
      return false;
    }

    const normalizedDraft = phoneDraft.trim() === '' ? null : phoneDraft.trim();
    const currentPhone =
      profile.phone === null || profile.phone.trim() === '' ? null : profile.phone.trim();

    // Check if unchanged
    if (normalizedDraft === currentPhone) {
      setSuccessMessage('Phone number is unchanged.');
      setIsEditingPhone(false);
      return true;
    }

    setIsSaving(true);
    setSaveError(null);
    setConflictWarning(null);
    setSuccessMessage(null);

    try {
      const updated = await updateProfilePhone({
        version: profile.version,
        phone: normalizedDraft,
      });

      if (isMountedRef.current) {
        setProfile(updated);
        setPhoneDraft(updated.phone ?? '');
        setIsEditingPhone(false);
        setSuccessMessage('Phone number updated successfully.');
      }
      return true;
    } catch (err) {
      if (!isMountedRef.current) return false;

      if (err instanceof ProfileApiError) {
        // Stale version (409) - Fetch latest version, preserve draft, inform user
        if (err.status === 409) {
          try {
            const fresh = await fetchProfile();
            if (isMountedRef.current) {
              setProfile(fresh);
              // Draft remains preserved in phoneDraft
              setConflictWarning(
                'Your profile was modified in another session (version has updated). We have refreshed the profile data. Please review your phone number and click Save again.',
              );
            }
          } catch {
            setConflictWarning(
              'Your profile was modified in another session. Please refresh the page and try again.',
            );
          }
          return false;
        }

        // Deactivated (422)
        if (err.status === 422) {
          setSaveError('This employee account is deactivated. Changes are not permitted.');
          // Refresh profile to reflect deactivated state
          fetchProfile()
            .then((fresh) => {
              if (isMountedRef.current) {
                setProfile(fresh);
                setIsEditingPhone(false);
              }
            })
            .catch(() => undefined);
          return false;
        }

        // Bad request / Validation error (400)
        if (err.status === 400) {
          setSaveError(
            err.message ||
              'Phone number must be 6 to 50 characters and contain only digits, spaces, +, (, ) and -.',
          );
          return false;
        }

        setSaveError(err.message);
        return false;
      }

      setSaveError(err instanceof Error ? err.message : 'Failed to update phone number.');
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [profile, phoneDraft]);

  return {
    profile,
    isLoading,
    isSaving,
    error,
    saveError,
    conflictWarning,
    successMessage,
    isEditingPhone,
    phoneDraft,
    setPhoneDraft,
    startEditingPhone,
    cancelEditingPhone,
    savePhone,
    refetch: loadProfile,
    clearMessages,
  };
}
