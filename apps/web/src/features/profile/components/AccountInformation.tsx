import { ROLE_DISPLAY_NAMES } from '@maxr/shared';
import { Badge } from '../../../components/ui/StatusPill';
import type { EmployeeAccountInfo } from '../types';

export interface AccountInformationProps {
  account?: EmployeeAccountInfo;
}

export function AccountInformation({ account }: AccountInformationProps) {
  // STRICT RULE: Do not render anything when account is absent or undefined
  if (!account) {
    return null;
  }

  const formattedLastLogin = (() => {
    if (!account.lastLoginAt) return 'Never logged in';
    try {
      const date = new Date(account.lastLoginAt);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {
      // fallback
    }
    return account.lastLoginAt;
  })();

  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="account-info-heading"
      data-testid="account-info-card"
    >
      <div className="flex items-center gap-3 border-b border-border pb-4 mb-5">
        <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-strong flex items-center justify-center">
          <svg
            className="w-4 h-4 stroke-current"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div>
          <h2 id="account-info-heading" className="text-base font-semibold text-text">
            Account & System Access
          </h2>
          <p className="text-xs text-text-muted">
            Administrative account status and assigned security roles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Account Status */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Account Status
          </span>
          <div className="p-2 bg-surface-muted border border-border rounded-input flex items-center min-h-[42px]">
            <Badge variant={account.isActive ? 'success' : 'danger'}>
              {account.isActive ? 'Active Login' : 'Disabled'}
            </Badge>
          </div>
        </div>

        {/* Assigned Roles */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Assigned Roles
          </span>
          <div className="p-2 bg-surface-muted border border-border rounded-input flex flex-wrap items-center gap-1.5 min-h-[42px]">
            {account.roles.map((r) => (
              <Badge key={r} variant="outline" className="text-xs">
                {ROLE_DISPLAY_NAMES[r] || r}
              </Badge>
            ))}
          </div>
        </div>

        {/* Last Login */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-text-subtle mb-1">
            Last Sign In
          </span>
          <div className="p-2.5 bg-surface-muted border border-border rounded-input text-sm font-medium text-text">
            {formattedLastLogin}
          </div>
        </div>
      </div>
    </section>
  );
}
