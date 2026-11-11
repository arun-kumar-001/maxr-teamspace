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

  // Admin Routes
  {
    id: 'admin-employees',
    label: 'Employee Directory',
    path: '/admin/employees',
    iconName: 'users',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-onboarding',
    label: 'Onboarding',
    path: '/onboarding',
    iconName: 'briefcase',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-departments',
    label: 'Departments',
    path: '/admin/departments',
    iconName: 'briefcase',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-designations',
    label: 'Designations',
    path: '/admin/designations',
    iconName: 'file-text',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-org-chart',
    label: 'Reporting Hierarchy',
    path: '/admin/org-chart',
    iconName: 'users',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-reports',
    label: 'Reports & Analytics',
    path: '/admin/reports',
    iconName: 'file-text',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-users',
    label: 'Users & Roles',
    path: '/admin/users',
    iconName: 'users',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-settings',
    label: 'Company Configuration',
    path: '/admin/settings',
    iconName: 'settings',
    allowedRoles: [ROLES.ADMIN],
  },
  {
    id: 'admin-audit',
    label: 'Audit Logs',
    path: '/admin/audit',
    iconName: 'shield',
    allowedRoles: [ROLES.ADMIN],
  },

  // HR Manager Routes
  {
    id: 'hr-employees',
    label: 'Employee Directory',
    path: '/hr/employees',
    iconName: 'users',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-lifecycle',
    label: 'Onboarding',
    path: '/hr/lifecycle',
    iconName: 'briefcase',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-departments',
    label: 'Departments',
    path: '/hr/departments',
    iconName: 'briefcase',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-designations',
    label: 'Designations',
    path: '/hr/designations',
    iconName: 'file-text',
    allowedRoles: [ROLES.HR_MANAGER],
  },
  {
    id: 'hr-org-chart',
    label: 'Reporting Hierarchy',
    path: '/hr/org-chart',
    iconName: 'users',
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
    label: 'Reports & Analytics',
    path: '/hr/reports',
    iconName: 'file-text',
    allowedRoles: [ROLES.HR_MANAGER],
  },

  // Shared Admin & HR Operational Routes
  {
    id: 'attendance-policies',
    label: 'Attendance Policies',
    path: '/shifts',
    iconName: 'clock',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER],
  },
  {
    id: 'leave-policies',
    label: 'Leave Policies',
    path: '/leave/policies',
    iconName: 'calendar',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/approvals',
    iconName: 'check',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    path: '/attendance',
    iconName: 'clock',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER],
  },
  {
    id: 'leave',
    label: 'Leave Management',
    path: '/leave',
    iconName: 'calendar',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    path: '/tasks',
    iconName: 'check',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER],
  },

  // Team Lead Routes
  {
    id: 'lead-team',
    label: 'Team Directory',
    path: '/lead/team',
    iconName: 'users',
    allowedRoles: [ROLES.TEAM_LEAD],
  },
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

  // Shared Collaboration & Self-Service Routes (All authenticated roles)
  {
    id: 'projects',
    label: 'Projects',
    path: '/projects',
    iconName: 'briefcase',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF],
  },
  {
    id: 'meetings',
    label: 'Calendar & Meetings',
    path: '/meetings',
    iconName: 'calendar',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF],
  },
  {
    id: 'expenses',
    label: 'Expenses & Claims',
    path: '/expenses',
    iconName: 'file-text',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF],
  },
  {
    id: 'my-profile',
    label: 'My Profile',
    path: '/profile',
    iconName: 'user',
    allowedRoles: [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF],
  },

  // Staff Specific Routes
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
  if (path === '/' || path === '/dashboard' || path === '/login' || path === '/set-password') {
    return true;
  }

  // Component Gallery strictly restricted to Development mode or explicit flag
  if (path === '/components' || path.startsWith('/components/')) {
    return Boolean(import.meta.env.DEV || import.meta.env.VITE_ENABLE_GALLERY === 'true');
  }

  // Company Settings routes - Admin only
  if (path === '/settings' || path.startsWith('/settings/') || path.startsWith('/admin/settings')) {
    return role === ROLES.ADMIN;
  }

  // Audit log & User role admin routes - Admin only
  if (
    path.startsWith('/admin/users') ||
    path.startsWith('/admin/audit') ||
    path.startsWith('/admin/reports')
  ) {
    return role === ROLES.ADMIN;
  }

  // Employee deactivation route (Issue #26) - Admin only (D-23)
  if (path.match(/^\/(admin\/)?employees\/[^/]+\/deactivate/)) {
    return role === ROLES.ADMIN;
  }

  // Employee documents routes (Issue #25) - TL denied, Admin & HR Manager allowed
  if (path.match(/^\/(admin\/|hr\/)?employees\/[^/]+\/documents/)) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Staff documents route
  if (path === '/staff/documents' || path.startsWith('/staff/documents/')) {
    return role === ROLES.STAFF || role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Notifications route - accessible to all authenticated roles
  if (path === '/notifications' || path.startsWith('/notifications/')) {
    return true;
  }

  // Projects route (Issue #42) - accessible to all authenticated roles
  if (path === '/projects' || path.startsWith('/projects/')) {
    return true;
  }

  // Meetings routes (Issue #45) - accessible to all authenticated roles
  if (
    path === '/meetings' ||
    path.startsWith('/meetings/') ||
    path === '/staff/meetings' ||
    path.startsWith('/staff/meetings/') ||
    path === '/lead/meetings' ||
    path.startsWith('/lead/meetings/') ||
    path === '/admin/meetings' ||
    path.startsWith('/admin/meetings/')
  ) {
    return true;
  }

  // Expenses routes (Issue #29) - accessible to all authenticated roles
  if (
    path === '/expenses' ||
    path.startsWith('/expenses/') ||
    path === '/staff/expenses' ||
    path.startsWith('/staff/expenses/') ||
    path === '/lead/expenses' ||
    path.startsWith('/lead/expenses/') ||
    path === '/hr/expenses' ||
    path.startsWith('/hr/expenses/') ||
    path === '/admin/expenses' ||
    path.startsWith('/admin/expenses/')
  ) {
    return true;
  }

  // Reports routes (Issue #15 & #47)
  if (path === '/reports' || path.startsWith('/reports/')) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER || role === ROLES.TEAM_LEAD;
  }
  if (path === '/hr/reports' || path.startsWith('/hr/reports/')) {
    return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  }
  if (path === '/lead/reports' || path.startsWith('/lead/reports/')) {
    return role === ROLES.TEAM_LEAD || role === ROLES.ADMIN;
  }

  // Approvals routes (Issue #40) - Admin, HR Manager, and Team Lead allowed, Staff denied
  if (path === '/approvals' || path.startsWith('/approvals/')) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER || role === ROLES.TEAM_LEAD;
  }
  if (path === '/lead/approvals' || path.startsWith('/lead/approvals/')) {
    return role === ROLES.TEAM_LEAD || role === ROLES.ADMIN;
  }
  if (path === '/hr/approvals' || path.startsWith('/hr/approvals/')) {
    return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  }

