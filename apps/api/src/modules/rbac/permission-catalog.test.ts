import { RECORD_SCOPES, ROLES, type RecordScope, type Role } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOG,
  PERMISSION_KEYS,
  PermissionKey,
  grantFor,
  isPermissionKey,
} from './permission-catalog';

const { ADMIN, HR_MANAGER, TEAM_LEAD, STAFF } = ROLES;

describe('permission catalog', () => {
  it('uses module.action keys, each with a description', () => {
    for (const key of PERMISSION_KEYS) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(PERMISSION_CATALOG[key].description.length).toBeGreaterThan(5);
    }
  });

  it('every grant uses a known role and scope', () => {
    const roles = new Set<string>(Object.values(ROLES));
    const scopes = new Set<string>(Object.values(RECORD_SCOPES));
    for (const key of PERMISSION_KEYS) {
      for (const [role, scope] of Object.entries(PERMISSION_CATALOG[key].grants)) {
        expect(roles.has(role), `${key}: role ${role}`).toBe(true);
        expect(scopes.has(scope as string), `${key}: scope ${scope}`).toBe(true);
      }
    }
  });

  it('Admin holds every permission (company-wide control)', () => {
    for (const key of PERMISSION_KEYS) {
      expect(grantFor(ADMIN, key), key).not.toBeNull();
    }
  });

  it('no role other than Admin reaches security or audit permissions', () => {
    const adminOnly: PermissionKey[] = [
      'users.create',
      'users.update',
      'users.deactivate',
      'roles.list',
      'permissions.list',
      'audit_logs.list',
      'employees.deactivate',
    ];
    for (const key of adminOnly) {
      for (const role of [HR_MANAGER, TEAM_LEAD, STAFF]) {
        expect(grantFor(role, key), `${role} ${key}`).toBeNull();
      }
    }
  });

  it('knows which strings are catalog keys', () => {
    expect(isPermissionKey('employees.read')).toBe(true);
    expect(isPermissionKey('employees.fly')).toBe(false);
    expect(isPermissionKey('constructor')).toBe(false);
  });
});

/**
 * The role matrix (docs/requirements/role-permission-matrix.md §2) as data.
 * Rows are a permission; a missing role means the role is denied. Matrix cells that are still
 * undecided (◐) are deliberately not asserted: they follow the decisions log.
 */
const MATRIX: Array<[PermissionKey, Partial<Record<Role, RecordScope>>]> = [
  ['employees.create', { admin: 'all', hr_manager: 'hr' }],
  ['employees.list', { admin: 'all', hr_manager: 'hr', team_lead: 'team' }],
  ['employees.read', { admin: 'all', hr_manager: 'hr', team_lead: 'team', staff: 'own' }],
  ['employees.update', { admin: 'all', hr_manager: 'hr' }],
  ['employees.deactivate', { admin: 'all' }],
  ['attendance.check_in', { admin: 'own', hr_manager: 'own', team_lead: 'own', staff: 'own' }],
  ['attendance.read_team', { admin: 'all', team_lead: 'team' }],
  ['attendance.approve_correction', { admin: 'all', hr_manager: 'hr', team_lead: 'team' }],
  ['leave.apply', { admin: 'own', hr_manager: 'own', team_lead: 'own', staff: 'own' }],
  ['leave.read_team', { admin: 'all', team_lead: 'team' }],
  ['leave.approve', { admin: 'all', hr_manager: 'hr', team_lead: 'team' }],
  ['tasks.create', { admin: 'all', team_lead: 'team' }],
  ['tasks.update_status', { admin: 'all', hr_manager: 'own', team_lead: 'team', staff: 'own' }],
  ['audit_logs.list', { admin: 'all' }],
  ['users.assign_role', { admin: 'all', hr_manager: 'hr' }],
];

describe.each(MATRIX)('role matrix: %s', (key, expected) => {
  it.each(Object.values(ROLES))('%s', (role) => {
    expect(grantFor(role, key)).toBe(expected[role] ?? null);
  });
});
