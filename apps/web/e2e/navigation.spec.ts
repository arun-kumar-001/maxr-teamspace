import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, openGallery } from './helpers';

test.describe('sidebar navigation', () => {
  test('rail shows labels on keyboard focus and expands from the panel button', async ({
    page,
  }, info) => {
    test.skip(info.project.name === 'phone', 'the side-by-side demo is for wider screens');
    await openGallery(page);
    await page.getByRole('tab', { name: 'Navigation' }).click();
    const rail = page.getByRole('complementary', { name: 'Main' }).nth(1);
    const overview = rail.getByRole('link', { name: 'Overview' });
    await overview.focus();
    await expect(
      page.locator('span[aria-hidden="true"].fixed', { hasText: 'Overview' }),
    ).toBeVisible();

    const expanded = page.getByRole('complementary', { name: 'Main' }).first();
    await expanded.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect(expanded.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('phone drawer opens, traps focus, closes with Escape', async ({ page }) => {
    await openGallery(page);
    await page.getByRole('tab', { name: 'Navigation' }).click();
    const opener = page.getByRole('button', { name: 'Open phone drawer' });
    await opener.click();
    const drawer = page.getByRole('dialog', { name: 'Navigation' });
    await expect(drawer).toBeVisible();
    await expectNoHorizontalScroll(page);
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press('Tab');
      expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
