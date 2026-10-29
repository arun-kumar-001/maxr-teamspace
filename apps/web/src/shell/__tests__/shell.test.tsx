import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../../auth/AuthContext';
import { Header } from '../Header';
import { Sidebar } from '../Sidebar';
import { MobileNav } from '../MobileNav';
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
      expect(html).toContain('SC'); // Sarah Connor
      expect(html).toContain('Sign Out');
      expect(html).toContain('data-testid="mobile-menu-toggle"');
    });
  });

  describe('Sidebar Component', () => {
    it('should render brand logo, role navigation, and dev role switcher', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <Sidebar currentPath="/dashboard" onNavigate={() => {}} />
        </AuthProvider>,
      );

      expect(html).toContain('data-testid="app-sidebar"');
      expect(html).toContain('MAXR Teamspace');
      // Staff items
      expect(html).toContain('My Profile');
      expect(html).toContain('Check-In / Check-Out');
      expect(html).toContain('My Leave');
      expect(html).toContain('My Tasks');
      expect(html).toContain('Payslips');
      // Role switcher buttons
      expect(html).toContain('data-testid="sidebar-role-admin"');
      expect(html).toContain('data-testid="sidebar-role-staff"');
    });

    it('should highlight active navigation item', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <Sidebar currentPath="/staff/leave" onNavigate={() => {}} />
        </AuthProvider>,
      );

      expect(html).toContain('bg-teal-500'); // active teal background
      expect(html).toContain('data-testid="nav-item-staff-leave"');
    });
  });

  describe('MobileNav Component', () => {
    it('should render bottom navigation bar for mobile viewports', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <MobileNav
            isOpen={false}
            onClose={() => {}}
            currentPath="/dashboard"
            onNavigate={() => {}}
          />
        </AuthProvider>,
      );

      expect(html).toContain('data-testid="bottom-nav"');
      expect(html).toContain('Overview');
      expect(html).not.toContain('data-testid="mobile-drawer"');
    });

    it('should render mobile drawer dialog when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <MobileNav
            isOpen={true}
            onClose={() => {}}
            currentPath="/dashboard"
            onNavigate={() => {}}
          />
        </AuthProvider>,
      );

      expect(html).toContain('data-testid="mobile-drawer"');
      expect(html).toContain('Employee Directory');
      expect(html).toContain('Onboarding / Offboarding');
    });
  });

  describe('AppShell Component', () => {
    it('should wrap sidebar, header, and children inside overflow-x-hidden shell', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <AppShell currentPath="/dashboard" onNavigate={() => {}}>
            <div data-testid="dashboard-content">Dashboard Metrics</div>
          </AppShell>
        </AuthProvider>,
      );

      expect(html).toContain('data-testid="app-sidebar"');
      expect(html).toContain('data-testid="dashboard-content"');
      expect(html).toContain('overflow-x-hidden');
    });
  });
});
