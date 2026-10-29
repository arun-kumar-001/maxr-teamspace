import { expect, type Page } from '@playwright/test';

/**
 * No horizontal page scroll at any width, and no content cut off by a clipping ancestor.
 * Wide tables are allowed to be wider than the viewport only inside their own scroll container.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, clientWidth, clipped } = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const insideScroller = (el: Element): boolean => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };
    const clipped: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed')
        continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right > viewport + 1 && !insideScroller(el)) {
        clipped.push(
          `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(rect.right)}`,
        );
      }
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: viewport,
      clipped: clipped.slice(0, 5),
    };
  });
  expect(
    scrollWidth,
    `page scrolls horizontally (${scrollWidth} > ${clientWidth})`,
  ).toBeLessThanOrEqual(clientWidth);
  expect(clipped, 'content extends past the viewport outside a scroll container').toEqual([]);
}

export const GALLERY_TABS = [
  'Buttons & Badges',
  'Form Controls',
  'Status & State Cards',
  'DataTable & Modal',
  'Layout & Feedback',
] as const;

export async function openGallery(page: Page): Promise<void> {
  await page.goto('/components');
  await expect(page.getByRole('tablist')).toBeVisible();
}
