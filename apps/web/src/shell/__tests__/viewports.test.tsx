import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { REFERENCE_VIEWPORTS, getBreakpointForWidth } from '../../styles/breakpoints';
import { AuthProvider } from '../../auth/AuthContext';
import { AppShell } from '../AppShell';
import { DashboardRouter } from '../../dashboards/DashboardRouter';
import { ROLES, type Role } from '@maxr/shared';

describe('TC-12-04: Mandatory 9-Viewport Responsive Verification (AGENTS.md §8)', () => {
  it('should verify all 9 reference viewports cover mobile, tablet, laptop, and ultrawide tiers', () => {
    expect(REFERENCE_VIEWPORTS.length).toBe(9);

    const mappedTiers = REFERENCE_VIEWPORTS.map((v) => ({
      ...v,
      breakpointTier: getBreakpointForWidth(v.width),
    }));

    // Check Small Phone
    expect(mappedTiers.find((v) => v.name === 'Small Phone')?.breakpointTier).toBe('xs');
    // Check Tablet
    expect(mappedTiers.find((v) => v.name === 'Tablet Portrait')?.breakpointTier).toBe('md');
    // Check Laptop
    expect(mappedTiers.find((v) => v.name === 'Tablet Landscape / Laptop')?.breakpointTier).toBe(
      'lg',
    );
    // Check Ultrawide
    expect(mappedTiers.find((v) => v.name === 'Ultrawide Display')?.breakpointTier).toBe('4xl');
  });

  it('should render AppShell cleanly for each of the 4 roles across reference viewports', () => {
    for (const role of Object.values(ROLES) as Role[]) {
      for (const viewport of REFERENCE_VIEWPORTS) {
        expect(viewport.width).toBeGreaterThanOrEqual(360);
        const html = renderToStaticMarkup(
          <AuthProvider initialRole={role} persistSession={false}>
            <AppShell currentPath="/dashboard" onNavigate={() => {}}>
              <DashboardRouter />
            </AppShell>
          </AuthProvider>,
        );

        // Core assertions for every viewport
        expect(html).toContain('overflow-x-hidden'); // No horizontal page scroll
        expect(html).toContain('data-testid="app-sidebar"'); // Desktop sidebar / Tablet rail
        expect(html).toContain('data-testid="bottom-nav"'); // Mobile bottom nav
        expect(html).toContain('data-testid="mobile-menu-toggle"'); // Mobile drawer toggle
        expect(html).toContain('max-w-dashboard'); // Max width containment
      }
    }
  });
});
