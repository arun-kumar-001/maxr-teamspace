import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, FormField, Input } from '../../../components/ui';
import { setOnboardingPassword } from '../api/onboarding';

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        'Missing or invalid password setup token. Please request a new link from your HR manager.',
      );
      return;
    }

    if (password.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }

    if (password.length > 128) {
      setError('Password must be at most 128 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await setOnboardingPassword(token, password);
      setIsSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to set password. The link may have expired or already been used.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-bg sm:px-6 lg:px-8">
      {/* Brand Identity */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-card bg-primary text-sidebar font-display font-bold shadow-card mb-3">
          <span className="text-xl font-black">M</span>
          <span className="text-xl font-black text-brand-red">1</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl font-display">
          MAXR Teamspace
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Staff Onboarding &bull; Account Password Setup
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-card p-6 sm:p-8">
        {isSuccess ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
              ✓
            </div>
            <h2 className="text-lg font-bold text-text">Password Set Successfully</h2>
            <p className="text-xs sm:text-sm text-text-muted">
              Your credentials have been securely configured. Once your onboarding checklist is
              completed and approved, you will be able to log in to your account.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <h2 className="text-lg font-bold text-text">Set Your Account Password</h2>
              <p className="text-xs text-text-muted mt-1">
                Choose a strong password (minimum 12 characters) to claim your account.
              </p>
            </div>

            {error && (
              <div
                className="p-3 rounded-input bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 font-medium"
                role="alert"
              >
                {error}
              </div>
            )}

            {!token && (
              <div className="p-3 rounded-input bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                No setup token detected in link. Please use the full link sent by your
                administrator.
              </div>
            )}

            <FormField label="New Password" htmlFor="new-password" required>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </FormField>

            <FormField label="Confirm Password" htmlFor="confirm-password" required>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </FormField>

            <div className="text-xs text-text-subtle space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    password.length >= 12 ? 'text-emerald-700 font-bold' : 'text-text-muted'
                  }
                >
                  {password.length >= 12 ? '✓' : '•'}
                </span>
                <span>Minimum 12 characters</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={
                    password && password === confirmPassword
                      ? 'text-emerald-700 font-bold'
                      : 'text-text-muted'
                  }
                >
                  {password && password === confirmPassword ? '✓' : '•'}
                </span>
                <span>Passwords match</span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmitting}
              disabled={isSubmitting || !token}
            >
              Set Password &amp; Continue
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SetPasswordPage;
