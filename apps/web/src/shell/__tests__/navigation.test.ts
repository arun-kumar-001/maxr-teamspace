import { describe, it, expect } from 'vitest';
import { getNavItemsForRole, isPathAuthorizedForRole, NAVIGATION_REGISTRY } from '../navigation';
import { ROLES, type Role } from '@maxr/shared';

describe('TC-12-02: Role-Based Navigation Registry & Route Isolation', () => {
  it('should define navigation items strictly across canonical roles', () => {
    expect(NAVIGATION_REGISTRY.length).toBeGreaterThan(0);
    const validRoles = Object.values(ROLES);
    for (const item of NAVIGATION_REGISTRY) {
      expect(item.allowedRoles.length).toBeGreaterThan(0);
      for (const r of item.allowedRoles) {
        expect(validRoles.includes(r)).toBe(true);
      }
    }
  });

  it('should isolate Admin navigation items without leakage', () => {
    const adminItems = getNavItemsForRole(ROLES.ADMIN);
    const adminPaths = adminItems.map((i) => i.path);

    expect(adminPaths).toContain('/dashboard');
    expect(adminPaths).toContain('/admin/users');
    expect(adminPaths).toContain('/admin/employees');
    expect(adminPaths).toContain('/admin/departments');
    expect(adminPaths).toContain('/admin/designations');
    expect(adminPaths).toContain('/admin/audit');
    expect(adminPaths).toContain('/admin/settings');
    expect(adminPaths).toContain('/profile');

    // Must NOT contain HR, Lead, or Staff specific paths
    expect(adminPaths).not.toContain('/hr/employees');
    expect(adminPaths).not.toContain('/hr/departments');
    expect(adminPaths).not.toContain('/hr/designations');
    expect(adminPaths).not.toContain('/lead/team');
    expect(adminPaths).not.toContain('/lead/attendance');
    expect(adminPaths).not.toContain('/staff/payslips');
  });

  it('should isolate HR Manager navigation items without leakage', () => {
    const hrItems = getNavItemsForRole(ROLES.HR_MANAGER);
    const hrPaths = hrItems.map((i) => i.path);

    expect(hrPaths).toContain('/dashboard');
    expect(hrPaths).toContain('/hr/employees');
    expect(hrPaths).toContain('/hr/departments');
    expect(hrPaths).toContain('/hr/designations');
    expect(hrPaths).toContain('/hr/lifecycle');
    expect(hrPaths).toContain('/hr/policies');
    expect(hrPaths).toContain('/hr/reports');
    expect(hrPaths).toContain('/profile');

    // Must NOT contain Admin or Staff specific paths
    expect(hrPaths).not.toContain('/admin/users');
    expect(hrPaths).not.toContain('/admin/departments');
    expect(hrPaths).not.toContain('/admin/designations');
    expect(hrPaths).not.toContain('/staff/payslips');
    expect(hrPaths).not.toContain('/lead/approvals');
  });

  it('should isolate Team Lead navigation items without leakage', () => {
    const leadItems = getNavItemsForRole(ROLES.TEAM_LEAD);
    const leadPaths = leadItems.map((i) => i.path);

    expect(leadPaths).toContain('/dashboard');
    expect(leadPaths).toContain('/lead/team');
    expect(leadPaths).toContain('/lead/attendance');
    expect(leadPaths).toContain('/lead/approvals');
    expect(leadPaths).toContain('/lead/tasks');
    expect(leadPaths).toContain('/lead/reports');
    expect(leadPaths).toContain('/profile');

    // Must NOT contain Admin or HR specific paths
    expect(leadPaths).not.toContain('/admin/users');
    expect(leadPaths).not.toContain('/admin/employees');
    expect(leadPaths).not.toContain('/admin/departments');
    expect(leadPaths).not.toContain('/admin/designations');
    expect(leadPaths).not.toContain('/hr/employees');
    expect(leadPaths).not.toContain('/hr/departments');
    expect(leadPaths).not.toContain('/hr/designations');
  });

  it('should isolate Staff navigation items without leakage', () => {
    const staffItems = getNavItemsForRole(ROLES.STAFF);
    const staffPaths = staffItems.map((i) => i.path);

    expect(staffPaths).toContain('/dashboard');
    expect(staffPaths).toContain('/profile');
    expect(staffPaths).toContain('/staff/attendance');
    expect(staffPaths).toContain('/staff/leave');
    expect(staffPaths).toContain('/staff/tasks');
    expect(staffPaths).toContain('/staff/payslips');

    // Staff must never see Admin or HR management tools
    expect(staffPaths).not.toContain('/admin/users');
    expect(staffPaths).not.toContain('/admin/employees');
    expect(staffPaths).not.toContain('/admin/departments');
    expect(staffPaths).not.toContain('/admin/designations');
    expect(staffPaths).not.toContain('/admin/audit');
    expect(staffPaths).not.toContain('/hr/employees');
    expect(staffPaths).not.toContain('/hr/departments');
    expect(staffPaths).not.toContain('/hr/designations');
    expect(staffPaths).not.toContain('/lead/team');
    expect(staffPaths).not.toContain('/lead/approvals');
  });

  describe('isPathAuthorizedForRole checks', () => {
    it('should allow common routes for any role', () => {
      Object.values(ROLES).forEach((r: Role) => {
        expect(isPathAuthorizedForRole('/', r)).toBe(true);
        expect(isPathAuthorizedForRole('/dashboard', r)).toBe(true);
        expect(isPathAuthorizedForRole('/login', r)).toBe(true);
      });
    });

    it('should strictly deny unauthorized access across roles', () => {
      // Staff trying to access Admin or HR routes
      expect(isPathAuthorizedForRole('/admin/users', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/employees', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/departments', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/designations', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/audit', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/hr/employees', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/hr/departments', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/hr/designations', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/lead/team', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/lead/approvals', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/employees', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/departments', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/designations', ROLES.STAFF)).toBe(false);

      // Team Lead trying to access Admin users or departments/designations
      expect(isPathAuthorizedForRole('/admin/users', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/employees', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/departments', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/designations', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/departments', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/designations', ROLES.TEAM_LEAD)).toBe(false);
      expect(isPathAuthorizedForRole('/employees/emp-1/documents', ROLES.TEAM_LEAD)).toBe(false);

      // HR Manager trying to access Admin audit logs or deactivation
      expect(isPathAuthorizedForRole('/admin/audit', ROLES.HR_MANAGER)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/employees/emp-1/deactivate', ROLES.HR_MANAGER)).toBe(
        false,
      );
      expect(isPathAuthorizedForRole('/admin/employees/emp-1/deactivate', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/employees/emp-1/deactivate', ROLES.TEAM_LEAD)).toBe(
        false,
      );
      // HR Manager trying to access admin department or designation setup
      expect(isPathAuthorizedForRole('/admin/departments', ROLES.HR_MANAGER)).toBe(false);
      expect(isPathAuthorizedForRole('/admin/designations', ROLES.HR_MANAGER)).toBe(false);
    });

    it('should authorize legitimate role paths', () => {
      expect(isPathAuthorizedForRole('/admin/users', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/admin/employees', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/admin/employees/emp-1/deactivate', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/admin/departments', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/admin/designations', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/hr/employees', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/hr/departments', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/hr/designations', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/lead/team', ROLES.TEAM_LEAD)).toBe(true);
      expect(isPathAuthorizedForRole('/lead/approvals', ROLES.TEAM_LEAD)).toBe(true);
      expect(isPathAuthorizedForRole('/staff/payslips', ROLES.STAFF)).toBe(true);
      expect(isPathAuthorizedForRole('/employees', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/employees', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/employees', ROLES.TEAM_LEAD)).toBe(true);
      expect(isPathAuthorizedForRole('/departments', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/departments', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/designations', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/designations', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/employees/emp-1/documents', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/employees/emp-1/documents', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/staff/documents', ROLES.STAFF)).toBe(true);

      // Issue #22: All four roles are authorized to access /profile and /staff/profile
      Object.values(ROLES).forEach((role: Role) => {
        expect(isPathAuthorizedForRole('/profile', role)).toBe(true);
        expect(isPathAuthorizedForRole('/staff/profile', role)).toBe(true);
      });
    });
  });
});
