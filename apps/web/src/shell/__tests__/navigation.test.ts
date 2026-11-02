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
    expect(adminPaths).toContain('/admin/audit');
    expect(adminPaths).toContain('/admin/settings');

    // Must NOT contain HR, Lead, or Staff specific paths
    expect(adminPaths).not.toContain('/hr/employees');
    expect(adminPaths).not.toContain('/lead/attendance');
    expect(adminPaths).not.toContain('/staff/payslips');
  });

  it('should isolate HR Manager navigation items without leakage', () => {
    const hrItems = getNavItemsForRole(ROLES.HR_MANAGER);
    const hrPaths = hrItems.map((i) => i.path);

    expect(hrPaths).toContain('/dashboard');
    expect(hrPaths).toContain('/hr/employees');
    expect(hrPaths).toContain('/hr/lifecycle');
    expect(hrPaths).toContain('/hr/policies');
    expect(hrPaths).toContain('/hr/reports');

    // Must NOT contain Admin or Staff specific paths
    expect(hrPaths).not.toContain('/admin/users');
    expect(hrPaths).not.toContain('/staff/payslips');
    expect(hrPaths).not.toContain('/lead/approvals');
  });

  it('should isolate Team Lead navigation items without leakage', () => {
    const leadItems = getNavItemsForRole(ROLES.TEAM_LEAD);
    const leadPaths = leadItems.map((i) => i.path);

    expect(leadPaths).toContain('/dashboard');
    expect(leadPaths).toContain('/lead/attendance');
    expect(leadPaths).toContain('/lead/approvals');
    expect(leadPaths).toContain('/lead/tasks');
    expect(leadPaths).toContain('/lead/reports');

    // Must NOT contain Admin or HR specific paths
    expect(leadPaths).not.toContain('/admin/users');
    expect(leadPaths).not.toContain('/hr/employees');
  });

  it('should isolate Staff navigation items without leakage', () => {
    const staffItems = getNavItemsForRole(ROLES.STAFF);
    const staffPaths = staffItems.map((i) => i.path);

    expect(staffPaths).toContain('/dashboard');
    expect(staffPaths).toContain('/staff/profile');
    expect(staffPaths).toContain('/staff/attendance');
    expect(staffPaths).toContain('/staff/leave');
    expect(staffPaths).toContain('/staff/tasks');
    expect(staffPaths).toContain('/staff/payslips');

    // Staff must never see Admin or HR management tools
    expect(staffPaths).not.toContain('/admin/users');
    expect(staffPaths).not.toContain('/admin/audit');
    expect(staffPaths).not.toContain('/hr/employees');
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
      expect(isPathAuthorizedForRole('/admin/audit', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/hr/employees', ROLES.STAFF)).toBe(false);
      expect(isPathAuthorizedForRole('/lead/approvals', ROLES.STAFF)).toBe(false);

      // Team Lead trying to access Admin users
      expect(isPathAuthorizedForRole('/admin/users', ROLES.TEAM_LEAD)).toBe(false);

      // HR Manager trying to access Admin audit logs
      expect(isPathAuthorizedForRole('/admin/audit', ROLES.HR_MANAGER)).toBe(false);
    });

    it('should authorize legitimate role paths', () => {
      expect(isPathAuthorizedForRole('/admin/users', ROLES.ADMIN)).toBe(true);
      expect(isPathAuthorizedForRole('/hr/employees', ROLES.HR_MANAGER)).toBe(true);
      expect(isPathAuthorizedForRole('/lead/approvals', ROLES.TEAM_LEAD)).toBe(true);
      expect(isPathAuthorizedForRole('/staff/payslips', ROLES.STAFF)).toBe(true);
    });
  });
});
