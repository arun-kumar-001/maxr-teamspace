import { ROLES, type Role } from '@maxr/shared';
import type { SidebarGroup, SidebarItem } from '../components/ui/Sidebar';

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

function NavSvgIcon({ name }: { name: NavItem['iconName'] | 'gallery' }) {
  const strokeProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.6',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <path d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'clock':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'check':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      );
    case 'file-text':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'shield':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'user':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <circle cx="12" cy="7" r="4" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        </svg>
      );
    case 'gallery':
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" {...strokeProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Maps authorized navigation items into Petalo-styled Sidebar groups conforming to DESIGN.md §5.
 */
export function getSidebarGroupsForRole(role: Role): SidebarGroup[] {
  const roleItems = getNavItemsForRole(role);

  const overviewItem = roleItems.find((i) => i.id === 'dashboard');
  const moduleItems = roleItems.filter((i) => i.id !== 'dashboard');

  let moduleLabel = 'Workforce';
  if (role === ROLES.ADMIN) moduleLabel = 'Administration';
  else if (role === ROLES.HR_MANAGER) moduleLabel = 'People & Organization';
  else if (role === ROLES.TEAM_LEAD) moduleLabel = 'Team Operations';
  else if (role === ROLES.STAFF) moduleLabel = 'My Workspace';

  const groups: SidebarGroup[] = [];

  // Group 1: Main Overview
  if (overviewItem) {
    groups.push({
      id: 'main-overview',
      items: [
        {
          id: overviewItem.path,
          label: overviewItem.label,
          href: overviewItem.path,
          icon: <NavSvgIcon name={overviewItem.iconName} />,
        },
      ],
    });
  }

  // Group 2: Role-specific modules
  if (moduleItems.length > 0) {
    groups.push({
      id: `module-${role}`,
      label: moduleLabel,
      items: moduleItems.map((item): SidebarItem => ({
        id: item.path,
        label: item.label,
        href: item.path,
        icon: <NavSvgIcon name={item.iconName} />,
        count: item.badge ? parseInt(String(item.badge), 10) : undefined,
        countTone: item.badge ? 'attention' : undefined,
      })),
    });
  }

  // Dev-only Group: Shared Component Gallery
  if (import.meta.env.DEV) {
    groups.push({
      id: 'development',
      label: 'Development',
      items: [
        {
          id: '/components',
          label: 'Component Gallery',
          href: '/components',
          icon: <NavSvgIcon name="gallery" />,
        },
      ],
    });
  }

  return groups;
}
