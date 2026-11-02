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

const INITIAL_DEPARTMENTS = [
  {
    id: 'dept-1',
    name: 'Engineering',
    code: 'ENG',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'dept-2',
    name: 'Human Resources',
    code: 'HR',
    isActive: true,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'dept-3',
    name: 'Legacy Archive',
    code: 'ARCHIVE',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const INITIAL_DESIGNATIONS = [
  {
    id: 'desig-1',
    departmentId: 'dept-1',
    title: 'Principal Software Engineer',
    code: 'PR_SWE',
    level: 5,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'desig-2',
    departmentId: 'dept-1',
    title: 'Senior Software Engineer',
    code: 'SR_SWE',
    level: 3,
    isActive: true,
    createdAt: '2025-01-02T00:00:00Z',
    updatedAt: '2025-01-02T00:00:00Z',
  },
  {
    id: 'desig-3',
    departmentId: 'dept-2',
    title: 'HR Generalist',
    code: 'HR_GEN',
    level: 2,
    isActive: true,
    createdAt: '2025-01-03T00:00:00Z',
    updatedAt: '2025-01-03T00:00:00Z',
  },
];

async function setupDepartmentsAndDesignationsRoutes(page: any) {
  const departments = [...INITIAL_DEPARTMENTS];
  const designations = [...INITIAL_DESIGNATIONS];

  // Mock departments with regex to cover all subpaths and query strings
  await page.route(/\/api\/v1\/departments/, async (route: any) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET') {
      const search = url.searchParams.get('search')?.toLowerCase() || '';
      const isActiveParam = url.searchParams.get('isActive');

      let filtered = [...departments];
      if (search) {
        filtered = filtered.filter(
          (d) => d.name.toLowerCase().includes(search) || d.code.toLowerCase().includes(search),
        );
      }
      if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
        const bool = isActiveParam === 'true';
        filtered = filtered.filter((d) => d.isActive === bool);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: filtered,
          meta: { page: 1, pageSize: 20, total: filtered.length, totalPages: 1 },
        }),
      });
    } else if (method === 'POST' && url.pathname.endsWith('/deactivate')) {
      const parts = url.pathname.split('/');
      const id = parts[parts.length - 2];
      const dept = departments.find((d) => d.id === id);
      if (dept) dept.isActive = false;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id, isActive: false } }),
      });
    } else if (method === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      const newDept = {
        id: `dept-${Date.now()}`,
        name: payload.name,
        code: payload.code,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      departments.push(newDept);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newDept }),
      });
    } else if (method === 'PUT') {
      const parts = url.pathname.split('/');
      const id = parts[parts.length - 1];
      const payload = JSON.parse(request.postData() || '{}');
      let dept = departments.find((d) => d.id === id);
      if (dept) {
        if (payload.name) dept.name = payload.name;
        if (payload.code) dept.code = payload.code;
        dept.updatedAt = new Date().toISOString();
      } else {
        dept = {
          id: id!,
          name: payload.name || 'Updated Department',
          code: payload.code || 'UPD',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        departments.push(dept);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: dept }),
      });
    } else {
      await route.continue();
    }
  });

  // Mock designations with regex to cover all subpaths and query strings
  await page.route(/\/api\/v1\/designations/, async (route: any) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method === 'GET') {
      const search = url.searchParams.get('search')?.toLowerCase() || '';
      const deptId = url.searchParams.get('departmentId');
      const isActiveParam = url.searchParams.get('isActive');

      let filtered = [...designations];
      if (search) {
        filtered = filtered.filter(
          (d) => d.title.toLowerCase().includes(search) || d.code.toLowerCase().includes(search),
        );
      }
      if (deptId) {
        filtered = filtered.filter((d) => d.departmentId === deptId);
      }
      if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
        const bool = isActiveParam === 'true';
        filtered = filtered.filter((d) => d.isActive === bool);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: filtered,
          meta: { page: 1, pageSize: 20, total: filtered.length, totalPages: 1 },
        }),
      });
    } else if (method === 'POST' && url.pathname.endsWith('/deactivate')) {
      const parts = url.pathname.split('/');
      const id = parts[parts.length - 2];
      const desig = designations.find((d) => d.id === id);
      if (desig) desig.isActive = false;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id, isActive: false } }),
      });
    } else if (method === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      const newDesig = {
        id: `desig-${Date.now()}`,
        departmentId: payload.departmentId,
        title: payload.title,
        code: payload.code,
        level: Number(payload.level),
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      designations.push(newDesig);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newDesig }),
      });
    } else if (method === 'PUT') {
      const parts = url.pathname.split('/');
      const id = parts[parts.length - 1];
      const payload = JSON.parse(request.postData() || '{}');
      let desig = designations.find((d) => d.id === id);
      if (desig) {
        if (payload.title) desig.title = payload.title;
        if (payload.code) desig.code = payload.code;
        if (payload.departmentId) desig.departmentId = payload.departmentId;
        if (payload.level !== undefined) desig.level = Number(payload.level);
        desig.updatedAt = new Date().toISOString();
      } else {
        desig = {
          id: id!,
          departmentId: payload.departmentId || 'dept-1',
          title: payload.title || 'Updated Title',
          code: payload.code || 'UPD',
          level: Number(payload.level ?? 1),
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        designations.push(desig);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: desig }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Issue #18: Departments and Designations UI Implementation', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`Departments: ${width}x${height} (${label}) responsive check & screenshot`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from the desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupDepartmentsAndDesignationsRoutes(page);

      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'admin');
      });

      await page.goto('/admin/departments');

      // Verify header landmark
      await expect(page.getByRole('heading', { level: 1, name: 'Departments' })).toBeVisible();
      await expect(page.getByTestId('department-filters')).toBeVisible();

      // No horizontal scroll check
      await expectNoHorizontalScroll(page);

      if (width < 640) {
        // Mobile cards
        await expect(page.getByTestId('department-mobile-cards')).toBeVisible();
        await expect(page.getByTestId('datatable-desktop-table')).toBeHidden();

        // 44x44px touch targets
        const card = page.getByTestId('department-card-dept-1');
        await expect(card).toBeVisible();

        const viewBtn = card.getByTestId('card-view-dept-dept-1');
        await expect(viewBtn).toBeVisible();
        const box = await viewBtn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        // Desktop table
        await expect(page.getByTestId('datatable-desktop-table')).toBeVisible();
        await expect(page.getByTestId('department-mobile-cards')).toBeHidden();
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/departments-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }

  test('Admin can create, edit, view, and deactivate departments', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop admin workflow');

    await setupDepartmentsAndDesignationsRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });

    await page.goto('/admin/departments');
    await expect(page.getByRole('heading', { level: 1, name: 'Departments' })).toBeVisible();

    // 1. Create Department
    await page.getByTestId('add-department-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Department' })).toBeVisible();

    await page.getByLabel(/Department Name/i).fill('Quality Assurance');
    await page.getByLabel(/Department Code/i).fill('QA');
    await page.getByTestId('department-modal-submit').click();

    // Verify modal closes and new item appears
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Quality Assurance').first()).toBeVisible();

    // 2. View Department Details
    const viewButtons = page.getByRole('button', { name: 'View' });
    await viewButtons.first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Department Details' })).toBeVisible();
    await page.getByTestId('department-detail-close').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // 3. Edit Department
    const editButtons = page.getByRole('button', { name: 'Edit' });
    await editButtons.first().click();
    await expect(page.getByRole('heading', { name: 'Edit Department' })).toBeVisible();
    await page.getByLabel(/Department Name/i).fill('Engineering & Core Platforms');
    await page.getByTestId('department-modal-submit').click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Engineering & Core Platforms').first()).toBeVisible();

    // 4. Deactivate Department (Admin only)
    const deactivateButtons = page.getByRole('button', { name: 'Deactivate' });
    await deactivateButtons.first().click();
    await expect(page.getByRole('heading', { name: 'Deactivate Department' })).toBeVisible();
    await page.getByTestId('department-deactivate-confirm').click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('HR Manager can create and edit designations, but cannot deactivate', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop hr workflow');

    await setupDepartmentsAndDesignationsRoutes(page);
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });

    await page.goto('/hr/designations');
    await expect(page.getByRole('heading', { level: 1, name: 'Designations' })).toBeVisible();

    // HR can see Add Designation
    const addBtn = page.getByTestId('add-designation-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Designation' })).toBeVisible();

    await page.getByTestId('designation-department-input').selectOption('dept-1');
    await page.getByLabel(/Designation Title/i).fill('DevOps Specialist');
    await page.getByLabel(/Designation Code/i).fill('DEVOPS');
    await page.getByTestId('designation-level-input').fill('3');
    await page.getByTestId('designation-modal-submit').click();

    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('DevOps Specialist').first()).toBeVisible();

    // HR cannot see any Deactivate buttons
    await expect(page.getByRole('button', { name: 'Deactivate' })).toBeHidden();
  });

  test('Access Control: Staff and Team Lead are strictly denied access', async ({ page }) => {
    await setupDepartmentsAndDesignationsRoutes(page);

    // 1. Staff access attempt
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/admin/departments');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    await page.goto('/hr/designations');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    // 2. Team Lead access attempt
    await page.evaluate(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });

    await page.goto('/departments');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();

    await page.goto('/designations');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();
  });
});
