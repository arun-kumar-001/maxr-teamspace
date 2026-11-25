// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ROLES } from '@maxr/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { DEMO_USER_EMPLOYEE_IDS } from '../lib/demo-ids';

const OWN_ID = DEMO_USER_EMPLOYEE_IDS.admin;
const OTHER_ID = 'be27a704-1dc0-478c-8616-aad576f2d1d7';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const detail = (id: string, firstName: string) => ({
  id,
  employeeCode: `E-${firstName}`,
  firstName,
  lastName: 'Tester',
  email: `${firstName.toLowerCase()}@example.test`,
  phone: null,
  department: { id: 'd', name: 'Engineering', code: 'ENG' },
  designation: { id: 'g', title: 'Engineer' },
  manager: null,
  status: 'active',
  joiningDate: '2026-01-05',
  createdAt: '2026-01-05T00:00:00Z',
  updatedAt: '2026-01-05T00:00:00Z',
  version: 1,
});

/** The app on a real URL, signed in as an admin whose employee id is OWN_ID. */
function openApp(path: string) {
  window.history.pushState({}, '', path);
  return render(<App initialRole={ROLES.ADMIN} persistSession={false} />);
}

describe('employee links and the profile route', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input).split('?')[0] ?? '';
      if (url.endsWith('/api/v1/auth/me')) {
        return json({
          data: {
            csrfToken: 'token',
            user: {
              id: 'user-1',
              role: 'admin',
              roles: ['admin'],
              name: 'Admin Tester',
              email: 'admin@example.test',
              employeeId: OWN_ID,
              permissions: [],
            },
          },
        });
      }
      if (url.endsWith(`/api/v1/employees/${OWN_ID}`)) return json({ data: detail(OWN_ID, 'Own') });
      if (url.endsWith(`/api/v1/employees/${OTHER_ID}`)) {
        return json({ data: detail(OTHER_ID, 'Other') });
      }
      return json({ data: [], meta: { total: 0 } });
    });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  const employeeRequests = () =>
    fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => /\/api\/v1\/employees\/[^/?]+(\?|$)/.test(url));

  it.each([
    ['/employees', ''],
    ['/admin/employees', ''],
    ['/hr/employees', ''],
  ])('sends %s/:id to /profile/details/:id for another employee', async (prefix) => {
    openApp(`${prefix}/${OTHER_ID}`);

    await waitFor(() => expect(window.location.pathname).toBe(`/profile/details/${OTHER_ID}`));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Other Tester/ }),
    ).toBeInTheDocument();
  });

  it('sends your own employee link to /profile/details', async () => {
    openApp(`/employees/${OWN_ID}`);

    await waitFor(() => expect(window.location.pathname).toBe('/profile/details'));
    expect(
      await screen.findByRole('heading', { level: 1, name: /Own Tester/ }),
    ).toBeInTheDocument();
  });

  it('keeps the query, so /employees/:id?edit=true still opens editing', async () => {
    openApp(`/employees/${OTHER_ID}?edit=true`);

    await waitFor(() => expect(window.location.pathname).toBe(`/profile/details/${OTHER_ID}`));
    expect(window.location.search).toBe('?edit=true');
  });

  it('opens /profile/details/:uuid directly and a refresh of that URL shows the same employee', async () => {
    openApp(`/profile/details/${OTHER_ID}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Other Tester/ }),
    ).toBeInTheDocument();
    cleanup();

    // A refresh is the same URL rendered again
    render(<App initialRole={ROLES.ADMIN} persistSession={false} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Other Tester/ }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/profile/details/${OTHER_ID}`);
  });

  it('shows Employee Not Found, without asking the server, for an id that is not a UUID', async () => {
    openApp('/profile/details/emp-4');

    expect(await screen.findByTestId('employee-detail-not-found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Employee Not Found' })).toBeInTheDocument();
    expect(employeeRequests()).toEqual([]);
  });

  it('treats an old /employees/emp-4 link the same way', async () => {
    openApp('/employees/emp-4');

    await waitFor(() => expect(window.location.pathname).toBe('/profile/details/emp-4'));
    expect(await screen.findByTestId('employee-detail-not-found')).toBeInTheDocument();
    expect(employeeRequests()).toEqual([]);
  });
});
