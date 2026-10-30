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
});
