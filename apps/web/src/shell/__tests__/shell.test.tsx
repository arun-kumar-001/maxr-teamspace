import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../../auth/AuthContext';
import { Header } from '../Header';
import { AppShell } from '../AppShell';
import { ROLES } from '@maxr/shared';

describe('TC-12-04: Responsive Shell Components Rendering', () => {
  describe('Header Component', () => {
    it('should render page title, user initials, role badge, and sign out button', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <Header activePath="/admin/users" onToggleMobileNav={() => {}} />
        </AuthProvider>,
      );

      expect(html).toContain('Users &amp; Roles Administration');
      expect(html).toContain('SC'); // Sarah Connor initials
      expect(html).toContain('Sign Out');
      expect(html).toContain('data-testid="mobile-menu-toggle"');
    });
  });

  describe('AppShell Component with Floating Petalo Sidebar', () => {
    it('should render brand logo, staff navigation groups, and user card', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <AppShell currentPath="/dashboard" onNavigate={() => {}}>
            <div data-testid="dashboard-content">Dashboard Metrics</div>
          </AppShell>
        </AuthProvider>,
      );

      expect(html).toContain('data-testid="app-shell"');
      expect(html).toContain('data-testid="app-sidebar"');
      expect(html).toContain('MAXR Teamspace');
      expect(html).toContain('Staff Management');

      // Staff navigation items
      expect(html).toContain('Overview');
      expect(html).toContain('My Workspace');
      expect(html).toContain('My Profile');
      expect(html).toContain('Check-In / Check-Out');
      expect(html).toContain('My Leave');
      expect(html).toContain('My Tasks');
      expect(html).toContain('Payslips');

      // User card
      expect(html).toContain('Alex Mercer');
      expect(html).toContain('Staff');
      expect(html).toContain('AM');

      // Content
      expect(html).toContain('data-testid="dashboard-content"');
    });

    it('should render admin navigation groups for Admin role', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <AppShell currentPath="/admin/users" onNavigate={() => {}}>
            <div>Admin Panel</div>
          </AppShell>
        </AuthProvider>,
      );

      expect(html).toContain('Administration');
      expect(html).toContain('Users &amp; Roles');
      expect(html).toContain('Audit Logs');
      expect(html).toContain('Company Config');
      // Deny by default: staff-only items not leaked
      expect(html).not.toContain('My Leave');
    });

    it('should highlight active page with Petalo solid teal indicator', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <AppShell currentPath="/staff/leave" onNavigate={() => {}}>
            <div>Leave Page</div>
          </AppShell>
        </AuthProvider>,
      );

      // In Petalo design, active link has solid teal pill bg-primary text-sidebar
      expect(html).toContain('bg-primary text-sidebar');
      expect(html).toContain('href="/staff/leave"');
    });
  });
});
