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
      setError('Invalid credentials. For quick demo, select a role below.');
    }
  };

  const handleQuickRoleSelect = (role: Role) => {
    switchRole(role);
    if (onSuccess) onSuccess();
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 bg-surface-muted sm:px-6 lg:px-8">
      {/* Brand Identity */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-950 shadow-md mb-3 border border-navy-800">
          <span className="text-xl font-black text-teal-500 tracking-tighter">M</span>
          <span className="text-xl font-black text-brand-red">1</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          MAXR Teamspace
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Staff Management &amp; Internal Workforce Platform
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-6 sm:p-8">
        {error && (
          <div
            className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 font-medium"
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
              placeholder="name@maxr.com"
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
              className="w-full"
              isLoading={isLoading}
            >
              Sign In to Teamspace
            </Button>
          </div>
        </form>

        {/* Development Quick Role Switcher */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 text-center">
            Development Quick Role Switcher
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(ROLES).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleQuickRoleSelect(role)}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
                data-testid={`quick-login-${role}`}
              >
                {ROLE_DISPLAY_NAMES[role]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
