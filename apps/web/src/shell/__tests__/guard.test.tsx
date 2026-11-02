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
});
