import { test, expect } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

test.describe('Issue #12: Responsive App Shell & Role Navigation', () => {
  test('desktop/tablet layout renders persistent sidebar, role view and collapse toggle', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'phone', 'desktop & tablet persistent sidebar tests');

    await page.goto('/dashboard');
    await expect(page.getByTestId('app-shell')).toBeVisible();

    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toBeVisible();

    // Brand Identity
    await expect(page.getByText('MAXR Teamspace')).toBeVisible();

    // Staff Navigation items (default seeded session in dev)
    await expect(page.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Leave' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Tasks' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Payslips' })).toBeVisible();

    // Staff Dashboard content with Sample data badge (B2)
    await expect(page.getByTestId('staff-dashboard')).toBeVisible();
    await expect(page.getByText('Sample data').first()).toBeVisible();

    // Collapse to rail and re-expand
    const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' });
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();

    const expandButton = page.getByRole('button', { name: 'Expand sidebar' });
    await expect(expandButton).toBeVisible();
    await expandButton.click();
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('direct navigation to forbidden admin route shows Access Denied for staff', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'phone', 'desktop/tablet denial check');

    await page.goto('/admin/users');
    await expect(page.getByTestId('forbidden-route-container')).toBeVisible();
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('is not authorized to view the requested resource')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('navigation to nonexistent path displays 404 Not Found', async ({ page }) => {
    await page.goto('/some-nonexistent-path-1234');
    await expect(page.getByTestId('not-found-page')).toBeVisible();
    await expect(page.getByText('Page Not Found')).toBeVisible();

    await expectNoHorizontalScroll(page);
  });

  test('phone layout hides persistent sidebar, provides bottom nav and modal drawer', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'phone', 'phone layout test');

    await page.goto('/dashboard');

    // Desktop persistent sidebar must be hidden on mobile
    const desktopSidebar = page.getByTestId('app-sidebar');
    await expect(desktopSidebar).toBeHidden();

    // Mobile bottom nav must be visible
    const bottomNav = page.getByTestId('bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Mobile menu toggle must be visible and at least 44x44px
    const menuToggle = page.getByTestId('mobile-menu-toggle');
    await expect(menuToggle).toBeVisible();
    const toggleBox = await menuToggle.boundingBox();
    expect(toggleBox).not.toBeNull();
    if (toggleBox) {
      expect(toggleBox.width).toBeGreaterThanOrEqual(44);
      expect(toggleBox.height).toBeGreaterThanOrEqual(44);
    }

    // Open mobile drawer
    await menuToggle.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();

    // No horizontal scroll with drawer open
    await expectNoHorizontalScroll(page);

    // Focus trap and close with Escape
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await drawer.evaluate((el) => el.contains(document.activeElement));
      expect(inside, 'focus escaped the drawer').toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuToggle).toBeFocused();

    // Verify touch targets >= 44px
    const attendanceBtn = page.getByTestId('attendance-toggle-button');
    await expect(attendanceBtn).toBeVisible();
    const btnBox = await attendanceBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    if (btnBox) {
      expect(btnBox.height).toBeGreaterThanOrEqual(44);
    }

    await expectNoHorizontalScroll(page);
  });
});
