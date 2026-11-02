import { ROLES, type Role } from '@maxr/shared';
import { Badge } from '../../../components/ui';
import type { RoleSummary } from '../types';

export interface RolesSummaryGridProps {
  roles: RoleSummary[];
  isLoading?: boolean;
}

const ROLE_BADGE_VARIANTS: Record<Role, 'primary' | 'secondary' | 'outline' | 'neutral'> = {
  [ROLES.ADMIN]: 'primary',
  [ROLES.HR_MANAGER]: 'secondary',
  [ROLES.TEAM_LEAD]: 'outline',
  [ROLES.STAFF]: 'neutral',
};

export function RolesSummaryGrid({ roles, isLoading = false }: RolesSummaryGridProps) {
  return (
    <div className="space-y-4" data-testid="roles-summary-grid">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-text">System Roles</h2>
          <p className="text-xs text-text-muted">
            The four fixed roles defined by system architecture (Decision D-21).
          </p>
        </div>
        <Badge variant="neutral">Fixed Roles</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((r) => (
          <div
            key={r.key}
            className="p-4 bg-surface border border-border rounded-card shadow-card flex flex-col justify-between gap-3"
            data-testid={`role-stat-${r.key}`}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text text-sm">{r.name}</span>
                <Badge variant={ROLE_BADGE_VARIANTS[r.key] || 'neutral'}>{r.key}</Badge>
              </div>
              <p className="text-xs text-text-muted leading-relaxed min-h-[36px]">
                {r.description || 'System role'}
              </p>
            </div>

            <div className="pt-2 border-t border-border flex items-baseline justify-between">
              <span className="text-xs text-text-muted">Active accounts</span>
              <span className="font-display font-bold text-xl text-primary-deep tabular-nums">
                {isLoading ? '-' : r.activeUsers}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
