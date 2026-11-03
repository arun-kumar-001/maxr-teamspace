import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

// The nine reference viewports from AGENTS.md section 8.
const REFERENCE_VIEWPORTS = [
  [360, 640, 'small-phone'],
  [390, 844, 'modern-phone'],
  [768, 1024, 'tablet-portrait'],
  [1024, 768, 'tablet-landscape'],
  [1366, 768, 'laptop'],
  [1440, 900, 'desktop'],
  [1920, 1080, 'fhd-monitor'],
  [2560, 1440, 'qhd-monitor'],
  [3440, 1440, 'ultrawide'],
] as const;

const SCREENSHOT_DIR = resolve(import.meta.dirname, '../../../e2e-output/screenshots');

const mockDepartments = [
  { id: 'dept-1', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-2', name: 'Operations', code: 'OPS', isActive: true },
];

const mockDesignations = [
  { id: 'desig-1', title: 'VP of Engineering', code: 'VP_ENG', level: 5, departmentId: 'dept-1' },
  {
    id: 'desig-2',
    title: 'Lead Systems Architect',
    code: 'ARCH',
    level: 4,
    departmentId: 'dept-1',
  },
  {
    id: 'desig-3',
    title: 'Operations Field Specialist',
    code: 'OPS_SPEC',
    level: 3,
    departmentId: 'dept-2',
  },
  {
    id: 'desig-swe',
    title: 'Software Engineer',
    code: 'SWE',
    level: 2,
    departmentId: 'dept-1',
  },
];

// Admin identity fixture (mockUsers.ts: emp-001)
function createMockEmployee(id = 'emp-001', version = 1, isElevated = true) {
  return {
    id,
    employeeCode: 'MAX001',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'admin@maxr.internal',
    phone: '+1 555-0101',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'VP of Engineering', code: 'VP_ENG', level: 5 },
    manager: null,
    status: 'active',
    joiningDate: '2023-01-15',
    createdAt: '2023-01-15T00:00:00Z',
    updatedAt: '2023-01-15T00:00:00Z',
    version,
    account: isElevated
      ? {
          userId: 'usr-admin-001',
          isActive: true,
          lastLoginAt: '2026-11-01T10:00:00Z',
          roles: ['admin'],
        }
      : undefined,
  };
}

// Staff identity fixture (mockUsers.ts: emp-004, direct report of Team Lead emp-003)
function createStaffEmployee(id = 'emp-004', version = 1) {
  return {
    id,
    employeeCode: 'EMP-004',
    firstName: 'Alex',
    lastName: 'Mercer',
    email: 'staff@maxr.internal',
    phone: '+1 555-0104',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-swe', title: 'Software Engineer', code: 'SWE', level: 2 },
    manager: {
      id: 'emp-003',
      firstName: 'Marcus',
      lastName: 'Vance',
      employeeCode: 'EMP-003',
    },
    status: 'active',
    joiningDate: '2023-06-01',
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2023-06-01T00:00:00Z',
    version,
    account: {
      userId: 'usr-staff-004',
      isActive: true,
      lastLoginAt: '2026-11-01T10:00:00Z',
      roles: ['staff'],
    },
  };
}

async function setupNavigationMockRoutes(
  page: any,
  options: {
    conflictOnSave?: boolean;
    initialVersion?: number;
    isElevated?: boolean;
    currentRole?: 'admin' | 'hr_manager' | 'team_lead' | 'staff';
  } = {},
) {
  let adminEmployee = createMockEmployee(
    'emp-001',
    options.initialVersion ?? 1,
    options.isElevated ?? true,
  );
  let staffEmployee = createStaffEmployee('emp-004', options.initialVersion ?? 1);

  // Departments & Designations lookups
  await page.route('**/api/v1/departments*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDepartments }),
    });
  });

  await page.route('**/api/v1/designations*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDesignations }),
    });
  });

  // Directory list endpoint
  await page.route('**/api/v1/employees?*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [adminEmployee, staffEmployee],
        meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      }),
    });
  });

  // Profile endpoint — Real backend endpoint is /api/v1/employees/me
  await page.route('**/api/v1/employees/me', async (route: any) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: staffEmployee }),
      });
    } else if (method === 'PATCH') {
      const patch = JSON.parse(route.request().postData() || '{}');
      staffEmployee = {
        ...staffEmployee,
        ...patch,
        version: staffEmployee.version + 1,
        updatedAt: new Date().toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: staffEmployee }),
      });
    } else {
      await route.continue();
    }
  });

  // Out-of-scope employee returns generic 404
  await page.route('**/api/v1/employees/emp-out-of-scope', async (route: any) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 'EMPLOYEE_NOT_FOUND',
          message:
            'The requested employee profile does not exist or you lack authorization to inspect this record.',
        },
      }),
    });
  });

  // Staff own-record detail endpoint (GET /api/v1/employees/emp-004)
  await page.route('**/api/v1/employees/emp-004', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: staffEmployee }),
    });
  });

  // Admin / General employee detail (GET & PUT /api/v1/employees/emp-001)
  await page.route('**/api/v1/employees/emp-001', async (route: any) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: adminEmployee }),
      });
    } else if (method === 'PUT') {
      if (options.conflictOnSave) {
        options.conflictOnSave = false; // fire once
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'CONCURRENCY_CONFLICT',
              message:
                'Someone else modified this employee record while you were editing. Reloading will fetch the latest version.',
            },
          }),
        });
        return;
      }

      const patch = JSON.parse(route.request().postData() || '{}');
      adminEmployee = {
        ...adminEmployee,
        ...patch,
        version: adminEmployee.version + 1,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: adminEmployee }),
      });
    } else {
      await route.continue();
    }
  });

  // Compatibility fallback for emp-1
  await page.route('**/api/v1/employees/emp-1', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: adminEmployee }),
    });
  });
}

