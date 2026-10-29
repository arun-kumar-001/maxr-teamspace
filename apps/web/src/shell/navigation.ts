import { ROLES, type Role } from '@maxr/shared';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  iconName:
    | 'home'
    | 'users'
    | 'clock'
    | 'calendar'
    | 'check'
    | 'briefcase'
    | 'file-text'
    | 'settings'
    | 'shield'
    | 'user';
  allowedRoles: readonly Role[];
  badge?: string | number;
}

export const NAVIGATION_REGISTRY: readonly NavItem[] = [
  // Shared / Overview Route
  {
    id: 'dashboard',
    label: 'Overview',
    path: '/dashboard',
    iconName: 'home',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF],
  },

  // Admin Routes (AGENTS.md §1)
  {
    id: 'admin-users',
    label: 'Users & Roles',
    path: '/admin/users',
    iconName: 'users',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-audit',
    label: 'Audit Logs',
    path: '/admin/audit',
    iconName: 'shield',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-settings',
    label: 'Company Config',
    path: '/admin/settings',
    iconName: 'settings',
    allowedRoles: [ROLES.ADMIN],
  },

  // HR Manager Routes (AGENTS.md §1)
  {
    id: 'hr-employees',
    label: 'Employee Directory',
    path: '/hr/employees',
    iconName: 'users',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-lifecycle',
    label: 'Onboarding / Offboarding',
    path: '/hr/lifecycle',
    iconName: 'briefcase',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-policies',
    label: 'Leave & Shift Policies',
    path: '/hr/policies',
    iconName: 'calendar',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-reports',
    label: 'HR Reports',
    path: '/hr/reports',
    iconName: 'file-text',
    allowedRoles: [ROLES.HR_MANAGER],
  },

  // Team Lead Routes (AGENTS.md §1)
  {
    id: 'lead-attendance',
    label: 'Team Attendance',
    path: '/lead/attendance',
    iconName: 'clock',
    allowedRoles: [ROLES.TEAM_LEAD],
  },
  {
    id: 'lead-approvals',
    label: 'Leave Approvals',
    path: '/lead/approvals',
    iconName: 'check',
    allowedRoles: [ROLES.TEAM_LEAD],
    badge: '2',
  },
  {
    id: 'lead-tasks',
    label: 'Team Tasks',
    path: '/lead/tasks',
    iconName: 'briefcase',
    allowedRoles: [ROLES.TEAM_LEAD],
  },
  {
    id: 'lead-reports',
    label: 'Team Reports',
    path: '/lead/reports',
    iconName: 'file-text',
    allowedRoles: [ROLES.TEAM_LEAD],
  },

  // Staff Routes (AGENTS.md §1)
  {
    id: 'staff-profile',
    label: 'My Profile',
    path: '/staff/profile',
    iconName: 'user',
    allowedRoles: [ROLES.STAFF],
  },
  {
    id: 'staff-attendance',
    label: 'Check-In / Check-Out',
    path: '/staff/attendance',
    iconName: 'clock',
    allowedRoles: [ROLES.STAFF],
  },
  {
    id: 'staff-leave',
    label: 'My Leave',
    path: '/staff/leave',
    iconName: 'calendar',
    allowedRoles: [ROLES.STAFF],
  },
  {
    id: 'staff-tasks',
    label: 'My Tasks',
    path: '/staff/tasks',
    iconName: 'check',
    allowedRoles: [ROLES.STAFF],
  },
  {
    id: 'staff-payslips',
    label: 'Payslips',
    path: '/staff/payslips',
    iconName: 'file-text',
    allowedRoles: [ROLES.STAFF],
  },
] as const;

/**
 * Returns strictly the navigation items authorized for the specified role.
 * Enforces deny-by-default and zero cross-role leakage.
 */
export function getNavItemsForRole(role: Role): NavItem[] {
  return NAVIGATION_REGISTRY.filter((item) => item.allowedRoles.includes(role));
}

/**
 * Checks whether a given path is authorized for the given role.
 */
export function isPathAuthorizedForRole(path: string, role: Role): boolean {
  // Common paths allowed for all authenticated users
  if (path === '/' || path === '/dashboard' || path === '/login' || path === '/components') {
    return true;
  }

  const matchingItem = NAVIGATION_REGISTRY.find((item) => item.path === path);
  if (!matchingItem) {
    // Check prefix matching for subroutes
    const prefixMatch = NAVIGATION_REGISTRY.find((item) => path.startsWith(item.path));
    if (prefixMatch) {
      return prefixMatch.allowedRoles.includes(role);
    }
    // Route not in registry (unknown/404)
    return true;
  }

  return matchingItem.allowedRoles.includes(role);
}
