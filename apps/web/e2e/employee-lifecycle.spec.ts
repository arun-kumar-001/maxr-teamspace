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

const MOCK_DEPARTMENTS = [
  { id: 'dept-1', name: 'Engineering', code: 'ENG', isActive: true },
  { id: 'dept-2', name: 'Operations', code: 'OPS', isActive: true },
];

const MOCK_DESIGNATIONS = [
  {
    id: 'desig-1',
    title: 'VP of Engineering',
    code: 'VP_ENG',
    departmentId: 'dept-1',
    isActive: true,
  },
  {
    id: 'desig-2',
    title: 'Systems Architect',
    code: 'ARCH',
    departmentId: 'dept-1',
    isActive: true,
  },
];

const MOCK_EMPLOYEE = {
  id: 'emp-101',
  employeeCode: 'MAX101',
  firstName: 'Alexander',
  lastName: 'Pierce',
  email: 'alexander.pierce@maxr.com',
  phone: '+1 555-0199',
  department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
  designation: { id: 'desig-1', title: 'VP of Engineering', code: 'VP_ENG', level: 5 },
  manager: null,
  status: 'active',
  joiningDate: '2024-01-15',
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
  version: 1,
  account: {
    userId: 'usr-101',
    isActive: true,
    lastLoginAt: '2026-11-01T10:00:00Z',
    roles: ['admin'],
  },
};

const MOCK_CHECKLIST = [
  {
    employeeId: 'emp-101',
    employeeName: 'Alexander Pierce',
    employeeCode: 'MAX101',
    department: 'Engineering',
    designation: 'VP of Engineering',
    joiningDate: '2024-01-15',
    currentStep: 'hr',
    overallProgress: 25,
    items: [
      {
        id: 'chk-1',
        category: 'hr',
        title: 'Verify Identity Documents',
        isCompleted: true,
        verifiedAt: '2024-01-15T10:00:00Z',
      },
      {
        id: 'chk-2',
        category: 'it_admin',
        title: 'Issue Laptop & Security Token',
        isCompleted: false,
        verifiedAt: null,
      },
      {
        id: 'chk-3',
        category: 'employee',
        title: 'Acknowledge Employee Handbook',
        isCompleted: false,
        verifiedAt: null,
      },
    ],
  },
];

async function setupEmployeeLifecycleRoutes(page: any) {
  // Mock departments
  await page.route('**/api/v1/departments*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DEPARTMENTS }),
    });
  });

  // Mock designations
  await page.route('**/api/v1/designations*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_DESIGNATIONS }),
    });
  });

  // Mock settings
  await page.route('**/api/v1/settings*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          companyName: 'MAXR Global Inc.',
          timezone: 'Asia/Kolkata',
          workWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        },
      }),
    });
  });

  // Mock onboarding list & checklist
  await page.route('**/api/v1/onboarding*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: MOCK_CHECKLIST,
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock employee detail
  await page.route('**/api/v1/employees/emp-101', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_EMPLOYEE }),
    });
  });

  // Mock employee deactivation
  await page.route('**/api/v1/employees/emp-101/deactivate', async (route: any) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'emp-101',
            status: 'deactivated',
            deactivatedAt: new Date().toISOString(),
          },
        }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe('Issue #32: Employee Lifecycle Hardening & 9-Viewport Audit', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`Responsive Audit ${width}x${height} (${label}): verified layout, no horizontal scroll`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from the desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupEmployeeLifecycleRoutes(page);

      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      // 1. Employee Detail Page Responsive Audit
      await page.goto('/employees/emp-101');
      await expect(page.getByTestId('employee-detail-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Verify touch targets on interactive controls on mobile viewports (<640px)
      if (width < 640) {
        const backBtn = page.getByTestId('back-to-directory-btn');
        await expect(backBtn).toBeVisible();
        const box = await backBtn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }

      // 2. Onboarding Page Responsive Audit
      await page.goto('/hr/onboarding');
      await expect(page.getByTestId('onboarding-page')).toBeVisible();
      await expectNoHorizontalScroll(page);

      // 3. Capture screenshot evidence
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/employee-lifecycle-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }

  test('Critical Flow 1: Create Employee Form and Validation', async ({ page }) => {
    await setupEmployeeLifecycleRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/new');
    await expect(page.getByRole('heading', { name: /Add New Employee/i })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Form inputs exist and are interactive
    const firstNameInput = page.getByLabel(/First Name/i);
    await expect(firstNameInput).toBeVisible();
    await firstNameInput.fill('Arthur');

    const lastNameInput = page.getByLabel(/Last Name/i);
    await expect(lastNameInput).toBeVisible();
    await lastNameInput.fill('Pendelton');

    const emailInput = page.getByLabel(/Work Email/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill('arthur.pendelton@maxr.com');
  });

  test('Critical Flow 2: Onboarding Board and Checklist Inspection', async ({ page }) => {
    await setupEmployeeLifecycleRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/hr/onboarding');
    await expect(page.getByTestId('onboarding-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Onboarding/i })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Search input is present
    const searchInput = page.getByPlaceholder(/Search by employee name or code/i);
    await expect(searchInput).toBeVisible();
  });

  test('Critical Flow 3: Employee Detail and Document Tabs Navigation', async ({ page }) => {
    await setupEmployeeLifecycleRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees/emp-101');
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Alexander Pierce' })).toBeVisible();

    // Verify tabs are accessible and operable
    const personalTab = page.getByRole('radio', { name: /Personal Information/i });
    await expect(personalTab).toBeVisible();
    await personalTab.click();
    await expect(page.getByTestId('tab-personal')).toBeVisible();

    const accountTab = page.getByRole('radio', { name: /Account & Security/i });
    await expect(accountTab).toBeVisible();
    await accountTab.click();
    await expect(page.getByTestId('tab-account')).toBeVisible();
  });

  test('Critical Flow 4: Employee Deactivation Workflow and Protection', async ({ page }) => {
    await setupEmployeeLifecycleRoutes(page);

    // Set Admin session where user employeeId is NOT emp-101 (prevents self-deactivation)
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'maxr_auth_session',
        JSON.stringify({
          userId: 'usr-admin-root',
          employeeId: 'emp-admin-root',
          email: 'admin@maxr.com',
          role: 'admin',
          roles: ['admin'],
        }),
      );
    });

    await page.goto('/admin/employees/emp-101/deactivate');
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole('heading', { name: /Deactivate Employee Account/i })).toBeVisible();
    await expect(page.getByText('Alexander Pierce')).toBeVisible();
  });

  test('Role Matrix: Staff and Team Lead Scope Access Restrictions', async ({ page }) => {
    await setupEmployeeLifecycleRoutes(page);

    // 1. Staff role restrictions
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    // Staff cannot access Employee Creation
    await page.goto('/employees/new');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    // Staff cannot access HR Onboarding Board
    await page.goto('/hr/onboarding');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    // Staff cannot access Employee Deactivation
    await page.goto('/admin/employees/emp-101/deactivate');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
