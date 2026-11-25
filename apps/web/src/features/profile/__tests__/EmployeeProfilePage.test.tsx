// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../../auth/AuthContext';
import * as employeePhotoApi from '../../employees/api/photo';
import * as profileApi from '../api/profileApi';
import { EmployeeProfilePage } from '../pages/EmployeeProfilePage';
import type { EmployeeDetail } from '../../employees/types';

const mockEmployeeAdminView: EmployeeDetail = {
  id: 'emp-1',
  employeeCode: 'EMP-001',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: '+91 98765 43210',
  department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-swe', title: 'Software Engineer' },
  manager: { id: 'mgr-1', firstName: 'Kavita', lastName: 'Iyer', employeeCode: 'MGR-001' },
  status: 'active',
  joiningDate: '2026-01-15',
  createdAt: '2026-01-15T09:00:00Z',
  updatedAt: '2026-01-15T09:00:00Z',
  version: 1,
  account: {
    userId: 'usr-123',
    isActive: true,
    lastLoginAt: '2026-11-01T10:00:00Z',
    roles: ['staff'],
  },
};

const mockEmployeeStaffView: EmployeeDetail = {
  ...mockEmployeeAdminView,
  id: 'emp-staff-view',
  account: undefined, // Omitted for non-HR/Admin callers
};

const mockDeactivatedEmployee: EmployeeDetail = {
  ...mockEmployeeAdminView,
  id: 'emp-deactivated',
  status: 'deactivated',
};

