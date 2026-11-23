import { useMemo, useState } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { Badge, Input } from '../../../components/ui';
import type { PermissionSummary } from '../types';

export interface PermissionsMatrixProps {
  permissions: PermissionSummary[];
  isLoading?: boolean;
}

const ROLES_ORDER: Role[] = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF];

const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.STAFF]: 'Staff',
};

const SCOPE_BADGE_VARIANTS: Record<
  string,
  'primary' | 'secondary' | 'outline' | 'neutral' | 'success'
> = {
  company: 'primary',
  team: 'secondary',
  own: 'outline',
  hr: 'primary',
  none: 'neutral',
};

export function PermissionsMatrix({ permissions, isLoading = false }: PermissionsMatrixProps) {
  const [filterText, setFilterText] = useState<string>('');

  const filteredPermissions = useMemo(() => {
    if (!filterText.trim()) return permissions;
    const q = filterText.toLowerCase();
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q),
    );
  }, [permissions, filterText]);

  // Group by module
  const groupedByModule = useMemo(() => {
    const map = new Map<string, PermissionSummary[]>();
    for (const p of filteredPermissions) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  }, [filteredPermissions]);

  return (
    <div className="space-y-4" data-testid="permissions-matrix">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text">Permission Catalog & Grants</h2>
          <p className="text-xs text-text-muted">
            Authority matrix defined in code. Inspect record scopes granted to each role.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search permissions..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="min-h-[40px] text-xs"
            data-testid="permission-search-input"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-text-muted">
          Loading permissions catalog...
        </div>
      ) : groupedByModule.size === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted bg-surface rounded-card border border-border">
          No permissions matching search criteria.
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByModule.entries()).map(([moduleName, modulePerms]) => (
            <div
              key={moduleName}
              className="bg-surface border border-border rounded-card shadow-card overflow-hidden"
              data-testid={`permission-module-${moduleName}`}
            >
              <div className="px-4 py-3 bg-surface-muted border-b border-border flex items-center justify-between">
                <span className="font-semibold text-xs sm:text-sm text-text uppercase tracking-wider font-mono">
                  {moduleName} Module
                </span>
                <span className="text-xs text-text-muted">
                  {modulePerms.length} {modulePerms.length === 1 ? 'action' : 'actions'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-surface text-text-muted font-medium">
                      <th className="py-2.5 px-4 w-1/4">Action / Key</th>
                      <th className="py-2.5 px-4 w-1/3">Description</th>
                      {ROLES_ORDER.map((role) => (
                        <th key={role} className="py-2.5 px-3 text-center">
                          {ROLE_LABELS[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {modulePerms.map((p) => (
                      <tr key={p.key} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-text">
                          {p.action || p.key}
                        </td>
                        <td className="py-3 px-4 text-text-muted leading-relaxed">
                          {p.description}
                        </td>
                        {ROLES_ORDER.map((role) => {
                          const scope = p.grants[role];
                          return (
                            <td key={role} className="py-3 px-3 text-center">
                              {scope ? (
                                <Badge
                                  variant={SCOPE_BADGE_VARIANTS[scope] || 'outline'}
                                  className="text-[10px]"
                                >
                                  {scope}
                                </Badge>
                              ) : (
                                <span className="text-text-subtle font-mono text-xs">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
