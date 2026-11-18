import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const employee = {
  id: 'directory-review-employee',
  employeeCode: 'E-200',
  firstName: 'Directory',
  lastName: 'Reviewer',
  email: 'directory-review@example.test',
  phone: null,
  department: { id: 'department-review', name: 'Engineering', code: 'ENG' },
  designation: { id: 'designation-review', title: 'Engineer' },
  manager: null,
  status: 'pending',
  joiningDate: '2026-11-01',
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('maxr_auth_session', 'admin'));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    let data: unknown[] = [];
    if (url.pathname === '/api/v1/employees')
      data =
        !url.searchParams.get('search') ||
        'directory reviewer e-200'.includes(url.searchParams.get('search')!.toLowerCase())
          ? [employee]
          : [];
    if (url.pathname === '/api/v1/departments') data = [employee.department];
    if (url.pathname === '/api/v1/designations') data = [employee.designation];
    await route.fulfill({
      json: { data, meta: { page: 1, pageSize: 20, total: data.length, totalPages: 1 } },
    });
  });
});

test('directory cards, search and actions work at each viewport', async ({ page }, info) => {
  await page.goto('/admin/employees');
  await expect(page.getByTestId('employee-directory-page')).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search employee by name or ID' });
  await expect(search).toBeVisible();
  const mobile = info.project.name === 'phone';
  const card = page.getByTestId(
    mobile
      ? 'employee-card-directory-review-employee'
      : 'employee-grid-card-directory-review-employee',
  );
  await expect(card).toBeVisible();
  await expect(card).toContainText('Directory Reviewer');
  await expect(card).toContainText('Pending');
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: `../../e2e-output/screenshots/directory-selected-${info.project.name}.png`,
    fullPage: true,
  });
  if (!mobile) {
    await card.getByRole('button', { name: 'Actions for Directory Reviewer' }).click();
    await expect(page.getByRole('group', { name: 'Employee actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Details', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'View Details', exact: true }).press('Escape');
    await expect(page.getByRole('group', { name: 'Employee actions' })).toHaveCount(0);
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(card).toBeHidden();
    await page.getByRole('button', { name: 'Grid view' }).click();
    await expect(card).toBeVisible();
  }
  await search.fill('not-an-employee');
  await expect(page.getByTestId('empty-state')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(card).toBeVisible();
});