const mockDepartments = [
  { id: 'dept-eng', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-product', name: 'Product', code: 'PROD', isActive: true },
];

const mockDesignations = [
  {
    id: 'desig-swe',
    title: 'Software Engineer',

    departmentId: 'dept-eng',
    isActive: true,
  },
  {
    id: 'desig-pm',
    title: 'Product Manager',

    departmentId: 'dept-product',
    isActive: true,
  },
];

function renderWithProviders(
  initialRoute: string,
  userRole: 'admin' | 'hr_manager' | 'team_lead' | 'staff' = 'admin',
) {
  return render(
    <AuthProvider initialRole={userRole} persistSession={false}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/profile/details" element={<EmployeeProfilePage />} />
          <Route path="/profile/details/:id" element={<EmployeeProfilePage />} />
          <Route path="/employees" element={<div data-testid="directory-page">Directory</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('EmployeeProfilePage: the one employee profile', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method || 'GET';

      if (url.includes('/api/v1/departments')) {
        return new Response(JSON.stringify({ data: mockDepartments }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/designations')) {
        return new Response(JSON.stringify({ data: mockDesignations }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (/\/api\/v1\/employees\/[^/]+\/documents/.test(url)) {
        return new Response(JSON.stringify({ data: [], meta: { total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-1')) {
        if (method === 'PUT') {
          const body = JSON.parse(String(init?.body || '{}'));
          if (body.version !== 1) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 'CONFLICT',
                  message: 'This employee was changed by someone else. Reload and try again',
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            );
          }
          return new Response(
            JSON.stringify({
              data: {
                ...mockEmployeeAdminView,
                ...body,
                version: 2,
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ data: mockEmployeeAdminView }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-staff-view')) {
        return new Response(JSON.stringify({ data: mockEmployeeStaffView }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/emp-deactivated')) {
        return new Response(JSON.stringify({ data: mockDeactivatedEmployee }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/api/v1/employees/unknown-404')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Employee not found',
            },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/api/v1/employees/forbidden-403')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Access restricted',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const own = /\/api\/v1\/employees\/(emp-00[1-4])$/.exec(url.split('?')[0] ?? '');
      if (own) {
        const ownId = own[1] as string;
        const mayHaveAccount = ownId === 'emp-001' || ownId === 'emp-002';
        return new Response(
          JSON.stringify({
            data: {
              ...mockEmployeeAdminView,
              id: ownId,
              firstName: `Own${ownId.slice(-1)}`,
              lastName: 'Person',
              phone: ownId === 'emp-004' ? null : '+91 90000 00000',
              // Only the first user has a photo: the rest show initials
              photoUrl: ownId === 'emp-001' ? `/api/v1/employees/${ownId}/photo?v=1` : null,
              account: mayHaveAccount ? mockEmployeeAdminView.account : undefined,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({ data: mockEmployeeAdminView }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('renders employee detail header, status, and job info correctly', async () => {
    renderWithProviders('/profile/details/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // Check header information
    expect(screen.getByRole('heading', { level: 1, name: /Jane Doe/i })).toBeInTheDocument();
    // The My Profile header and the Employment card both show the code.
    expect(screen.getAllByText('EMP-001').length).toBeGreaterThan(0);
    expect(screen.getByTestId('profile-header')).toBeInTheDocument();
    // Admin and HR may change anyone's photo, so the camera is there
    expect(screen.getByTestId('upload-avatar-btn')).toBeInTheDocument();
    // Same two cards as /profile/details, with only the data the record holds.
    expect(screen.getByTestId('personal-info-card')).toBeInTheDocument();
    expect(screen.queryByText('Nick Name')).toBeNull();
    expect(screen.queryByText('Gender')).toBeNull();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/v1|Version 1/).length).toBeGreaterThan(0);

    // Check Job info tab
    expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
    expect(screen.getAllByText(/Engineering/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Software Engineer/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Kavita Iyer/i)).toBeInTheDocument();
  });

  it('shows the Account & Security card when account information is present for Admin', async () => {
    renderWithProviders('/profile/details/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // One page, no tabs: the account card sits below the profile cards.
    expect(screen.queryByRole('radio', { name: /Account & Security/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('account-info-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Account & System Access')).toBeInTheDocument();
    expect(screen.getByText('Active Login')).toBeInTheDocument();
    expect(within(screen.getByTestId('account-info-card')).getByText(/staff/i)).toBeInTheDocument();
  });

  it('hides the Account & Security card when account information is omitted for Staff', async () => {
    renderWithProviders('/profile/details/emp-staff-view', 'staff');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    // Account tab button should NOT be in the DOM
    expect(screen.queryByTestId('account-info-card')).not.toBeInTheDocument();
  });

  it('renders error state when employee is not found (404)', async () => {
    renderWithProviders('/profile/details/unknown-404', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-not-found')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Employee Not Found/i })).toBeInTheDocument();
  });

  it('renders forbidden state when access is restricted (403)', async () => {
    renderWithProviders('/profile/details/forbidden-403', 'staff');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-forbidden')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Access Restricted/i })).toBeInTheDocument();
  });

  it('does not show the previous employee while the next one loads', async () => {
    const base = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (
        String(input).includes('/api/v1/employees/emp-1') &&
        !String(input).includes('documents')
      ) {
        await gate;
      }
      return base(input, init);
    }) as typeof fetch;

    render(
      <AuthProvider initialRole="admin" persistSession={false}>
        <MemoryRouter initialEntries={['/profile/details/emp-deactivated']}>
          <Link to="/profile/details/emp-1">next employee</Link>
          <Routes>
            <Route path="/profile/details/:id" element={<EmployeeProfilePage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByTestId('deactivated-notice')).toBeInTheDocument();

    fireEvent.click(screen.getByText('next employee'));

    // The deactivated employee must be gone at once, not kept on screen until emp-1 arrives.
    expect(screen.queryByTestId('deactivated-notice')).toBeNull();
    expect(screen.getByTestId('employee-detail-loading')).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument());
    expect(screen.queryByTestId('deactivated-notice')).toBeNull();
  });

  it('renders deactivated notice banner when viewing a deactivated employee and disallows edit', async () => {
    renderWithProviders('/profile/details/emp-deactivated', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('employee-detail-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deactivated-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-employee-btn')).not.toBeInTheDocument();
  });

  it('allows Admin to edit employee details and send optimistic version', async () => {
    renderWithProviders('/profile/details/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    // Open edit modal
    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Both code and email should be editable for Admin
    expect(screen.getByTestId('edit-employee-code-input')).not.toBeDisabled();
    expect(screen.getByTestId('edit-email-input')).not.toBeDisabled();

    // Change first name
    fireEvent.change(screen.getByTestId('edit-first-name-input'), {
      target: { value: 'Janet' },
    });

    // Save changes
    const saveBtn = screen.getByTestId('save-employee-button');
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    // Modal closes on success and updates to v2
    await waitFor(() => {
      expect(screen.queryByTestId('edit-first-name-input')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Janet Doe/i })).toBeInTheDocument();
      expect(screen.getAllByText(/Version 2/).length).toBeGreaterThan(0);
    });
  });

  it('restricts employee code and email to read-only for HR Manager', async () => {
    renderWithProviders('/profile/details/emp-1', 'hr_manager');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Code and email must be read-only for HR
    expect(screen.getByTestId('edit-employee-code-input')).toBeDisabled();
    expect(screen.getByTestId('edit-email-input')).toBeDisabled();
    expect(screen.getAllByText(/Only Administrators can change/i).length).toBeGreaterThan(0);
  });

  it('handles 409 concurrency conflict by presenting a conflict banner and reload button', async () => {
    renderWithProviders('/profile/details/emp-1', 'admin');

    await waitFor(() => {
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('edit-employee-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('edit-first-name-input')).toBeInTheDocument();
    });

    // Change first name to trigger save
    fireEvent.change(screen.getByTestId('edit-first-name-input'), {
      target: { value: 'ConflictTest' },
    });

    // Mock fetch to simulate 409 Conflict on PUT
    fetchMock.mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'This employee was changed by someone else. Reload and try again',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    });

    fireEvent.click(screen.getByTestId('save-employee-button'));

    // Conflict banner should appear
    await waitFor(() => {
      expect(screen.getByTestId('conflict-alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Concurrent Update Conflict \(409\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('reload-latest-button')).toBeInTheDocument();
  });

  describe("one design for your own profile and anyone else's", () => {
    const SECTIONS = [
      'profile-header',
      'personal-info-card',
      'employment-info-card',
      'contact-bank-card',
      'employee-documents-card',
    ];

    const inOrder = (ids: string[]) =>
      ids.every((id, i) => {
        if (i === 0) return true;
        const previous = screen.getByTestId(ids[i - 1] as string);
        const current = screen.getByTestId(id);
        return Boolean(
          previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      });

    it('shows the same sections in the same order on /profile/details and /profile/details/:id', async () => {
      renderWithProviders('/profile/details', 'admin');
      await screen.findByTestId('universal-employee-profile');
      const own = [...SECTIONS.slice(0, 3), 'account-info-card', ...SECTIONS.slice(3)];
      expect(inOrder(own)).toBe(true);
      cleanup();

      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(inOrder(own)).toBe(true);
    });

    it("opens your own record at /profile/details, not somebody else's", async () => {
      renderWithProviders('/profile/details', 'admin');
      expect(
        await screen.findByRole('heading', { level: 1, name: /Own1 Person/ }),
      ).toBeInTheDocument();
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/v1/employees/emp-001')),
      ).toBe(true);
    });

    it("gives your own profile an editable phone and someone else's a plain one", async () => {
      renderWithProviders('/profile/details', 'admin');
      expect(await screen.findByRole('button', { name: /Edit Phone/i })).toBeInTheDocument();
      cleanup();

      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.queryByRole('button', { name: /Edit Phone/i })).toBeNull();
      expect(
        within(screen.getByTestId('personal-info-card')).getByText('+91 98765 43210'),
      ).toBeInTheDocument();
    });

    it('lets Admin edit, and deactivate only someone else', async () => {
      renderWithProviders('/profile/details', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
      expect(screen.getByTestId('view-org-chart-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('deactivate-employee-btn')).toBeNull();
      cleanup();

      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.getByTestId('deactivate-employee-btn')).toBeInTheDocument();
    });

    it('lets HR edit but not deactivate', async () => {
      renderWithProviders('/profile/details/emp-1', 'hr_manager');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.getByTestId('edit-employee-btn')).toBeInTheDocument();
      expect(screen.getByTestId('open-change-manager-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('deactivate-employee-btn')).toBeNull();
    });

    it("gives a team lead the org chart but no editing of someone else's record or photo", async () => {
      renderWithProviders('/profile/details/emp-1', 'team_lead');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.getByTestId('view-org-chart-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-employee-btn')).toBeNull();
      expect(screen.queryByTestId('open-change-manager-btn')).toBeNull();
      expect(screen.queryByTestId('upload-avatar-btn')).toBeNull();
    });

    it('gives staff their own phone and photo and nothing that manages the record', async () => {
      renderWithProviders('/profile/details', 'staff');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.getByRole('button', { name: /Edit Phone/i })).toBeInTheDocument();
      expect(screen.getByTestId('upload-avatar-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-employee-btn')).toBeNull();
      expect(screen.queryByTestId('view-org-chart-btn')).toBeNull();
      expect(screen.queryByTestId('deactivate-employee-btn')).toBeNull();
      expect(screen.queryByTestId('account-info-card')).toBeNull();
    });

    it('shows the photo when there is one and initials when there is not', async () => {
      renderWithProviders('/profile/details', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(
        document.querySelector('img[src="/api/v1/employees/emp-001/photo?v=1"]'),
      ).not.toBeNull();
      cleanup();

      renderWithProviders('/profile/details', 'staff');
      await screen.findByTestId('universal-employee-profile');
      expect(document.querySelector('img[src*="/photo"]')).toBeNull();
      expect(
        within(screen.getByTestId('profile-avatar-initials')).getByText('OP'),
      ).toBeInTheDocument();
    });

    it('says Not provided for what a record lacks, without breaking the layout', async () => {
      fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
        String(input).includes('/documents')
          ? new Response(JSON.stringify({ data: [] }), { status: 200 })
          : new Response(
              JSON.stringify({
                data: {
                  ...mockEmployeeAdminView,
                  phone: null,
                  manager: null,
                  joiningDate: '',
                  additionalEmails: [],
                  additionalPhones: [],
                  bloodGroup: null,
                  permanentAddress: null,
                  currentAddress: null,
                },
              }),
              { status: 200 },
            ),
      );
      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');

      expect(
        within(screen.getByTestId('personal-info-card')).getByText('Not provided'),
      ).toBeInTheDocument();
      expect(
        within(screen.getByTestId('employment-info-card')).getByText('Not provided'),
      ).toBeInTheDocument();
      expect(screen.getByText(/None \(Direct Report/)).toBeInTheDocument();
      expect(
        within(screen.getByTestId('contact-bank-card')).getAllByText('Not provided').length,
      ).toBeGreaterThan(3);
    });

    it('keeps a deactivated employee read-only for everyone, including Admin', async () => {
      renderWithProviders('/profile/details/emp-deactivated', 'admin');
      await screen.findByTestId('deactivated-notice');
      expect(screen.queryByTestId('edit-employee-btn')).toBeNull();
      expect(screen.queryByTestId('deactivate-employee-btn')).toBeNull();
      expect(screen.queryByTestId('upload-avatar-btn')).toBeNull();
      expect(screen.queryByTestId('open-change-manager-btn')).toBeNull();
    });

    it('shows the bank details once when the API sent them', async () => {
      const withBank = { ...mockEmployeeAdminView, bankName: 'HDFC', bankAccountNumber: '1234' };
      fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
        String(input).includes('/documents')
          ? new Response(JSON.stringify({ data: [] }), { status: 200 })
          : new Response(JSON.stringify({ data: withBank }), { status: 200 }),
      );
      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      // One bank section (it used to be repeated inside the account card too)
      expect(screen.getAllByText('Bank Account Details')).toHaveLength(1);
      expect(screen.getByText('HDFC')).toBeInTheDocument();
    });

    it('leaves out the bank and identity groups when the API sent none, instead of saying Not provided', async () => {
      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      expect(screen.queryByText('Bank Account Details')).toBeNull();
      expect(screen.queryByText('PAN Number')).toBeNull();
    });
  });

  describe('changing things from the profile', () => {
    const png = () => new File([new Uint8Array(100)], 'me.png', { type: 'image/png' });

    it('edits your own phone through the profile and shows the new phone read back from the server', async () => {
      let phone: string | null = null;
      let version = 1;
      const base = fetchMock.getMockImplementation() as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>;
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/api/v1/employees/emp-004')
          ? new Response(
              JSON.stringify({
                data: { ...mockEmployeeStaffView, id: 'emp-004', phone, version },
              }),
              { status: 200 },
            )
          : base(input, init),
      );
      const update = vi.spyOn(profileApi, 'updateProfilePhone').mockImplementation(async (body) => {
        phone = body.phone;
        version = body.version + 1;
        return {} as never;
      });

      renderWithProviders('/profile/details', 'staff');
      fireEvent.click(await screen.findByRole('button', { name: /Edit Phone/i }));
      fireEvent.change(screen.getByTestId('phone-input'), { target: { value: '+91 91111 22222' } });
      fireEvent.click(screen.getByTestId('save-phone-button'));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith({ version: 1, phone: '+91 91111 22222' }),
      );
      await waitFor(() =>
        expect(screen.getByTestId('profile-phone-display')).toHaveTextContent('+91 91111 22222'),
      );
      expect(screen.getByText('Phone number updated successfully.')).toBeInTheDocument();
      // The page stayed on screen while it reloaded: no skeleton took its place
      expect(screen.queryByTestId('employee-detail-loading')).toBeNull();
    });

    it('uploads your own photo through your own endpoint', async () => {
      const mine = vi
        .spyOn(profileApi, 'uploadMyPhoto')
        .mockResolvedValue('/api/v1/employees/emp-001/photo?v=2');
      const theirs = vi.spyOn(employeePhotoApi, 'uploadEmployeePhoto');

      renderWithProviders('/profile/details', 'admin');
      await screen.findByTestId('universal-employee-profile');
      fireEvent.change(screen.getByTestId('profile-photo-file-input'), {
        target: { files: [png()] },
      });

      await waitFor(() => expect(mine).toHaveBeenCalledTimes(1));
      expect(theirs).not.toHaveBeenCalled();
    });

    it("lets Admin upload and remove another employee's photo through that employee's endpoint", async () => {
      const mine = vi.spyOn(profileApi, 'uploadMyPhoto');
      const theirs = vi
        .spyOn(employeePhotoApi, 'uploadEmployeePhoto')
        .mockResolvedValue('/api/v1/employees/emp-1/photo?v=2');
      const removal = vi
        .spyOn(employeePhotoApi, 'deleteEmployeePhoto')
        .mockResolvedValue(undefined);
      const base = fetchMock.getMockImplementation() as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>;
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/api/v1/employees/emp-1')
          ? new Response(
              JSON.stringify({
                data: { ...mockEmployeeAdminView, photoUrl: '/api/v1/employees/emp-1/photo?v=1' },
              }),
              { status: 200 },
            )
          : base(input, init),
      );

      renderWithProviders('/profile/details/emp-1', 'admin');
      await screen.findByTestId('universal-employee-profile');
      const chosen = png();
      fireEvent.change(screen.getByTestId('profile-photo-file-input'), {
        target: { files: [chosen] },
      });
      await waitFor(() => expect(theirs).toHaveBeenCalledWith('emp-1', chosen));

      fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
      await waitFor(() => expect(removal).toHaveBeenCalledWith('emp-1'));
      expect(mine).not.toHaveBeenCalled();
    });

    it('hides Edit Phone on your own profile once it is deactivated', async () => {
      const base = fetchMock.getMockImplementation() as (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => Promise<Response>;
      fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).endsWith('/api/v1/employees/emp-004')
          ? new Response(JSON.stringify({ data: { ...mockDeactivatedEmployee, id: 'emp-004' } }), {
              status: 200,
            })
          : base(input, init),
      );

      renderWithProviders('/profile/details', 'staff');
      await screen.findByTestId('deactivated-notice');
      expect(screen.queryByTestId('edit-phone-button')).toBeNull();
    });
  });
});
