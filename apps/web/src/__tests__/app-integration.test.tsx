import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../App';
import { ROLES } from '@maxr/shared';

describe('TC-12-06: Full App Integration & Routing Verification', () => {
  it('should render App cleanly for Admin', () => {
    const html = renderToStaticMarkup(<App initialRole={ROLES.ADMIN} persistSession={false} />);
    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('data-testid="admin-dashboard"');
    expect(html).toContain('data-testid="app-sidebar"');
    expect(html).toContain('data-testid="bottom-nav"');
  });

  it('should render App cleanly for HR Manager', () => {
    const html = renderToStaticMarkup(
      <App initialRole={ROLES.HR_MANAGER} persistSession={false} />,
    );
    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('data-testid="hr-dashboard"');
  });

  it('should render App cleanly for Team Lead', () => {
    const html = renderToStaticMarkup(<App initialRole={ROLES.TEAM_LEAD} persistSession={false} />);
    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('data-testid="team-lead-dashboard"');
  });

  it('should render App cleanly for Staff', () => {
    const html = renderToStaticMarkup(<App initialRole={ROLES.STAFF} persistSession={false} />);
    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('data-testid="staff-dashboard"');
  });
});
