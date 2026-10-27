import { expect, test, type Page } from '@playwright/test';
import { mockSuwayomi } from './mockServer';

/**
 * WCAG contrast between an element's text colour and the background it sits on. A canvas turns any
 * CSS colour (oklab, color-mix, translucent) into pixels, with the text composited over its background.
 */
async function contrastOf(page: Page, selector: string, backgroundSelector: string): Promise<number> {
  return page.evaluate(
    ([sel, bgSel]) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      const paint = (...colours: string[]) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const c of colours) {
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
        }
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const lum = (rgb: number[]) =>
        rgb
          .map((v) => v / 255)
          .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i]!, 0);
      const bgColour = getComputedStyle(document.querySelector(bgSel)!).backgroundColor;
      const fg = lum(paint(bgColour, getComputedStyle(document.querySelector(sel)!).color));
      const bg = lum(paint(bgColour));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    },
    [selector, backgroundSelector] as const,
  );
}

async function openAppearance(page: Page) {
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /^Appearance/ }).click();
}

/** Text on the panel, on a list row, and on the navbar stays readable. */
async function expectReadable(page: Page) {
  expect(await contrastOf(page, 'main h1', 'main')).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('tab', { name: 'Updates' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Updates' })).toBeVisible();
  expect(await contrastOf(page, 'main h1', 'main')).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOf(page, 'main [class*="rowTitle"]', 'main')).toBeGreaterThanOrEqual(4.5);
  expect(await contrastOf(page, 'nav [aria-selected="false"]', 'body')).toBeGreaterThanOrEqual(3);
}

for (const name of ['Tomo Dark', 'GitHub Light', 'Dracula'] as const) {
  test(`${name} keeps panel, list and navbar text readable`, async ({ page }) => {
    await mockSuwayomi(page);
    await page.goto('/updates');
    await openAppearance(page);
    await page.getByRole('radio', { name }).click();
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    await expectReadable(page);
  });
}

test('a custom theme recolours the app and keeps its text readable', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/updates');
  await openAppearance(page);
  await page.getByRole('button', { name: 'New theme' }).click();
  const editor = page.getByRole('dialog', { name: 'My theme' });
  await editor.getByLabel('Background').fill('#f5ecd7');
  await editor.getByLabel('Cards and sheets').fill('#fffaf0');
  await editor.getByLabel('Text', { exact: true }).fill('#3b2f1e');
  await editor.getByRole('button', { name: 'Close theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-scheme', 'light');
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(245, 236, 215)');
  await expectReadable(page);
});

test('the theme survives a reload', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/updates');
  await openAppearance(page);
  await page.getByRole('radio', { name: 'Nord' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(46, 52, 64)');
});
