import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from '@playwright/test';
import { GALLERY_TABS, expectNoHorizontalScroll, openGallery } from './helpers';

// The nine reference viewports from AGENTS.md section 8.
const VIEWPORTS = [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
] as const;

const OUT = resolve(import.meta.dirname, '../../../e2e-output/screenshots');

test.describe('reference viewports', () => {
  for (const [width, height] of VIEWPORTS) {
    test(`${width}x${height}: no horizontal scroll, screenshot saved`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width, height });
      await openGallery(page);
      for (const name of GALLERY_TABS) {
        await page.getByRole('tab', { name }).click();
        await expectNoHorizontalScroll(page);
        const slug = name.toLowerCase().replace(/[^a-z]+/g, '-');
        await page.screenshot({ path: `${OUT}/${width}x${height}-${slug}.png`, fullPage: true });
      }
    });
  }
});
