import { expect, test } from '@playwright/test';
import { GALLERY_TABS, expectNoHorizontalScroll, openGallery } from './helpers';

test.describe('component gallery', () => {
  test('every tab renders without horizontal page scroll', async ({ page }) => {
    await openGallery(page);
    for (const name of GALLERY_TABS) {
      await page.getByRole('tab', { name }).click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  });

  test('tabs are keyboard operable and keep a single tab stop', async ({ page }) => {
    await openGallery(page);
    const first = page.getByRole('tab', { name: GALLERY_TABS[0] });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    const second = page.getByRole('tab', { name: GALLERY_TABS[1] });
    await expect(second).toBeFocused();
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: GALLERY_TABS[4] })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();
  });

  test('table shows cards on phone and a real table from tablet width up', async ({
    page,
  }, info) => {
    await openGallery(page);
    await page.getByRole('tab', { name: 'DataTable & Modal' }).click();
    const cards = page.getByTestId('datatable-mobile-cards');
    const table = page.getByTestId('datatable-desktop-table');
    if (info.project.name === 'phone') {
      await expect(cards).toBeVisible();
      await expect(table).toBeHidden();
    } else {
      await expect(table).toBeVisible();
      await expect(cards).toBeHidden();
      await expect(page.getByRole('table', { name: 'Sample employees' })).toBeVisible();
    }
  });

  test('modal traps focus, closes with Escape and returns focus to its opener', async ({
    page,
  }) => {
    await openGallery(page);
    await page.getByRole('tab', { name: 'DataTable & Modal' }).click();
    const opener = page.getByRole('button', { name: 'Open Modal Sheet' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expectNoHorizontalScroll(page);

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, 'focus escaped the dialog').toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
