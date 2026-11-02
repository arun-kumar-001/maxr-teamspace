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

function createMockProfile(role: 'admin' | 'hr_manager' | 'team_lead' | 'staff', version = 1) {
  const isElevated = role === 'admin' || role === 'hr_manager';
  return {
    id: `emp-${role}`,
    employeeCode: `EMP-${role.toUpperCase().slice(0, 3)}-001`,
    firstName:
      role === 'admin'
        ? 'Arun'
        : role === 'hr_manager'
          ? 'Hema'
          : role === 'team_lead'
            ? 'Kavita'
            : 'Priya',
    lastName: 'Sharma',
    email: `${role}@maxr.example`,
    phone: '+91 98765 43210',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'Software Engineer', code: 'ENG-SWE' },
    manager:
      role === 'team_lead' || role === 'admin'
        ? null
        : {
            id: 'emp-mgr',
            firstName: 'Kavita',
            lastName: 'Iyer',
            employeeCode: 'MGR-001',
          },
    status: 'active',
    joiningDate: '2025-01-15',
    createdAt: '2025-01-15T00:00:00Z',
    updatedAt: '2025-01-15T00:00:00Z',
    version,
    account: isElevated
      ? {
          userId: `usr-${role}`,
          isActive: true,
          lastLoginAt: '2026-11-01T09:00:00Z',
          roles: [role],
        }
      : undefined,
  };
}

async function setupProfileRoute(
  page: any,
  initialRole: 'admin' | 'hr_manager' | 'team_lead' | 'staff' = 'staff',
) {
  let profile = createMockProfile(initialRole, 1);

  await page.route(/\/api\/v1\/employees\/me/, async (route: any) => {
    const request = route.request();
    const method = request.method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: profile }),
      });
    } else if (method === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}');
      // Verify version match
      if (payload.version !== profile.version) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Stale version',
            },
          }),
        });
        return;
      }

      profile = {
        ...profile,
        phone: payload.phone ?? null,
        version: profile.version + 1,
        updatedAt: new Date().toISOString(),
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: profile }),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('Issue #22: My Profile UI & Responsive QA', () => {
  test.beforeEach(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const [width, height, label] of REFERENCE_VIEWPORTS) {
    test(`Profile: ${width}x${height} (${label}) responsive check & screenshot`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'desktop',
        'reference viewports are driven from the desktop project',
      );

      await page.setViewportSize({ width, height });
      await setupProfileRoute(page, 'staff');

      await page.addInitScript(() => {
        window.localStorage.setItem('maxr_auth_session', 'staff');
      });

      await page.goto('/profile');

      // Verify profile container is visible
      await expect(page.getByTestId('my-profile-page')).toBeVisible();
      await expect(page.getByTestId('profile-header')).toBeVisible();
      await expect(page.getByTestId('personal-info-card')).toBeVisible();
      await expect(page.getByTestId('employment-info-card')).toBeVisible();

      // No horizontal scroll check across all viewports
      await expectNoHorizontalScroll(page);

      // Verify touch target >= 44x44px for edit button on phone viewports (width < 640px, AGENTS.md §8)
      if (width < 640) {
        const editBtn = page.getByTestId('edit-phone-button');
        await expect(editBtn).toBeVisible();
        const box = await editBtn.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/profile-${width}x${height}-${label}.png`,
        fullPage: true,
      });
    });
  }

  test('All four roles can access their profile; Account section displayed for Admin/HR only', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop multi-role check');

    // 1. Staff
    await setupProfileRoute(page, 'staff');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });
    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByTestId('account-info-card')).toBeHidden();

    // 2. Admin
    await setupProfileRoute(page, 'admin');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'admin');
    });
    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByTestId('account-info-card')).toBeVisible();
    await expect(page.getByText('Account & System Access')).toBeVisible();

    // 3. Team Lead
    await setupProfileRoute(page, 'team_lead');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'team_lead');
    });
    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByTestId('account-info-card')).toBeHidden();

    // 4. HR Manager
    await setupProfileRoute(page, 'hr_manager');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'hr_manager');
    });
    await page.goto('/profile');
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
    await expect(page.getByTestId('account-info-card')).toBeVisible();
  });

  test('Legacy /staff/profile path redirects seamlessly to /profile', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop redirect check');

    await setupProfileRoute(page, 'staff');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/staff/profile');

    // Should redirect to canonical /profile
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('my-profile-page')).toBeVisible();
  });

  test('User can edit phone number and clear phone number (null)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop edit workflow');

    await setupProfileRoute(page, 'staff');
    await page.addInitScript(() => {
      window.localStorage.setItem('maxr_auth_session', 'staff');
    });

    await page.goto('/profile');
    await expect(page.getByTestId('profile-phone-display')).toContainText('+91 98765 43210');

    // 1. Edit Phone
    await page.getByTestId('edit-phone-button').click();
    await expect(page.getByTestId('phone-editor-form')).toBeVisible();

    const input = page.getByTestId('phone-input');
    await input.fill('+91 99887 76655');
    await page.getByTestId('save-phone-button').click();

    // Verify successful update
    await expect(page.getByText('Phone number updated successfully.')).toBeVisible();
    await expect(page.getByTestId('profile-phone-display')).toContainText('+91 99887 76655');

    // 2. Clear Phone (send null)
    await page.getByTestId('edit-phone-button').click();
    await input.fill('');
    await page.getByTestId('save-phone-button').click();

    await expect(page.getByText('Phone number updated successfully.')).toBeVisible();
    await expect(page.getByTestId('profile-phone-display')).toContainText('Not provided');
  });
});
