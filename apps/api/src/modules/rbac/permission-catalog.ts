import { RECORD_SCOPES, ROLES, type RecordScope, type Role } from '@maxr/shared';

/** What a role may do with a permission, and over which records. A role without an entry is denied. */
export type Grants = Partial<Record<Role, RecordScope>>;

const { OWN, TEAM, HR, ALL } = RECORD_SCOPES;
const { ADMIN, HR_MANAGER, TEAM_LEAD, STAFF } = ROLES;

const everyone = (scope: RecordScope): Grants => ({
  [ADMIN]: scope,
  [HR_MANAGER]: scope,
  [TEAM_LEAD]: scope,
  [STAFF]: scope,
});

/**
 * The single permission catalog: `module.action` -> who holds it and with which record scope
 * (docs/requirements/role-permission-matrix.md §2). Authorization is decided from this table
 * in code, so it needs no database round trip and is covered by table-driven tests.
 * The `permissions`, `role_permissions` rows are the same data for reporting and are kept in
 * step by migration 20261030000001 (a test fails if they drift).
 *
 * Keys keep the `_own` / `_team` / `_all` suffix where the module splits reads by audience;
 * the scope in the grant is what the repository filter enforces.
 */
export const PERMISSION_CATALOG = {
  'auth.login': { description: 'Authenticate user credentials', grants: everyone(OWN) },
  'auth.logout': { description: 'End active session', grants: everyone(OWN) },

  'users.create': { description: 'Create user accounts', grants: { [ADMIN]: ALL } },
  'users.list': { description: 'List user accounts', grants: { [ADMIN]: ALL, [HR_MANAGER]: HR } },
  'users.read': {
    description: 'View user account details',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'users.update': { description: 'Update user account', grants: { [ADMIN]: ALL } },
  'users.deactivate': {
    description: 'Deactivate user account and revoke sessions',
    grants: { [ADMIN]: ALL },
  },
  'users.assign_role': {
    description: 'Assign roles to user accounts',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'roles.list': { description: 'List system roles', grants: { [ADMIN]: ALL } },
  'permissions.list': { description: 'List system permissions', grants: { [ADMIN]: ALL } },
  'audit_logs.list': { description: 'View system activity audit trail', grants: { [ADMIN]: ALL } },

  'departments.list': {
    description: 'List organizational departments',
    grants: everyone(ALL),
  },
  'departments.create': {
    description: 'Create organizational department',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'departments.update': {
    description: 'Update organizational department',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'departments.deactivate': {
    description: 'Deactivate organizational department',
    grants: { [ADMIN]: ALL },
  },
  'designations.list': {
    description: 'List organizational designations',
    grants: everyone(ALL),
  },
  'designations.create': {
    description: 'Create organizational designation',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'designations.update': {
    description: 'Update organizational designation',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'designations.deactivate': {
    description: 'Deactivate organizational designation',
    grants: { [ADMIN]: ALL },
  },

  'employees.create': {
    description: 'Create new employee profile',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'employees.list': {
    description: 'List employee directory records',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR, [TEAM_LEAD]: TEAM },
  },
  'employees.read': {
    description: 'View employee profile details',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR, [TEAM_LEAD]: TEAM, [STAFF]: OWN },
  },
  'employees.update': {
    description: 'Update employee profile',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'employees.deactivate': {
    description: 'Deactivate employee profile',
    grants: { [ADMIN]: ALL },
  },

  'attendance.check_in': { description: 'Check-in to work session', grants: everyone(OWN) },
  'attendance.check_out': { description: 'Check-out of work session', grants: everyone(OWN) },
  'attendance.read_own': { description: 'View own attendance history', grants: everyone(OWN) },
  'attendance.read_team': {
    description: 'View team attendance history',
    grants: { [ADMIN]: ALL, [TEAM_LEAD]: TEAM },
  },
  'attendance.read_all': {
    description: 'View company-wide attendance history',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'attendance.approve_correction': {
    description: 'Approve attendance correction request',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR, [TEAM_LEAD]: TEAM },
  },

  'leave.apply': { description: 'Submit leave request', grants: everyone(OWN) },
  'leave.read_own': {
    description: 'View own leave requests and balance',
    grants: everyone(OWN),
  },
  'leave.read_team': {
    description: 'View team leave requests and calendar',
    grants: { [ADMIN]: ALL, [TEAM_LEAD]: TEAM },
  },
  'leave.read_all': {
    description: 'View company-wide leave records',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR },
  },
  'leave.approve': {
    description: 'Approve or reject leave request',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: HR, [TEAM_LEAD]: TEAM },
  },
  'leave.cancel': { description: 'Cancel submitted leave request', grants: everyone(OWN) },

  'tasks.create': {
    description: 'Create and assign team task',
    grants: { [ADMIN]: ALL, [TEAM_LEAD]: TEAM },
  },
  'tasks.read_own': { description: 'View own assigned tasks', grants: everyone(OWN) },
  'tasks.read_team': {
    description: 'View team task board',
    grants: { [ADMIN]: ALL, [TEAM_LEAD]: TEAM },
  },
  'tasks.update_status': {
    description: 'Update status of task',
    grants: { [ADMIN]: ALL, [HR_MANAGER]: OWN, [TEAM_LEAD]: TEAM, [STAFF]: OWN },
  },
} as const satisfies Record<string, { description: string; grants: Grants }>;

export type PermissionKey = keyof typeof PERMISSION_CATALOG;

export const PERMISSION_KEYS = Object.keys(PERMISSION_CATALOG) as PermissionKey[];

export const isPermissionKey = (value: string): value is PermissionKey =>
  Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, value);

/** The scope a single role holds for a permission, or null when the role is denied. */
export function grantFor(role: Role, key: PermissionKey): RecordScope | null {
  const grants: Grants = PERMISSION_CATALOG[key].grants;
  return grants[role] ?? null;
}

/** Permission keys any of `roles` holds, sorted. For showing or hiding UI; the server checks each request. */
export function permissionsForRoles(roles: readonly Role[]): PermissionKey[] {
  return PERMISSION_KEYS.filter((key) => roles.some((role) => grantFor(role, key) !== null)).sort();
}