<<<<<<< HEAD
  // Shifts and Policies routes - Admin & HR Manager only
  if (path === '/shifts' || path.startsWith('/shifts/') || path.startsWith('/hr/policies')) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Leave Policy administration - Admin & HR Manager only
  if (path === '/leave/policies' || path.startsWith('/leave/policies/') || path === '/hr/leave') {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Leave canonical routes (requests, balances, calendar, holidays)
  if (path === '/leave' || path.startsWith('/leave/') || path === '/hr/holidays') {
=======
  // Shifts and Policies routes
  if (path === '/shifts' || path.startsWith('/shifts/')) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Leave canonical routes
  if (path === '/leave' || path.startsWith('/leave/')) {
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
    return true;
  }

  // Tasks routes (Issue #43)
  if (path === '/tasks' || path.startsWith('/tasks/')) {
    return true;
  }
  if (path === '/lead/tasks' || path.startsWith('/lead/tasks')) {
    return role === ROLES.TEAM_LEAD || role === ROLES.ADMIN;
  }
  if (path === '/staff/tasks' || path.startsWith('/staff/tasks')) {
    return true;
  }

  // Onboarding routes authorization
  if (
    path.startsWith('/hr/onboarding') ||
    path.startsWith('/hr/lifecycle') ||
    path === '/onboarding'
  ) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  if (path.startsWith('/staff/onboarding')) {
    return role === ROLES.STAFF;
  }

  // Employee creation routes (Issue #20) - Admin & HR Manager allowed, Team Lead & Staff denied
  if (
    path === '/employees/new' ||
    path === '/admin/employees/new' ||
    path === '/hr/employees/new'
  ) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }

  // Org chart routes (Issue #23)
  if (path === '/employees/org-chart') {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER || role === ROLES.TEAM_LEAD;
  }
  if (path === '/admin/org-chart') {
    return role === ROLES.ADMIN;
  }
  if (path === '/hr/org-chart') {
    return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  }

  // Employee detail route (Issues 21 and 155) - Canonical /employees/:id accessible to all authenticated roles
  // Backend GET /employees/:id enforces record scope (Staff: own record only, TL: direct reports, Admin/HR: all)
  if (path.match(/^\/employees\/[^/]+$/)) {
    return true;
  }
  if (path.match(/^\/admin\/employees\/[^/]+$/)) {
    return role === ROLES.ADMIN;
  }
  if (path.match(/^\/hr\/employees\/[^/]+$/)) {
    return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  }

  // Canonical employee directory routes
  if (path === '/employees' || path.startsWith('/employees/')) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER || role === ROLES.TEAM_LEAD;
  }
  if (path.startsWith('/admin/employees')) {
    return role === ROLES.ADMIN;
  }
  if (path.startsWith('/hr/employees')) {
    return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  }
  if (path.startsWith('/lead/team') || path.startsWith('/lead/attendance')) {
    return role === ROLES.TEAM_LEAD || role === ROLES.ADMIN;
  }

  // Attendance canonical routes
  if (
    path === '/attendance' ||
    path.startsWith('/attendance/') ||
    path.startsWith('/staff/attendance')
  ) {
    return true;
  }

  // Attendance canonical routes
  if (path === '/attendance' || path.startsWith('/attendance/')) {
    return true;
  }

  // Canonical departments & designations routes (Issue #18)
  if (
    path === '/departments' ||
    path.startsWith('/departments/') ||
    path === '/designations' ||
    path.startsWith('/designations/') ||
    path.startsWith('/hr/departments') ||
    path.startsWith('/hr/designations')
  ) {
    return role === ROLES.ADMIN || role === ROLES.HR_MANAGER;
  }
  if (path.startsWith('/admin/departments') || path.startsWith('/admin/designations')) {
    return role === ROLES.ADMIN;
  }

  // My Profile canonical route & compatibility redirect (Issue #22)
  if (
    path === '/profile' ||
    path.startsWith('/profile/') ||
    path === '/staff/profile' ||
    path.startsWith('/staff/profile/')
  ) {
    return true;
  }

  // Fallback check against registry
  const matchingItem = NAVIGATION_REGISTRY.find((item) => item.path === path);
  if (matchingItem) {
    return matchingItem.allowedRoles.includes(role);
  }
  const prefixMatch = NAVIGATION_REGISTRY.find((item) => path.startsWith(item.path));
  if (prefixMatch) {
    return prefixMatch.allowedRoles.includes(role);
  }

  // Role-prefixed fallback guard (deny-by-default for unknown admin/hr/lead subpaths)
  if (path.startsWith('/admin')) return role === ROLES.ADMIN;
  if (path.startsWith('/hr')) return role === ROLES.HR_MANAGER || role === ROLES.ADMIN;
  if (path.startsWith('/lead')) return role === ROLES.TEAM_LEAD || role === ROLES.ADMIN;

  // Unknown top-level route (404 handler)
  return true;
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
<<<<<<< HEAD
 * Centralized role-based Sidebar group generator.
 * Admin matches consolidated enterprise hierarchy:
 * 1. Overview
 * 2. People (Employee Directory, Onboarding, Organization -> Departments, Designations, Reporting Hierarchy)
 * 3. Attendance & Leave (Attendance -> On Duty/Roster/Timesheets, Leave Management -> Requests/Calendar, Attendance Policies, Leave Policies)
 * 4. Work Management (Tasks, Projects, Calendar & Meetings)
 * 5. Expenses & Claims, Approvals, Reports & Analytics
 * 6. Settings & Security (Users & Roles, Company Configuration, Audit Logs)
