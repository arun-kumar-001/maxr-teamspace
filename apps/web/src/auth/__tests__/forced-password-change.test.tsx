// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '@maxr/shared';
import { App } from '../../App';
import { AuthContext, buildUserFromApi, type AuthContextValue } from '../AuthContext';
import { ForcedPasswordChangePage } from '../ForcedPasswordChangePage';
import type { AuthUser } from '../types';

const user: AuthUser = {
  id: 'u1',
  email: 'new.person@maxr.test',
  name: 'New Person',
  role: ROLES.STAFF,
  roles: [ROLES.STAFF],
  permissions: [],
  avatarInitials: 'NP',
  mustChangePassword: true,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('choosing your own password at first sign-in', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;
  const markPasswordChanged = vi.fn();
  const logout = vi.fn();

  const renderPage = () => {
    const value: AuthContextValue = {
      user,
      role: user.role,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout,
      switchRole: vi.fn(),
      markPasswordChanged,
    };
    return render(
      <AuthContext.Provider value={value}>
        <ForcedPasswordChangePage />
      </AuthContext.Provider>,
    );
  };
  const fill = (given: string, next: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText(/Password you were given/), {
      target: { value: given },
    });
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/Confirm new password/), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('reads the flag from the server profile', () => {
    expect(
      buildUserFromApi({ id: 'x', role: 'staff', mustChangePassword: true }).mustChangePassword,
    ).toBe(true);
    expect(buildUserFromApi({ id: 'x', role: 'staff' }).mustChangePassword).toBe(false);
  });

  it.each([
    ['too short', 'Given-pass-1', 'short', 'short', /at least 12 characters/],
    [
      'not matching',
      'Given-pass-1',
      'A-long-new-password-1',
      'A-long-new-password-2',
      /do not match/,
    ],
    ['unchanged', 'Given-password-1', 'Given-password-1', 'Given-password-1', /different/],
  ])(
    'refuses a new password that is %s, without calling the server',
    (_n, given, next, confirm, message) => {
      renderPage();
      fill(given, next, confirm);
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(markPasswordChanged).not.toHaveBeenCalled();
    },
  );

  it('sends the change to the server and opens the app once it is accepted', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    renderPage();
    fill('Given-pass-1', 'A-long-new-password-1', 'A-long-new-password-1');

    await waitFor(() => expect(markPasswordChanged).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/change-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      currentPassword: 'Given-pass-1',
      newPassword: 'A-long-new-password-1',
    });
  });

  it('shows the server’s reason and stays on the page when the change is refused', async () => {
    fetchMock.mockResolvedValue(
      json(403, { error: { code: 'FORBIDDEN', message: 'The current password is incorrect' } }),
    );
    renderPage();
    fill('Wrong-pass-1', 'A-long-new-password-1', 'A-long-new-password-1');

    expect(await screen.findByRole('alert')).toHaveTextContent('The current password is incorrect');
    expect(markPasswordChanged).not.toHaveBeenCalled();
  });

  it('lets the person sign out instead', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalled();
  });

  it('replaces the whole app for a signed-in account whose password must be changed', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('/api/v1/auth/me')
        ? json(200, {
            data: {
              csrfToken: 'csrf',
              user: {
                id: 'u1',
                email: 'new.person@maxr.test',
                role: 'staff',
                roles: ['staff'],
                permissions: [],
                firstName: 'New',
                lastName: 'Person',
                mustChangePassword: true,
              },
            },
          })
        : json(403, { error: { code: 'PASSWORD_CHANGE_REQUIRED', message: 'blocked' } }),
    );
    render(<App persistSession={false} />);

    expect(await screen.findByText('Choose your own password')).toBeInTheDocument();
    expect(screen.queryByTestId('app-sidebar')).not.toBeInTheDocument();
  });
});
