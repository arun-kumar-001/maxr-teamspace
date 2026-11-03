import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../../auth/AuthContext';
import { RouteGuard } from '../RouteGuard';
import { ROLES } from '@maxr/shared';

describe('TC-12-03: RouteGuard Access Control & Forbidden State', () => {
  it('should render children when user role is authorized for the route', () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <RouteGuard currentPath="/admin/users" onNavigate={() => {}}>
          <div data-testid="authorized-content">Admin User Management Area</div>
        </RouteGuard>
      </AuthProvider>,
    );

    expect(html).toContain('data-testid="authorized-content"');
    expect(html).toContain('Admin User Management Area');
    expect(html).not.toContain('Access Denied');
  });

  it('should render ForbiddenState (Access Denied) when staff tries to access /admin/users', () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
        <RouteGuard currentPath="/admin/users" onNavigate={() => {}}>
          <div data-testid="authorized-content">Admin Secret</div>
        </RouteGuard>
      </AuthProvider>,
    );

    expect(html).toContain('data-testid="forbidden-route-container"');
    expect(html).toContain('Access Denied');
    expect(html).toContain(
      'Your role (staff) is not authorized to view the requested resource: /admin/users',
    );
    expect(html).toContain('Back to Dashboard');
    expect(html).not.toContain('data-testid="authorized-content"');
  });

  it('should render ForbiddenState when Team Lead attempts to view HR employee lifecycle', () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
        <RouteGuard currentPath="/hr/lifecycle" onNavigate={() => {}}>
          <div>HR Confidential</div>
        </RouteGuard>
      </AuthProvider>,
    );

    expect(html).toContain('Access Denied');
    expect(html).toContain('team_lead');
    expect(html).not.toContain('HR Confidential');
  });

  it('should render dashboard for staff on /dashboard', () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
        <RouteGuard currentPath="/dashboard" onNavigate={() => {}}>
          <div data-testid="staff-view">Welcome Staff</div>
        </RouteGuard>
      </AuthProvider>,
    );

    expect(html).toContain('Welcome Staff');
    expect(html).not.toContain('Access Denied');
  });

  describe('Employee Directory (/employees) access control (Issue #19)', () => {
    it('authorizes Admin, HR Manager, and Team Lead to view /employees', () => {
      const allowedRoles = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD];
      for (const role of allowedRoles) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/employees" onNavigate={() => {}}>
              <div data-testid="directory-content">Employee Directory</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="directory-content"');
        expect(html).not.toContain('Access Denied');
      }
    });

    it('denies Staff from accessing /employees and displays ForbiddenState', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/employees" onNavigate={() => {}}>
            <div data-testid="directory-content">Employee Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(html).toContain('data-testid="forbidden-route-container"');
      expect(html).toContain('Access Denied');
      expect(html).toContain(
        'Your role (staff) is not authorized to view the requested resource: /employees',
      );
      expect(html).not.toContain('data-testid="directory-content"');
    });

    it('authorizes Admin for /admin/employees and denies Staff', () => {
      const adminHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <RouteGuard currentPath="/admin/employees" onNavigate={() => {}}>
            <div data-testid="directory-content">Admin Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(adminHtml).toContain('data-testid="directory-content"');
      expect(adminHtml).not.toContain('Access Denied');

      const staffHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/admin/employees" onNavigate={() => {}}>
            <div data-testid="directory-content">Admin Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(staffHtml).toContain('Access Denied');
      expect(staffHtml).not.toContain('data-testid="directory-content"');
    });

    it('authorizes HR Manager for /hr/employees and denies Staff', () => {
      const hrHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <RouteGuard currentPath="/hr/employees" onNavigate={() => {}}>
            <div data-testid="directory-content">HR Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(hrHtml).toContain('data-testid="directory-content"');
      expect(hrHtml).not.toContain('Access Denied');

      const staffHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/hr/employees" onNavigate={() => {}}>
            <div data-testid="directory-content">HR Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(staffHtml).toContain('Access Denied');
      expect(staffHtml).not.toContain('data-testid="directory-content"');
    });

    it('authorizes Team Lead for /lead/team and denies Staff', () => {
      const leadHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <RouteGuard currentPath="/lead/team" onNavigate={() => {}}>
            <div data-testid="directory-content">Team Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(leadHtml).toContain('data-testid="directory-content"');
      expect(leadHtml).not.toContain('Access Denied');

      const staffHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/lead/team" onNavigate={() => {}}>
            <div data-testid="directory-content">Team Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(staffHtml).toContain('Access Denied');
      expect(staffHtml).not.toContain('data-testid="directory-content"');
    });
  });

  describe('Employee Detail (/employees/:id) access control (Issue #155)', () => {
    it('authorizes all roles (Admin, HR Manager, Team Lead, Staff) to pass RouteGuard to /employees/:id', () => {
      const allRoles = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF];
      for (const role of allRoles) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/employees/emp-101" onNavigate={() => {}}>
              <div data-testid="employee-detail-content">Employee Detail</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="employee-detail-content"');
        expect(html).not.toContain('Access Denied');
      }
    });

    it('authorizes Staff to pass RouteGuard for /employees/:id while continuing to block /employees list', () => {
      const detailHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/employees/emp-004" onNavigate={() => {}}>
            <div data-testid="employee-detail-content">My Detail</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(detailHtml).toContain('data-testid="employee-detail-content"');
      expect(detailHtml).not.toContain('Access Denied');

      const listHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/employees" onNavigate={() => {}}>
            <div data-testid="employee-detail-content">Directory</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(listHtml).toContain('Access Denied');
      expect(listHtml).not.toContain('data-testid="employee-detail-content"');
    });
  });

  describe('Departments & Designations access control (Issue #18)', () => {
    it('authorizes Admin and HR Manager to view /departments and denies Team Lead and Staff', () => {
      for (const role of [ROLES.ADMIN, ROLES.HR_MANAGER]) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/departments" onNavigate={() => {}}>
              <div data-testid="departments-content">Departments Management</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="departments-content"');
        expect(html).not.toContain('Access Denied');
      }

      for (const role of [ROLES.TEAM_LEAD, ROLES.STAFF]) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/departments" onNavigate={() => {}}>
              <div data-testid="departments-content">Departments Management</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="forbidden-route-container"');
        expect(html).toContain('Access Denied');
        expect(html).not.toContain('data-testid="departments-content"');
      }
    });

    it('authorizes Admin and HR Manager to view /designations and denies Team Lead and Staff', () => {
      for (const role of [ROLES.ADMIN, ROLES.HR_MANAGER]) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/designations" onNavigate={() => {}}>
              <div data-testid="designations-content">Designations Management</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="designations-content"');
        expect(html).not.toContain('Access Denied');
      }

      for (const role of [ROLES.TEAM_LEAD, ROLES.STAFF]) {
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <RouteGuard currentPath="/designations" onNavigate={() => {}}>
              <div data-testid="designations-content">Designations Management</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(html).toContain('data-testid="forbidden-route-container"');
        expect(html).toContain('Access Denied');
        expect(html).not.toContain('data-testid="designations-content"');
      }
    });

    it('authorizes Admin for /admin/departments and /admin/designations, denying other roles', () => {
      const adminDeptHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <RouteGuard currentPath="/admin/departments" onNavigate={() => {}}>
            <div data-testid="admin-dept">Admin Depts</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(adminDeptHtml).toContain('data-testid="admin-dept"');

      const hrDeptHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <RouteGuard currentPath="/admin/departments" onNavigate={() => {}}>
            <div data-testid="admin-dept">Admin Depts</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(hrDeptHtml).toContain('Access Denied');
      expect(hrDeptHtml).not.toContain('data-testid="admin-dept"');
    });

    it('authorizes HR Manager for /hr/departments and /hr/designations, denying other roles', () => {
      const hrDeptHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <RouteGuard currentPath="/hr/departments" onNavigate={() => {}}>
            <div data-testid="hr-dept">HR Depts</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(hrDeptHtml).toContain('data-testid="hr-dept"');

      const staffDeptHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/hr/departments" onNavigate={() => {}}>
            <div data-testid="hr-dept">HR Depts</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(staffDeptHtml).toContain('Access Denied');
      expect(staffDeptHtml).not.toContain('data-testid="hr-dept"');
    });

    it('Issue #22: authorizes all four roles for /profile and /staff/profile', () => {
      const allRoles = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF];
      for (const r of allRoles) {
        const profileHtml = renderToStaticMarkup(
          <AuthProvider initialRole={r} persistSession={false}>
            <RouteGuard currentPath="/profile" onNavigate={() => {}}>
              <div data-testid="profile-content">Profile for {r}</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(profileHtml).toContain('data-testid="profile-content"');
        expect(profileHtml).not.toContain('Access Denied');

        const staffProfileHtml = renderToStaticMarkup(
          <AuthProvider initialRole={r} persistSession={false}>
            <RouteGuard currentPath="/staff/profile" onNavigate={() => {}}>
              <div data-testid="staff-profile-content">Staff Profile for {r}</div>
            </RouteGuard>
          </AuthProvider>,
        );
        expect(staffProfileHtml).toContain('data-testid="staff-profile-content"');
        expect(staffProfileHtml).not.toContain('Access Denied');
      }
    });

    it('Issue #20: authorizes Admin and HR Manager for /employees/new, denies Team Lead and Staff', () => {
      // Admin allowed
      const adminHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <RouteGuard currentPath="/employees/new" onNavigate={() => {}}>
            <div data-testid="create-content">Create Page</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(adminHtml).toContain('data-testid="create-content"');
      expect(adminHtml).not.toContain('Access Denied');

      // HR Manager allowed
      const hrHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <RouteGuard currentPath="/employees/new" onNavigate={() => {}}>
            <div data-testid="create-content">Create Page</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(hrHtml).toContain('data-testid="create-content"');
      expect(hrHtml).not.toContain('Access Denied');

      // Team Lead denied
      const leadHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <RouteGuard currentPath="/employees/new" onNavigate={() => {}}>
            <div data-testid="create-content">Create Page</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(leadHtml).toContain('Access Denied');
      expect(leadHtml).not.toContain('data-testid="create-content"');

      // Staff denied
      const staffHtml = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <RouteGuard currentPath="/employees/new" onNavigate={() => {}}>
            <div data-testid="create-content">Create Page</div>
          </RouteGuard>
        </AuthProvider>,
      );
      expect(staffHtml).toContain('Access Denied');
      expect(staffHtml).not.toContain('data-testid="create-content"');
    });
  });
});
