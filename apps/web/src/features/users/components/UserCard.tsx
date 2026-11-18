import { useState } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { Badge, Button } from '../../../components/ui';
import type { UserAccount } from '../types';

export interface UserCardProps {
  user: UserAccount;
  canAssignRoles?: boolean;
  onAssignRoles?: (user: UserAccount) => void;
  canToggleStatus?: boolean;
  onToggleStatus?: (user: UserAccount) => void;
  disableDeactivate?: boolean;
}

const ROLE_BADGE_VARIANTS: Record<Role, 'primary' | 'secondary' | 'outline' | 'neutral'> = {
  [ROLES.ADMIN]: 'primary',
  [ROLES.HR_MANAGER]: 'secondary',
  [ROLES.TEAM_LEAD]: 'outline',
  [ROLES.STAFF]: 'neutral',
};

const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.STAFF]: 'Staff',
};

export function UserCard({
  user,
  canAssignRoles = false,
  onAssignRoles,
  canToggleStatus = false,
  onToggleStatus,
  disableDeactivate = false,
}: UserCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const initials = user.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const formattedLastLogin = user.lastLoginAt
    ? new Date(user.lastLoginAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never';

  return (
    <div
      className="p-4 bg-surface border border-border rounded-tile shadow-card space-y-3"
      data-testid={`user-card-${user.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full bg-primary-soft text-primary-ink font-semibold flex items-center justify-center text-sm shrink-0"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <h3 className="font-semibold text-text text-sm sm:text-base leading-tight">
              {user.name}
            </h3>
            <p className="text-xs text-text-muted">{user.email}</p>
            <p className="text-xs font-mono text-text-subtle">{user.employeeCode}</p>
          </div>
        </div>

        <Badge variant={user.isActive ? 'success' : 'neutral'}>
          {user.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="pt-1">
        <span className="text-xs font-medium text-text-muted block mb-1">Roles:</span>
        <div className="flex flex-wrap gap-1.5" data-testid={`user-card-roles-${user.id}`}>
          {user.roles.map((r) => (
            <Badge key={r} variant={ROLE_BADGE_VARIANTS[r] || 'neutral'}>
              {ROLE_DISPLAY_NAMES[r] || r}
            </Badge>
          ))}
        </div>
      </div>

      {(user.tempCredential || user.temporaryPassword) && (
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span>Initial Password:</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span
              className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors ${
                revealed
                  ? 'bg-primary-soft text-primary-deep border-primary-strong/30 font-semibold'
                  : 'bg-surface-muted text-text-muted border-border font-medium'
              }`}
              data-testid={`card-password-value-${user.id}`}
            >
              {revealed
                ? ((user.tempCredential as string) || (user.temporaryPassword as string))
                : '••••••••••••'}
            </span>
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              aria-label={revealed ? 'Hide password' : 'View password'}
              data-testid={`card-toggle-password-${user.id}`}
              className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-raised cursor-pointer"
            >
              {revealed ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    ((user.tempCredential as string) || (user.temporaryPassword as string)),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  // ignore
                }
              }}
              aria-label="Copy password"
              data-testid={`card-copy-password-${user.id}`}
              className="p-1 rounded-md text-text-muted hover:text-primary-deep hover:bg-primary-soft cursor-pointer"
            >
              {copied ? (
                <span className="text-emerald-600 font-bold text-xs">✓</span>
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between text-xs text-text-muted gap-2">
        <div>
          <span>Last login: </span>
          <span className="font-medium text-text">{formattedLastLogin}</span>
        </div>

        {(canAssignRoles && onAssignRoles) || (canToggleStatus && onToggleStatus) ? (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {canAssignRoles && onAssignRoles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAssignRoles(user)}
                data-testid={`assign-roles-btn-card-${user.id}`}
                className="w-full sm:w-auto min-h-[44px] text-xs font-medium"
              >
                Manage Roles
              </Button>
            )}
            {canToggleStatus && onToggleStatus && (
              <Button
                variant="outline"
                size="sm"
                disabled={user.isActive && disableDeactivate}
                title={
                  user.isActive && disableDeactivate
                    ? 'You cannot deactivate your own account'
                    : undefined
                }
                onClick={() => onToggleStatus(user)}
                data-testid={`toggle-status-btn-card-${user.id}`}
                className="w-full sm:w-auto min-h-[44px] text-xs font-medium"
              >
                {user.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
