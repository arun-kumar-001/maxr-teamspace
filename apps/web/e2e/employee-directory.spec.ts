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

const MOCK_EMPLOYEES = [
  {
    id: 'emp-1',
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
  },
  {
    id: 'emp-2',
    employeeCode: 'MAX002',
    firstName: 'Bonnie',
    lastName: 'Barstow',
    email: 'bonnie.barstow@maxr.com',
    phone: '+1 555-0102',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-2', title: 'Lead Systems Architect', code: 'ARCH', level: 4 },
    manager: {
      id: 'emp-1',
      firstName: 'Devon',
      lastName: 'Miles',
      employeeCode: 'MAX001',
    },
    status: 'active',
    joiningDate: '2023-05-10',
    createdAt: '2023-05-10T00:00:00Z',
    updatedAt: '2023-05-10T00:00:00Z',
  },
  {
    id: 'emp-3',
    employeeCode: 'MAX003',
    firstName: 'Michael',
    lastName: 'Knight',
    email: 'michael.knight@maxr.com',
    phone: '+1 555-0103',
    department: { id: 'dept-2', name: 'Operations', code: 'OPS' },
    designation: {
      id: 'desig-3',
      title: 'Operations Field Specialist',
      code: 'OPS_SPEC',
      level: 3,
    },
    manager: {
      id: 'emp-1',
      firstName: 'Devon',
      lastName: 'Miles',
      employeeCode: 'MAX001',
    },
    status: 'pending',
    joiningDate: '2024-02-01',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
  },
];

async function setupDirectoryMockRoutes(page: any) {
  // Mock departments
  await page.route('**/api/v1/departments*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'dept-1', name: 'Engineering', code: 'ENG' },
          { id: 'dept-2', name: 'Operations', code: 'OPS' },
        ],
      }),
    });
  });

  // Mock designations
  await page.route('**/api/v1/designations*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'desig-1', title: 'VP of Engineering', code: 'VP_ENG', level: 5 },
          { id: 'desig-2', title: 'Lead Systems Architect', code: 'ARCH', level: 4 },
          { id: 'desig-3', title: 'Operations Field Specialist', code: 'OPS_SPEC', level: 3 },
        ],
      }),
    });
  });

  // Mock employees list & detail
  await page.route('**/api/v1/employees*', async (route: any) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    // Handle single employee detail (e.g. /api/v1/employees/emp-1)
    if (pathname.match(/\/api\/v1\/employees\/[^/?#]+$/)) {
      const parts = pathname.split('/');
      const empId = parts[parts.length - 1];
      const fallback = MOCK_EMPLOYEES[0]!;
      const found = MOCK_EMPLOYEES.find((e) => e.id === empId) ?? fallback;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...found,
            version: 1,
            account: {
              userId: 'usr-' + found.id,
              isActive: true,
              lastLoginAt: '2026-11-01T10:00:00Z',
              roles: ['staff'],
            },
          },
        }),
      });
      return;
    }

    const search = url.searchParams.get('search')?.toLowerCase() || '';

    let filtered = MOCK_EMPLOYEES;
    if (search) {
      filtered = filtered.filter(
        (e) =>
          e.firstName.toLowerCase().includes(search) ||
          e.lastName.toLowerCase().includes(search) ||
          e.employeeCode.toLowerCase().includes(search) ||
          e.email.toLowerCase().includes(search),
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
        meta: {
          page: 1,
          pageSize: 20,
          total: filtered.length,
        },
      }),
    });
  });
}