test.describe('Issue #155: Employee Detail Access & Navigation Follow-up', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  test('1. Admin can navigate to employee detail from Employee Directory table', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees');
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();

    const empLink = page
      .locator('[data-testid="datatable-desktop-table"]')
      .getByTestId('employee-link-emp-001');
    await expect(empLink).toBeVisible();
    await empLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-001/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Sarah Connor/i })).toBeVisible();
  });

  test('2. HR Manager can navigate to employee detail from Employee Directory', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/employees');
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();

    const empLink = page
      .locator('[data-testid="datatable-desktop-table"]')
      .getByTestId('employee-link-emp-001');
    await expect(empLink).toBeVisible();
    await empLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-001/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('3. Team Lead can open an authorized direct-report detail (emp-004 reporting to emp-003)', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page, { isElevated: false });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    // Team Lead Marcus Vance (emp-003) opens direct report Alex Mercer (emp-004)
    await page.goto('/employees/emp-004');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Alex Mercer/i })).toBeVisible();
    await expect(page.getByTestId('employee-detail-page').getByText(/Marcus Vance/i)).toBeVisible();

    // Out-of-scope employee returns generic 404 for Team Lead
    await page.goto('/employees/emp-out-of-scope');
    await expect(page.getByTestId('employee-detail-not-found')).toBeVisible();
  });

  test('4. Staff can open their own employee detail route /employees/emp-004 without RouteGuard block', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page, { isElevated: false });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    // Staff Alex Mercer (emp-004) opens their own record
    await page.goto('/employees/emp-004');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Alex Mercer/i })).toBeVisible();
    await expect(page.getByText('EMP-004')).toBeVisible();
  });

  test('5. Staff attempting another employee ID receives generic not found state', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/employees/emp-out-of-scope');
    await expect(page.getByTestId('employee-detail-not-found')).toBeVisible();
    await expect(page.getByText(/Employee Not Found/i)).toBeVisible();
  });

  test('6. Admin alias /admin/employees/:id is authorized for Admin', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/admin/employees/emp-001');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('7. HR alias /hr/employees/:id is authorized for HR Manager', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/hr/employees/emp-001');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('8. Staff is denied from employee directory /employees by RouteGuard', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/employees');
    // Staff role on /employees is forbidden by RouteGuard
    await expect(page.getByTestId('employee-directory-filters')).toHaveCount(0);
  });

  test('9. Profile Header View Full Employee Record link navigates to /employees/:id (via GET /api/v1/employees/me)', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/profile');
    // Ensure profile page loaded via /api/v1/employees/me
    await expect(page.getByRole('heading', { level: 1, name: /Alex Mercer/i })).toBeVisible();

    const recordLink = page.getByTestId('view-full-record-link');
    await expect(recordLink).toBeVisible();
    await expect(recordLink).toHaveAttribute('href', '/employees/emp-004');
    await recordLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-004/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Alex Mercer/i })).toBeVisible();
  });

  test('10. Employee Card View Details button navigates to /employees/:id', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees');
    const cardLink = page.getByTestId('view-details-card-emp-001');
    await expect(cardLink).toBeVisible();
    await cardLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-001/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('11. Existing Edit Employee Modal workflow functions properly', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/emp-001');
    const editBtn = page.getByTestId('edit-employee-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify modal is displayed
    const fNameInput = page.getByTestId('edit-first-name-input');
    await expect(fNameInput).toBeVisible();
    await fNameInput.fill('Sarah-Jane');

    const saveBtn = page.getByTestId('save-employee-button');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify updated details appear
    await expect(page.getByRole('heading', { level: 1, name: /Sarah-Jane Connor/i })).toBeVisible();
  });

  test('12. 409 Concurrency Conflict displays conflict alert with reload button', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page, { conflictOnSave: true });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/emp-001');
    await page.getByTestId('edit-employee-btn').click();

    const fNameInput = page.getByTestId('edit-first-name-input');
    await fNameInput.fill('Sarah-Conflict');

    await page.getByTestId('save-employee-button').click();

    // Conflict banner appears
    await expect(page.getByTestId('conflict-alert')).toBeVisible();
    await expect(page.getByTestId('reload-latest-button')).toBeVisible();
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`13. Reference Viewport ${width}x${height} (${label}) responsive check`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Viewports driven from desktop');
      await page.setViewportSize({ width, height });
      await setupNavigationMockRoutes(page);
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/employees/emp-001');
      await expect(page.getByTestId('employee-detail-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/employee-detail-nav-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }
});
