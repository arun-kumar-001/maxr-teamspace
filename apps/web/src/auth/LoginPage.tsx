import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';
import { Button, Input, FormField } from '../components/ui';
import { ROLES, ROLE_DISPLAY_NAMES, type Role } from '@maxr/shared';

export interface LoginPageProps {
  onSuccess?: () => void;
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const { login, isLoading, switchRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Please enter your work email.');
      return;
    }

    const success = await login(email, password);
    if (success) {
      if (onSuccess) onSuccess();
    } else {
      setError('Invalid credentials. Check your work email and password.');
    }
  };

  const handleQuickRoleSelect = (role: Role) => {
    switchRole(role);
    if (onSuccess) onSuccess();
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
          Staff Management &amp; Internal Workforce Platform
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-card p-6 sm:p-8">
        {error && (
          <div
            className="mb-6 p-3 rounded-input bg-negative-soft border border-negative-ink/20 text-sm text-negative-ink font-medium"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Work Email" required error={error ? ' ' : undefined}>
            <Input
              id="login-email"
              type="email"
              placeholder="e.g. admin@maxr.internal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField label="Password" required>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormField>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full min-h-[44px]"
              isLoading={isLoading}
            >
              Sign In to Teamspace
            </Button>
          </div>
        </form>

        {/* Development Quick Role Switcher (Opt-in via VITE_DEV_MOCK_AUTH=true only) */}
        {import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH === 'true' && (
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 text-center">
              Development Quick Role Switcher
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(ROLES).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleQuickRoleSelect(role)}
                  className="px-3 py-2 text-xs font-medium rounded-input border border-border bg-surface-muted text-text hover:bg-surface-raised hover:border-border-strong transition-colors focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  data-testid={`quick-login-${role}`}
                >
                  {ROLE_DISPLAY_NAMES[role]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
