// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { LoginPage } from '../LoginPage';
import { MOCK_USERS } from '../mockUsers';
import { ROLES, type Role } from '@maxr/shared';
import { apiFetch, getCsrfToken, setCsrfToken } from '../../api/client';

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

describe('TC-12-01: AuthContext & Real API Integration', () => {
  beforeEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

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
      expect(mock.email).toMatch(/@maxr\.(com|internal)/);
      expect(mock.avatarInitials.length).toBe(2);
    });
  });

  it('should render LoginPage with work email and password inputs', () => {
    const html = renderToStaticMarkup(
      <AuthProvider persistSession={false}>
        <LoginPage />
      </AuthProvider>,
    );

    expect(html).toContain('MAXR Teamspace');
    expect(html).toContain('Work Email');
    expect(html).toContain('Password');
    expect(html).toContain('Sign In to Teamspace');
  });

  it('correctly parses real API response shape { data: { user, csrfToken } } on login', async () => {
    const mockApiResponse = {
      data: {
        user: {
          id: 'usr-12345',
          employeeId: 'emp-67890',
          email: 'admin@maxr.internal',
          firstName: 'Sarah',
          lastName: 'Connor',
          role: 'admin',
          roles: ['admin'],
          permissions: ['users.list', 'employees.read'],
        },
        csrfToken: 'csrf-secret-token-xyz',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/auth/me')) {
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        } as Response;
      }
      if (url.includes('/api/v1/auth/login')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockApiResponse,
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider persistSession={false}>{children}</AuthProvider>,
    });

    let success = false;
    await act(async () => {
      success = await result.current.login('admin@maxr.internal', 'Password123!');
    });

    expect(success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('admin');
    expect(result.current.user?.name).toBe('Sarah Connor');
    expect(result.current.user?.permissions).toEqual(['users.list', 'employees.read']);
    expect(getCsrfToken()).toBe('csrf-secret-token-xyz');
  });

  it('apiFetch automatically attaches in-memory X-CSRF-Token on state-changing requests', async () => {
    setCsrfToken('csrf-token-12345');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 204,
    } as Response);

    await apiFetch('/api/v1/auth/logout', { method: 'POST' });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    );

    const callArgs = fetchSpy.mock.calls[0];
    const callHeaders = callArgs?.[1]?.headers as Headers | undefined;
    expect(callHeaders?.get('X-CSRF-Token')).toBe('csrf-token-12345');
  });
});
