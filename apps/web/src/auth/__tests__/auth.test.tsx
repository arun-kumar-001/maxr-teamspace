import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthProvider, useAuth } from '../AuthContext';
import { LoginPage } from '../LoginPage';
import { MOCK_USERS } from '../mockUsers';
import { ROLES, type Role } from '@maxr/shared';

function TestAuthConsumer() {
  const { user, role, isAuthenticated } = useAuth();
  return (
    <div data-testid="auth-state">
      <span data-testid="user-role">{role}</span>
      <span data-testid="user-name">{user?.name}</span>
      <span data-testid="is-auth">{isAuthenticated ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('TC-12-01: AuthContext & LoginPage Session Management', () => {
  it('should initialize with provided initialRole', () => {
    const html = renderToStaticMarkup(
      <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
        <TestAuthConsumer />
      </AuthProvider>,
    );

    expect(html).toContain('data-testid="auth-state"');
    expect(html).toContain('admin');
    expect(html).toContain(MOCK_USERS[ROLES.ADMIN].name);
    expect(html).toContain('yes');
  });

  it('should seed valid mock users for all 4 canonical roles', () => {
    Object.values(ROLES).forEach((r: Role) => {
      const mock = MOCK_USERS[r];
      expect(mock).toBeDefined();
      expect(mock.role).toBe(r);
      expect(mock.email).toContain('@maxr.com');
      expect(mock.avatarInitials.length).toBe(2);
    });
  });

  it('should render LoginPage with form inputs and quick role switcher', () => {
    const html = renderToStaticMarkup(
      <AuthProvider persistSession={false}>
        <LoginPage />
      </AuthProvider>,
    );

    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('Work Email');
    expect(html).toContain('Password');
    expect(html).toContain('Sign In to Teamspace');
    // Quick role switcher buttons
    expect(html).toContain('data-testid="quick-login-admin"');
    expect(html).toContain('data-testid="quick-login-hr_manager"');
    expect(html).toContain('data-testid="quick-login-team_lead"');
    expect(html).toContain('data-testid="quick-login-staff"');
  });
});
