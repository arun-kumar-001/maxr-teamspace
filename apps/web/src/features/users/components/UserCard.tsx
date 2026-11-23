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
