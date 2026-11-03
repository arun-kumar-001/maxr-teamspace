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
  { id: 'dept-eng', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-hr', name: 'Human Resources', code: 'HR', isActive: true },
];

const mockDesignations = [
  {
    id: 'desig-swe',
    title: 'Software Engineer',
    code: 'SWE',
    departmentId: 'dept-eng',
    isActive: true,
  },
  { id: 'desig-qa', title: 'QA Engineer', code: 'QA', departmentId: 'dept-eng', isActive: true },
];

const mockManagers = [
  { id: 'mgr-1', firstName: 'Kavita', lastName: 'Iyer', employeeCode: 'MGR-001', status: 'active' },
];

async function setupCreateEmployeeRoutes(page: any) {
  await page.route(/\/api\/v1\/departments/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDepartments }),
    });
  });

  await page.route(/\/api\/v1\/designations/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockDesignations }),
    });
  });

  await page.route(/\/api\/v1\/employees\?status=active/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockManagers }),
    });
  });

  await page.route(/\/api\/v1\/employees$/, async (route: any) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      const idempotencyKey = request.headers()['idempotency-key'];

      if (!idempotencyKey) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'BAD_REQUEST', message: 'Missing Idempotency-Key header' },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'emp-new-created',
            userId: 'usr-new-created',
            employeeCode: payload.employeeCode,
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            phone: payload.phone || null,
            departmentId: payload.departmentId,
            designationId: payload.designationId,
            managerId: payload.managerId || null,
            status: 'pending',
            role: payload.role || 'staff',
            joiningDate: payload.joiningDate,
            createdAt: new Date().toISOString(),
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Issue #20: Create Employee UI & Responsive QA', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`Create Employee: ${width}x${height} (${label}) responsive check & screenshot`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupCreateEmployeeRoutes(page);

      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/employees/new');

      // Verify page container is visible
      await expect(page.getByTestId('create-employee-page')).toBeVisible();
      await expect(page.getByTestId('create-employee-form')).toBeVisible();

      // No horizontal scroll check across all viewports
      await expectNoHorizontalScroll(page);

      // Verify touch target >= 44x44px for primary controls on mobile (<640px)
      if (width < 640) {
        const nextBtn = page.getByTestId('mobile-next-step-button');
        await expect(nextBtn).toBeVisible();
        const box = await nextBtn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        const submitBtn = page.getByTestId('desktop-submit-button');
        await expect(submitBtn).toBeVisible();
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/create-employee-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }

  test('Admin Employee Creation Flow: creates employee with pending status', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop creation flow');

    await setupCreateEmployeeRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/new');
    await expect(page.getByTestId('create-employee-page')).toBeVisible();

    // Verify all 4 roles are available to Admin
    await expect(page.getByTestId('role-card-staff')).toBeVisible();
    await expect(page.getByTestId('role-card-team_lead')).toBeVisible();
    await expect(page.getByTestId('role-card-hr_manager')).toBeVisible();
    await expect(page.getByTestId('role-card-admin')).toBeVisible();

    // Fill personal information
    await page.getByTestId('input-first-name').fill('Ananya');
    await page.getByTestId('input-last-name').fill('Nair');
    await page.getByTestId('input-email').fill('ananya.nair@maxr.example');
    await page.getByTestId('input-phone').fill('+91 91234 56789');

    // Fill employment information
    await page.getByTestId('input-employee-code').fill('EMP-789');
    await page.getByTestId('select-department').selectOption('dept-eng');
    await page.getByTestId('select-designation').selectOption('desig-swe');
    await page.getByTestId('input-joining-date').fill('2026-12-01');

    // Select role: Admin
    await page.getByTestId('role-card-admin').click();

    // Submit form
    await page.getByTestId('desktop-submit-button').click();

    // Verify success view
    await expect(page.getByTestId('create-employee-success-view')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Employee Created Successfully' }),
    ).toBeVisible();
    await expect(page.getByText('Ananya Nair')).toBeVisible();
    await expect(page.getByText('EMP-789')).toBeVisible();
    await expect(page.getByText(/Account Inactive Pending Onboarding/i)).toBeVisible();
    await expect(
      page.getByText(/No password or activation link has been issued at this stage/i),
    ).toBeVisible();
  });

  test('HR Manager Role Restrictions: cannot assign Admin or HR Manager role', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop hr manager check');

    await setupCreateEmployeeRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/employees/new');
    await expect(page.getByTestId('create-employee-page')).toBeVisible();

    // Staff and Team Lead allowed
    await expect(page.getByTestId('role-card-staff')).toBeVisible();
    await expect(page.getByTestId('role-card-team_lead')).toBeVisible();

    // Admin and HR Manager hidden
    await expect(page.getByTestId('role-card-hr_manager')).toBeHidden();
    await expect(page.getByTestId('role-card-admin')).toBeHidden();
  });

  test('RBAC Access Control: Team Lead and Staff cannot access /employees/new directly', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop rbac check');

    await setupCreateEmployeeRoutes(page);

    // 1. Team Lead: denied by RouteGuard
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });
    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByTestId('create-employee-form')).toBeHidden();

    // 2. Staff: denied by RouteGuard
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });
    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByTestId('create-employee-form')).toBeHidden();
  });

  test('Employee Directory Integration: Add Employee button visibility and navigation', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop directory button check');

    await page.route(/\/api\/v1\/employees(\?.*)?$/, async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
        }),
      });
    });

    // 1. Admin sees Add Employee button
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });
    await page.goto('/employees');
    const addBtn = page.getByTestId('add-employee-button');
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    await expect(page).toHaveURL(/\/employees\/new/);
  });
});
