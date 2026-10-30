import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider } from '../../auth/AuthContext';
import { AdminDashboard } from '../AdminDashboard';
import { HRDashboard } from '../HRDashboard';
import { TeamLeadDashboard } from '../TeamLeadDashboard';
import { StaffDashboard } from '../StaffDashboard';
import { DashboardRouter } from '../DashboardRouter';
import { ROLES } from '@maxr/shared';

describe('TC-12-05: Four Distinct Role Dashboard Shells', () => {
  describe('AdminDashboard', () => {
    it('should render system administration KPIs and audit snapshot', () => {
      const html = renderToStaticMarkup(<AdminDashboard />);

      expect(html).toContain('data-testid="admin-dashboard"');
      expect(html).toContain('System Administration Dashboard');
      expect(html).toContain('Total Users');
      expect(html).toContain('Active Sessions');
      expect(html).toContain('System Health');
      expect(html).toContain('Role Distribution');
      expect(html).toContain('Recent Security Audits');
    });
  });

  describe('HRDashboard', () => {
    it('should render headcount metrics and 4-step onboarding pipeline', () => {
      const html = renderToStaticMarkup(<HRDashboard />);

      expect(html).toContain('data-testid="hr-dashboard"');
      expect(html).toContain('HR Management Overview');
      expect(html).toContain('Total Headcount');
      expect(html).toContain('Onboarding Pipeline');
      expect(html).toContain('4-Step Onboarding Pipeline (AGENTS.md §9)');
      expect(html).toContain('Department Distribution');
    });
  });

  describe('TeamLeadDashboard', () => {
    it('should render team shift status, pending approvals, and sprint velocity', () => {
      const html = renderToStaticMarkup(<TeamLeadDashboard />);

      expect(html).toContain('data-testid="team-lead-dashboard"');
      expect(html).toContain('Engineering Team Lead Dashboard');
      expect(html).toContain('Team Size');
      expect(html).toContain('Pending Approvals');
      expect(html).toContain('Sprint Velocity');
      expect(html).toContain('Active Sprint Tasks');
      expect(html).toContain('Approve');
      expect(html).toContain('Reject');
    });
  });

  describe('StaffDashboard', () => {
    it('should render attendance session, leave balances, and payslips', () => {
      const html = renderToStaticMarkup(<StaffDashboard />);

      expect(html).toContain('data-testid="staff-dashboard"');
      expect(html).toContain('Staff Member Dashboard');
      expect(html).toContain('Attendance Session');
      expect(html).toContain('data-testid="attendance-toggle-button"');
      expect(html).toContain('My Leave Balances');
      expect(html).toContain('Annual Leave');
      expect(html).toContain('Sick Leave');
      expect(html).toContain('Recent Payslips (Read-Only)');
    });
  });

  describe('DashboardRouter', () => {
    it('should route Admin role to AdminDashboard', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <DashboardRouter />
        </AuthProvider>,
      );
      expect(html).toContain('data-testid="admin-dashboard"');
      expect(html).not.toContain('data-testid="staff-dashboard"');
    });

    it('should route HR Manager role to HRDashboard', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.HR_MANAGER} persistSession={false}>
          <DashboardRouter />
        </AuthProvider>,
      );
      expect(html).toContain('data-testid="hr-dashboard"');
      expect(html).not.toContain('data-testid="admin-dashboard"');
    });

    it('should route Team Lead role to TeamLeadDashboard', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <DashboardRouter />
        </AuthProvider>,
      );
      expect(html).toContain('data-testid="team-lead-dashboard"');
    });

    it('should route Staff role to StaffDashboard', () => {
      const html = renderToStaticMarkup(
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <DashboardRouter />
        </AuthProvider>,
      );
      expect(html).toContain('data-testid="staff-dashboard"');
    });
  });
});
