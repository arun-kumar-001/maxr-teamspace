import { useCallback, useEffect, useRef, useState } from 'react';
import { ProfileApiError, updateProfilePhone, validatePhoneInput } from '../api/profileApi';
import type { PhoneEditState } from '../components/PersonalInformation';

export interface OwnPhoneSource {
  phone: string | null;
  version: number;
  status: 'active' | 'pending' | 'deactivated';
}

export interface UseOwnPhoneResult {
  /** What PersonalInformation needs to let the employee edit their phone. */
  state: PhoneEditState;
  successMessage: string | null;
  clearMessages: () => void;
}

/**
 * The employee editing their own phone (the one field that is theirs): validate, save with the
 * record version, and say what happened. `reload` re-reads the profile, which is where the new
 * phone and version come from; the same call recovers from a stale version.
 */
export function useOwnPhone(
  source: OwnPhoneSource,
  reload: () => Promise<void>,
): UseOwnPhoneResult {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(source.phone ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A reload while not editing brings the draft in line with the saved phone.
  useEffect(() => {
    if (!isEditing) setDraft(source.phone ?? '');
  }, [source.phone, isEditing]);

  const clearMessages = useCallback(() => {
    setSaveError(null);
    setConflictWarning(null);
    setSuccessMessage(null);
  }, []);

  const start = useCallback(() => {
    if (source.status === 'deactivated') return;
    setDraft(source.phone ?? '');
    clearMessages();
    setIsEditing(true);
  }, [source.phone, source.status, clearMessages]);

  const cancel = useCallback(() => {
    setDraft(source.phone ?? '');
    setSaveError(null);
    setConflictWarning(null);
    setIsEditing(false);
  }, [source.phone]);

  const save = useCallback(async () => {
    if (source.status === 'deactivated') {
      setSaveError('Deactivated employee accounts cannot update profile information.');
      return;
    }
    const validation = validatePhoneInput(draft);
    if (!validation.isValid) {
      setSaveError(validation.error || 'Invalid phone number format.');
      return;
    }
    const next = draft.trim() === '' ? null : draft.trim();
    const current =
      source.phone === null || source.phone.trim() === '' ? null : source.phone.trim();
    if (next === current) {
      setSuccessMessage('Phone number is unchanged.');
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    clearMessages();
    try {
      await updateProfilePhone({ version: source.version, phone: next });
      await reload();
      if (mounted.current) {
        setIsEditing(false);
        setSuccessMessage('Phone number updated successfully.');
      }
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof ProfileApiError && err.status === 409) {
        // Someone changed the record: show the latest, keep what was typed, ask to save again.
        await reload().catch(() => undefined);
        if (mounted.current) {
          setConflictWarning(
            'Your profile was modified in another session (version has updated). We have refreshed the profile data. Please review your phone number and click Save again.',
          );
        }
      } else if (err instanceof ProfileApiError && err.status === 422) {
        setSaveError('This employee account is deactivated. Changes are not permitted.');
        await reload().catch(() => undefined);
        if (mounted.current) setIsEditing(false);
      } else if (err instanceof ProfileApiError && err.status === 400) {
        setSaveError(
          err.message ||
            'Phone number must be 6 to 50 characters and contain only digits, spaces, +, (, ) and -.',
        );
      } else {
        setSaveError(err instanceof Error ? err.message : 'Failed to update phone number.');
      }
    } finally {
      if (mounted.current) setIsSaving(false);
    }
  }, [draft, source.phone, source.status, source.version, reload, clearMessages]);

  return {
    state: {
      phoneDraft: draft,
      isEditingPhone: isEditing,
      isSavingPhone: isSaving,
      saveError,
      conflictWarning,
      onDraftChange: setDraft,
      onStartEditPhone: start,
      onCancelEditPhone: cancel,
      onSavePhone: () => void save(),
    },
    successMessage,
    clearMessages,
  };
}
