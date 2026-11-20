import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@maxr/shared';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '../api/client';
import { Button, FormField, Input } from '../components/ui';
import { useAuth } from './AuthContext';

/**
 * Shown instead of the app while the account still has a password someone else set. The server
 * refuses everything else until it is changed, so this page is the only way forward (or signing out).
 */
export function ForcedPasswordChangePage() {
  const { user, logout, markPasswordChanged } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) return setError('Enter the password you were given.');
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return setError(`The new password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword === currentPassword) {
      return setError('The new password must be different from the one you were given.');
    }
    if (newPassword !== confirmPassword) {
      return setError('The new passwords do not match.');
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(body?.error?.message ?? 'The password could not be changed.');
      }
      markPasswordChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The password could not be changed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col justify-center items-center px-4 py-8 bg-bg sm:px-6">
      <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <h1 className="text-xl font-bold text-text font-display">Choose your own password</h1>
            <p className="text-sm text-text-muted mt-1">
              {user?.email ? `${user.email}: ` : ''}the password you signed in with was set by
              someone else. Replace it with one only you know to continue.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-input bg-rose-50 border border-rose-200 text-sm text-rose-800 font-medium"
            >
              {error}
            </div>
          )}

          <FormField label="Password you were given" htmlFor="current-password" required>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="New password" htmlFor="forced-new-password" required>
            <Input
              id="forced-new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </FormField>

          <FormField label="Confirm new password" htmlFor="forced-confirm-password" required>
            <Input
              id="forced-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={isSubmitting}
            />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Change password'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            onClick={logout}
            disabled={isSubmitting}
          >
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
