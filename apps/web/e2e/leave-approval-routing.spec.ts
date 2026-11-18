import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});

async function setup(
  page: Page,
  role: 'staff' | 'hr_manager' | 'admin' | 'team_lead',
  stage: 'hr' | 'admin' = 'hr',
) {
  await page.addInitScript((value) => localStorage.setItem('maxr_auth_session', value), role);
  let settings = { approverRole: 'hr_manager', version: 1 };
  const savedRequests: Record<string, unknown>[] = [];
  const approval = {
    id: 'leave-routing-approval',
    subjectType: 'leave_request',
    subjectId: 'leave-routing-request',
    requesterEmployeeId: stage === 'admin' ? 'emp-002' : 'emp-004',
    requesterName: 'Requesting employee',
    requesterManagerId: 'emp-003',
    stages: [stage],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: '2026-11-17T09:00:00Z',
    decidedAt: null,
  };
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = { data: [], meta: { page: 1, pageSize: 50, total: 0, unread: 0 } };
    if (path === '/api/v1/leave-policies/approval-settings') {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON() as typeof settings;
        expect(payload.version).toBe(settings.version);
        settings = { approverRole: payload.approverRole, version: settings.version + 1 };
      }
      body = { data: settings };
    }
    if (path === '/api/v1/approvals')
      body = { data: [approval], meta: { page: 1, pageSize: 50, total: 1 } };
    if (path === '/api/v1/leave-requests/approval-route')
      body = {
        data: {
          approverRoles: role === 'hr_manager' ? ['admin'] : ['hr_manager', 'team_lead', 'admin'],
        },
      };
    if (path === '/api/v1/leave-requests' && request.method() === 'POST') {
      const saved = {
        ...request.postDataJSON(),
        id: 'leave-request-001',
        employeeId: 'emp-004',
        employeeName: 'Staff Member',
        leaveTypeName: 'Annual Leave',
        leaveTypeCode: 'ANNUAL',
        days: 1,
        status: 'pending',
        createdAt: '2026-11-18T09:00:00Z',
        updatedAt: '2026-11-18T09:00:00Z',
      };
      savedRequests.push(saved);
      body = { data: saved };
    }
    if (path === '/api/v1/leave-requests/me') {
      body = { data: savedRequests, meta: { page: 1, pageSize: 50, total: savedRequests.length } };
    }
    await route.fulfill({ status: 200, json: body });
  });
}

test('employee manually selects Team Lead and submits that role', async ({ page }, info) => {
  await setup(page, 'staff');
  await page.goto('/leave');
  await page.getByRole('button', { name: 'Apply Leave', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const select = dialog.getByRole('combobox', { name: 'Send request to' });
  await expect(select).toHaveValue('');
  const submit = dialog.getByRole('button', { name: 'Submit Application' });
  await expect(submit).toBeDisabled();
  await select.selectOption('team_lead');
  await expect(submit).toBeEnabled();
  await expectNoHorizontalScroll(page);
  const directory = resolve(import.meta.dirname, '../../../e2e-output/screenshots');
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `manual-leave-approver-${info.project.name}.png`),
  });
  const requestPromise = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/v1/leave-requests' && request.method() === 'POST',
  );
  await submit.click();
  const request = await requestPromise;
  expect(request.postDataJSON()).toMatchObject({ approverRole: 'team_lead' });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Annual Leave').filter({ visible: true }).first()).toBeVisible();
});

test('HR must manually select Admin and the default-approver card is removed', async ({ page }) => {
  await setup(page, 'hr_manager');
  await page.goto('/leave/policies');
  await expect(page.getByText('Configured Leave Policies')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Default approver' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Apply Leave', exact: true }).click();
  const select = page.getByRole('dialog').getByRole('combobox', { name: 'Send request to' });
  await expect(select).toHaveValue('');
  await expect(select.getByRole('option', { name: 'Admin', exact: true })).toHaveCount(1);
  await expect(select.getByRole('option', { name: 'HR Manager' })).toHaveCount(0);
  await select.selectOption('admin');
  await expect(select).toHaveValue('admin');
  await expectNoHorizontalScroll(page);
});

for (const role of ['hr_manager', 'admin', 'team_lead'] as const) {
  test(`${role} sees the correct leave decision actions`, async ({ page }) => {
    await setup(page, role);
    await page.goto('/approvals');
    await expect(
      page.getByText('Requesting employee').filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(
      role === 'hr_manager' ? 1 : 0,
    );
    await expectNoHorizontalScroll(page);
  });
}

test('Admin can review HR leave at the Admin stage', async ({ page }) => {
  await setup(page, 'admin', 'admin');
  await page.goto('/approvals');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await expect(page.getByText('Admin Review').filter({ visible: true }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