test.describe('Issue #19: Employee Directory UI Responsiveness & Features', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`${width}x${height} (${label}): verified layout, no horizontal scroll, screenshot saved`, async ({
      page,
    }, testInfo) => {
      // Run the 9-viewport check on the desktop project to avoid duplicating across projects
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from the desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupDirectoryMockRoutes(page);

      // Set HR Manager role in localStorage
      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'hr_manager');
      });

      await page.goto('/hr/employees');

      // 1. Verify key landmarks are visible
      await expect(
        page.getByRole('heading', { level: 1, name: 'Employee Directory' }),
      ).toBeVisible();
      await expect(page.getByTestId('employee-directory-filters')).toBeVisible();

      // 2. Strict horizontal scroll check (AGENTS.md §8)
      await expectNoHorizontalScroll(page);

      // 3. Responsive view switching verification
      if (width < 640) {
        // Mobile phone view (<640px)
        await expect(page.getByTestId('employee-mobile-cards')).toBeVisible();
        await expect(page.getByTestId('datatable-desktop-table')).toBeHidden();

        // Check 44x44px touch targets on mobile card actions
        const card = page.getByTestId('employee-card-emp-1');
        await expect(card).toBeVisible();

        const emailLink = card.getByRole('link', { name: /Send email/i });
        await expect(emailLink).toBeVisible();
        const emailBox = await emailLink.boundingBox();
        expect(emailBox).not.toBeNull();
        if (emailBox) {
          expect(emailBox.width).toBeGreaterThanOrEqual(44);
          expect(emailBox.height).toBeGreaterThanOrEqual(44);
        }

        const callLink = card.getByRole('link', { name: /Call/i });
        await expect(callLink).toBeVisible();
        const callBox = await callLink.boundingBox();
        expect(callBox).not.toBeNull();
        if (callBox) {
          expect(callBox.width).toBeGreaterThanOrEqual(44);
          expect(callBox.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        // Tablet / Desktop view (>=640px)
        await expect(page.getByTestId('datatable-desktop-table')).toBeVisible();
        await expect(page.getByTestId('employee-mobile-cards')).toBeHidden();
      }

      // 4. Capture screenshot evidence
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/employee-directory-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }

  test('search and filter interaction operates correctly', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'desktop/tablet filter test');

    await setupDirectoryMockRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/hr/employees');
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();

    // Type in search
    const searchInput = page.getByPlaceholder('Search by name, code, or email...');
    await searchInput.fill('Knight');

    // Wait for debounced search and filtered results
    await expect(page.getByRole('cell', { name: /Michael Knight MAX003/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Devon Miles MAX001/i })).toBeHidden();

    // Reset filters
    const clearBtn = page.getByTestId('employee-filters-reset');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    await expect(page.getByRole('cell', { name: /Devon Miles MAX001/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Bonnie Barstow MAX002/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Michael Knight MAX003/i })).toBeVisible();
  });

  test('role-based access control: Staff is denied access to all directory routes', async ({
    page,
  }) => {
    await setupDirectoryMockRoutes(page);

    // Set Staff role in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    // 1. Attempt visiting canonical /employees
    await page.goto('/employees');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('is not authorized to view the requested resource')).toBeVisible();

    // 2. Attempt visiting /admin/employees
    await page.goto('/admin/employees');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    // 3. Attempt visiting /hr/employees
    await page.goto('/hr/employees');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    // 4. Attempt visiting /lead/team
    await page.goto('/lead/team');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();
  });

  test('canonical route /employees renders EmployeeDirectoryPage for authorized roles', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone', 'desktop/tablet canonical route check');
    await setupDirectoryMockRoutes(page);

    // Verify Admin on /employees
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });
    await page.goto('/employees');
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();
    await expect(page.getByTestId('employee-directory-filters')).toBeVisible();
    await expect(page.getByTestId('datatable-desktop-table')).toBeVisible();
  });

  test('role-based navigation: Admin has Employee Directory navigation entry', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'phone',
      'sidebar navigation verification on wider screens',
    );
    await setupDirectoryMockRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });
    await page.goto('/dashboard');
    const adminDirLink = page.getByRole('link', { name: 'Employee Directory' });
    await expect(adminDirLink).toBeVisible();
    await adminDirLink.click();
    await expect(page).toHaveURL(/.*\/admin\/employees/);
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();
    await expect(page.getByTestId('employee-directory-filters')).toBeVisible();
  });

  test('role-based navigation: HR Manager has Employee Directory navigation entry', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'phone',
      'sidebar navigation verification on wider screens',
    );
    await setupDirectoryMockRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });
    await page.goto('/dashboard');
    const hrDirLink = page.getByRole('link', { name: 'Employee Directory' });
    await expect(hrDirLink).toBeVisible();
    await hrDirLink.click();
    await expect(page).toHaveURL(/.*\/hr\/employees/);
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();
    await expect(page.getByTestId('employee-directory-filters')).toBeVisible();
  });

  test('role-based navigation: Team Lead has Team Directory navigation entry', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'phone',
      'sidebar navigation verification on wider screens',
    );
    await setupDirectoryMockRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });
    await page.goto('/dashboard');
    const leadDirLink = page.getByRole('link', { name: 'Team Directory' });
    await expect(leadDirLink).toBeVisible();
    await leadDirLink.click();
    await expect(page).toHaveURL(/.*\/lead\/team/);
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();
    await expect(page.getByTestId('employee-directory-filters')).toBeVisible();
  });

  test('Issue #21: Employee detail navigation and view', async ({ page }) => {
    await setupDirectoryMockRoutes(page);

    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/employees');
    await expect(page.getByRole('heading', { level: 1, name: 'Employee Directory' })).toBeVisible();

    // Click on the first visible employee link
    const firstEmpLink = page.locator('[data-testid="employee-link-emp-1"]:visible').first();
    await expect(firstEmpLink).toBeVisible();
    await firstEmpLink.click();

    // Expect navigation to detail page
    await expect(page).toHaveURL(/.*\/employees\/emp-1/);
    await expect(page.getByTestId('employee-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Devon Miles' })).toBeVisible();
    await expect(page.getByText('MAX001')).toBeVisible();

    // Verify responsive layout has no horizontal scroll (AGENTS.md §8)
    await expectNoHorizontalScroll(page);

    // Verify tabs work
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    const personalTab = page.getByRole('radio', { name: /Personal Information/i });
    await expect(personalTab).toBeVisible();
    await personalTab.click();
    await expect(page.getByTestId('tab-personal')).toBeVisible();

    // Back to directory button works
    const backBtn = page.getByTestId('back-to-directory-btn');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/.*\/employees/);
  });
});
