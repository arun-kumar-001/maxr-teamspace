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
];

function createMockEmployee(id = 'emp-1', version = 1, isElevated = true) {
  return {
    id,
    employeeCode: 'MAX001',
    firstName: 'Devon',
    lastName: 'Miles',
    email: 'devon.miles@maxr.com',
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
          userId: 'usr-devon',
          isActive: true,
          lastLoginAt: '2026-11-01T10:00:00Z',
          roles: ['admin'],
        }
      : undefined,
  };
}

async function setupNavigationMockRoutes(
  page: any,
  options: {
    conflictOnSave?: boolean;
    initialVersion?: number;
    isElevated?: boolean;
  } = {},
) {
  let empState = createMockEmployee(
    'emp-1',
    options.initialVersion ?? 1,
    options.isElevated ?? true,
  );

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
        data: [empState],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      }),
    });
  });

  // Out-of-scope employee returns 404 (generic)
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

  // Single employee detail (GET & PUT)
  await page.route('**/api/v1/employees/emp-1', async (route: any) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: empState }),
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
      empState = {
        ...empState,
        ...patch,
        version: empState.version + 1,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: empState }),
      });
    } else {
      await route.continue();
    }
  });

  // Profile endpoint
  await page.route('**/api/v1/profile', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'emp-1',
          employeeCode: 'MAX001',
          firstName: 'Devon',
          lastName: 'Miles',
          email: 'devon.miles@maxr.com',
          phone: '+1 555-0101',
          department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'desig-1', title: 'VP of Engineering', code: 'VP_ENG' },
          manager: null,
          status: 'active',
          joiningDate: '2023-01-15',
          createdAt: '2023-01-15T00:00:00Z',
          updatedAt: '2023-01-15T00:00:00Z',
          version: 1,
        },
      }),
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

    const empLink = page.locator('[data-testid="employee-link-emp-1"]').first();
    await expect(empLink).toBeVisible();
    await empLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-1/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Devon Miles/i })).toBeVisible();
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

    const empLink = page.locator('[data-testid="employee-link-emp-1"]').first();
    await expect(empLink).toBeVisible();
    await empLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-1/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('3. Team Lead can open an authorized direct-report detail', async ({ page }) => {
    await setupNavigationMockRoutes(page, { isElevated: false });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    await page.goto('/employees/emp-1');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Devon Miles/i })).toBeVisible();
  });

  test('4. Staff can open their own employee detail route /employees/:id without RouteGuard block', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page, { isElevated: false });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/employees/emp-1');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Devon Miles/i })).toBeVisible();
  });

  test('5. Staff attempting out-of-scope employee ID receives generic not found state', async ({
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

    await page.goto('/admin/employees/emp-1');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('7. HR alias /hr/employees/:id is authorized for HR Manager', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/hr/employees/emp-1');
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

  test('9. Profile Header View Full Employee Record link navigates to /employees/:id', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/profile');
    const recordLink = page.getByTestId('view-full-record-link');
    await expect(recordLink).toBeVisible();
    await recordLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-1/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('10. Employee Card View Details button navigates to /employees/:id', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees');
    const cardLink = page.getByTestId('view-details-card-emp-1');
    await expect(cardLink).toBeVisible();
    await cardLink.click();

    await expect(page).toHaveURL(/.*\/employees\/emp-1/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
  });

  test('11. Existing Edit Employee Modal workflow functions properly', async ({ page }) => {
    await setupNavigationMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/emp-1');
    const editBtn = page.getByTestId('edit-employee-btn');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Verify modal is displayed
    const fNameInput = page.getByTestId('edit-first-name-input');
    await expect(fNameInput).toBeVisible();
    await fNameInput.fill('Devonshire');

    const saveBtn = page.getByTestId('save-employee-button');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify updated details appear
    await expect(page.getByRole('heading', { level: 1, name: /Devonshire Miles/i })).toBeVisible();
  });

  test('12. 409 Concurrency Conflict displays conflict alert with reload button', async ({
    page,
  }) => {
    await setupNavigationMockRoutes(page, { conflictOnSave: true });
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/emp-1');
    await page.getByTestId('edit-employee-btn').click();

    const fNameInput = page.getByTestId('edit-first-name-input');
    await fNameInput.fill('Devon-Changed');

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

      await page.goto('/employees/emp-1');
      await expect(page.getByTestId('employee-detail-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/employee-detail-nav-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }
});