=======
 * Maps authorized navigation items into Petalo-styled Sidebar groups conforming to DESIGN.md §5 and MASTER PROMPT §3.
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
 */
export function getSidebarGroupsForRole(role: Role): SidebarGroup[] {
  const groups: SidebarGroup[] = [];

  const attendanceItem: SidebarItem = {
<<<<<<< HEAD
    id: 'attendance-group',
    label: 'Attendance',
    href: '/attendance',
    icon: <NavSvgIcon name="clock" />,
=======
    id: '/attendance',
    label: 'Attendance',
    href: '/attendance',
    icon: <NavSvgIcon name="calendar" />,
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
    children: [
      { id: '/attendance', label: 'On Duty', href: '/attendance' },
      { id: '/attendance/roster', label: 'Roster', href: '/attendance/roster' },
      { id: '/attendance/timesheets', label: 'Timesheets', href: '/attendance/timesheets' },
    ],
  };

<<<<<<< HEAD
  const leaveManagementItem: SidebarItem = {
    id: 'leave-group',
    label: 'Leave',
    href: '/leave',
    icon: <NavSvgIcon name="calendar" />,
    children: [
      { id: '/leave', label: 'Leave Requests', href: '/leave' },
      { id: '/leave/calendar', label: 'Leave Calendar', href: '/leave/calendar' },
    ],
  };

  if (role === ROLES.ADMIN) {
    // 1. Workforce (Concise visible top-level modules)
    groups.push({
      id: 'admin-workforce',
      label: 'Workforce',
=======
  if (role === ROLES.ADMIN) {
    // 1. WORKSPACE
    groups.push({
      id: 'admin-workspace',
      label: 'Workspace',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
      items: [
        {
          id: '/dashboard',
          label: 'Overview',
          href: '/dashboard',
          icon: <NavSvgIcon name="home" />,
        },
<<<<<<< HEAD
        {
          id: '/admin/employees',
          label: 'Employee Directory',
          href: '/admin/employees',
          icon: <NavSvgIcon name="users" />,
        },
        attendanceItem,
        leaveManagementItem,
        {
          id: '/approvals',
          label: 'Approvals',
          href: '/approvals',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/tasks',
          label: 'Tasks',
          href: '/tasks',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/projects',
          label: 'Projects',
          href: '/projects',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/meetings',
          label: 'Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="calendar" />,
        },
        {
          id: '/expenses',
          label: 'Expenses',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
        },
        {
          id: '/admin/reports',
          label: 'Reports',
          href: '/admin/reports',
          icon: <NavSvgIcon name="file-text" />,
=======
        attendanceItem,
        {
          id: '/leave',
          label: 'Leave Management',
          href: '/leave',
          icon: <NavSvgIcon name="calendar" />,
          children: [
            { id: '/leave', label: 'Leave Requests', href: '/leave' },
            { id: '/leave/holidays', label: 'Leave Calendar', href: '/leave/holidays' },
          ],
        },
        {
          id: '/tasks',
          label: 'Tasks & Projects',
          href: '/tasks',
          icon: <NavSvgIcon name="check" />,
          children: [
            { id: '/tasks', label: 'Tasks', href: '/tasks' },
            { id: '/projects', label: 'Projects', href: '/projects' },
          ],
        },
        {
          id: '/meetings',
          label: 'Calendar & Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="clock" />,
        },
        {
          id: '/expenses',
          label: 'Expenses & Claims',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        },
      ],
    });

<<<<<<< HEAD
    // 2. Administration
    groups.push({
=======
    // 2. PEOPLE MANAGEMENT
    groups.push({
      id: 'admin-people',
      label: 'People Management',
      items: [
        {
          id: '/admin/employees',
          label: 'Employee Directory',
          href: '/admin/employees',
          icon: <NavSvgIcon name="users" />,
        },
        {
          id: '/onboarding',
          label: 'Onboarding',
          href: '/onboarding',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/admin/departments',
          label: 'Departments',
          href: '/admin/departments',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/admin/designations',
          label: 'Designations',
          href: '/admin/designations',
          icon: <NavSvgIcon name="file-text" />,
        },
        {
          id: '/admin/org-chart',
          label: 'Reporting Hierarchy',
          href: '/admin/org-chart',
          icon: <NavSvgIcon name="users" />,
        },
      ],
    });

    // 3. MANAGEMENT
    groups.push({
      id: 'admin-management',
      label: 'Management',
      items: [
        {
          id: '/approvals',
          label: 'Approvals',
          href: '/approvals',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/admin/reports',
          label: 'Company Reports',
          href: '/admin/reports',
          icon: <NavSvgIcon name="file-text" />,
        },
      ],
    });

    // 4. ADMINISTRATION
    groups.push({
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
      id: 'admin-administration',
      label: 'Administration',
      items: [
        {
          id: '/admin/users',
          label: 'Users & Roles',
          href: '/admin/users',
          icon: <NavSvgIcon name="users" />,
        },
        {
<<<<<<< HEAD
          id: 'admin-organization',
          label: 'Organization',
          icon: <NavSvgIcon name="briefcase" />,
          children: [
            { id: '/onboarding', label: 'Onboarding', href: '/onboarding' },
            { id: '/admin/departments', label: 'Departments', href: '/admin/departments' },
            { id: '/admin/designations', label: 'Designations', href: '/admin/designations' },
            { id: '/admin/org-chart', label: 'Org Chart', href: '/admin/org-chart' },
          ],
        },
        {
          id: 'admin-policies',
          label: 'Policies',
          icon: <NavSvgIcon name="clock" />,
          children: [
            { id: '/shifts', label: 'Attendance Policies', href: '/shifts' },
            { id: '/leave/policies', label: 'Leave Policies', href: '/leave/policies' },
          ],
        },
        {
          id: '/admin/settings',
          label: 'Settings',
=======
          id: '/shifts',
          label: 'Attendance Policies',
          href: '/shifts',
          icon: <NavSvgIcon name="clock" />,
        },
        {
          id: '/leave/policies',
          label: 'Leave Policies',
          href: '/leave/policies',
          icon: <NavSvgIcon name="calendar" />,
        },
        {
          id: '/admin/settings',
          label: 'Company Config',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
          href: '/admin/settings',
          icon: <NavSvgIcon name="settings" />,
        },
        {
          id: '/admin/audit',
          label: 'Audit Logs',
          href: '/admin/audit',
          icon: <NavSvgIcon name="shield" />,
        },
      ],
    });
  } else if (role === ROLES.HR_MANAGER) {
<<<<<<< HEAD
    groups.push({
      id: 'hr-workforce',
      label: 'Workforce',
=======
    // HR Manager Groups
    groups.push({
      id: 'hr-workspace',
      label: 'Workspace',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
      items: [
        {
          id: '/dashboard',
          label: 'Overview',
          href: '/dashboard',
          icon: <NavSvgIcon name="home" />,
        },
<<<<<<< HEAD
=======
        attendanceItem,
        {
          id: '/leave',
          label: 'Leave Requests',
          href: '/leave',
          icon: <NavSvgIcon name="calendar" />,
        },
        {
          id: '/tasks',
          label: 'Tasks & Projects',
          href: '/tasks',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/meetings',
          label: 'Calendar & Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="clock" />,
        },
        {
          id: '/expenses',
          label: 'Expenses',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
        },
      ],
    });

    groups.push({
      id: 'hr-people',
      label: 'People & Organization',
      items: [
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        {
          id: '/hr/employees',
          label: 'Employee Directory',
          href: '/hr/employees',
          icon: <NavSvgIcon name="users" />,
        },
        {
          id: '/hr/lifecycle',
<<<<<<< HEAD
          label: 'Onboarding',
          href: '/hr/lifecycle',
          icon: <NavSvgIcon name="briefcase" />,
        },
        attendanceItem,
        leaveManagementItem,
=======
          label: 'Onboarding / Offboarding',
          href: '/hr/lifecycle',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/hr/departments',
          label: 'Departments',
          href: '/hr/departments',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/hr/designations',
          label: 'Designations',
          href: '/hr/designations',
          icon: <NavSvgIcon name="file-text" />,
        },
        {
          id: '/hr/org-chart',
          label: 'Reporting Hierarchy',
          href: '/hr/org-chart',
          icon: <NavSvgIcon name="users" />,
        },
      ],
    });

    groups.push({
      id: 'hr-management',
      label: 'Management',
      items: [
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        {
          id: '/approvals',
          label: 'Approvals',
          href: '/approvals',
          icon: <NavSvgIcon name="check" />,
        },
        {
<<<<<<< HEAD
          id: '/tasks',
          label: 'Tasks',
          href: '/tasks',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/projects',
          label: 'Projects',
          href: '/projects',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/meetings',
          label: 'Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="calendar" />,
        },
        {
          id: '/expenses',
          label: 'Expenses',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
        },
        {
          id: '/hr/reports',
          label: 'Reports',
=======
          id: '/hr/reports',
          label: 'HR Reports',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
          href: '/hr/reports',
          icon: <NavSvgIcon name="file-text" />,
        },
      ],
    });

    groups.push({
      id: 'hr-administration',
      label: 'Administration',
      items: [
        {
<<<<<<< HEAD
          id: 'hr-organization',
          label: 'Organization',
          icon: <NavSvgIcon name="briefcase" />,
          children: [
            { id: '/hr/departments', label: 'Departments', href: '/hr/departments' },
            { id: '/hr/designations', label: 'Designations', href: '/hr/designations' },
            { id: '/hr/org-chart', label: 'Org Chart', href: '/hr/org-chart' },
          ],
        },
        {
          id: 'hr-policies',
          label: 'Policies',
          icon: <NavSvgIcon name="clock" />,
          children: [
            { id: '/hr/policies', label: 'Attendance Policies', href: '/hr/policies' },
            { id: '/leave/policies', label: 'Leave Policies', href: '/leave/policies' },
          ],
=======
          id: '/hr/policies',
          label: 'Leave & Shift Policies',
          href: '/hr/policies',
          icon: <NavSvgIcon name="calendar" />,
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        },
      ],
    });
  } else if (role === ROLES.TEAM_LEAD) {
<<<<<<< HEAD
    groups.push({
      id: 'lead-workforce',
      label: 'Workforce',
=======
    // Team Lead Groups
    groups.push({
      id: 'lead-workspace',
      label: 'Workspace',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
      items: [
        {
          id: '/dashboard',
          label: 'Overview',
          href: '/dashboard',
          icon: <NavSvgIcon name="home" />,
        },
        {
          id: '/lead/team',
          label: 'Team Directory',
          href: '/lead/team',
          icon: <NavSvgIcon name="users" />,
        },
        attendanceItem,
<<<<<<< HEAD
        leaveManagementItem,
        {
          id: '/lead/approvals',
          label: 'Approvals',
          href: '/lead/approvals',
          icon: <NavSvgIcon name="check" />,
          count: 2,
          countTone: 'attention',
        },
        {
          id: '/lead/tasks',
          label: 'Tasks',
=======
        {
          id: '/lead/tasks',
          label: 'Team Tasks',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
          href: '/lead/tasks',
          icon: <NavSvgIcon name="check" />,
        },
        {
          id: '/projects',
          label: 'Projects',
          href: '/projects',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/meetings',
<<<<<<< HEAD
          label: 'Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="calendar" />,
=======
          label: 'Calendar & Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="clock" />,
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        },
        {
          id: '/expenses',
          label: 'Expenses',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
        },
<<<<<<< HEAD
        {
          id: '/lead/reports',
          label: 'Reports',
=======
      ],
    });

    groups.push({
      id: 'lead-management',
      label: 'Team Operations',
      items: [
        {
          id: '/lead/approvals',
          label: 'Leave Approvals',
          href: '/lead/approvals',
          icon: <NavSvgIcon name="check" />,
          count: 2,
          countTone: 'attention',
        },
        {
          id: '/lead/reports',
          label: 'Team Reports',
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
          href: '/lead/reports',
          icon: <NavSvgIcon name="file-text" />,
        },
      ],
    });
  } else {
<<<<<<< HEAD
    // Staff / Employee Self-Service Workspace
=======
    // Staff Groups
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
    groups.push({
      id: 'staff-workspace',
      label: 'My Workspace',
      items: [
        {
          id: '/dashboard',
          label: 'Overview',
          href: '/dashboard',
          icon: <NavSvgIcon name="home" />,
        },
        {
          id: '/profile',
          label: 'My Profile',
          href: '/profile',
          icon: <NavSvgIcon name="user" />,
        },
        {
          id: '/staff/attendance',
          label: 'Check-In / Check-Out',
          href: '/staff/attendance',
          icon: <NavSvgIcon name="clock" />,
        },
        {
          id: '/staff/leave',
          label: 'My Leave',
          href: '/staff/leave',
          icon: <NavSvgIcon name="calendar" />,
        },
        {
          id: '/staff/tasks',
          label: 'My Tasks',
          href: '/staff/tasks',
          icon: <NavSvgIcon name="check" />,
        },
        {
<<<<<<< HEAD
          id: '/projects',
          label: 'Projects',
          href: '/projects',
          icon: <NavSvgIcon name="briefcase" />,
        },
        {
          id: '/meetings',
          label: 'Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="calendar" />,
=======
          id: '/meetings',
          label: 'Calendar & Meetings',
          href: '/meetings',
          icon: <NavSvgIcon name="clock" />,
>>>>>>> 010aed118b9fd3e192272912cefe1b071d362820
        },
        {
          id: '/expenses',
          label: 'Expenses',
          href: '/expenses',
          icon: <NavSvgIcon name="file-text" />,
        },
        {
          id: '/staff/payslips',
          label: 'Payslips',
          href: '/staff/payslips',
          icon: <NavSvgIcon name="file-text" />,
        },
      ],
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
