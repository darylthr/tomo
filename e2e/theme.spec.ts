import { expect, test, type Page } from '@playwright/test';

/** WCAG contrast between an element's text color and the background it sits on. */
async function contrastOf(page: Page, selector: string, backgroundSelector: string): Promise<number> {
  return page.evaluate(
    ([sel, bgSel]) => {
      const rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) =>
        [r!, g!, b!]
          .map((v) => v / 255)
          .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i]!, 0);
      const fg = lum(rgb(getComputedStyle(document.querySelector(sel)!).color));
      const bg = lum(rgb(getComputedStyle(document.querySelector(bgSel)!).backgroundColor));
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    },
    [selector, backgroundSelector] as const,
  );
}

async function chooseTheme(page: Page, mode: 'Light' | 'Custom') {
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /^Appearance/ }).click();
  await page.getByRole('radio', { name: mode }).click();
}

for (const mode of ['Light', 'Custom'] as const) {
  test(`${mode} theme keeps panel and settings text readable`, async ({ page }) => {
    // A page with a panel heading (the library itself draws on the shelf, not a panel).
    await page.goto('/updates');
    await chooseTheme(page, mode);
    if (mode === 'Custom') {
      await page.getByLabel('Background color').fill('#ffffff');
      await page.getByLabel('Text color').fill('#000000');
    }
    expect(await contrastOf(page, 'section[aria-label="Theme"] span', 'section[aria-label="Theme"]')).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(page, 'main h1', 'main')).toBeGreaterThanOrEqual(4.5);
    await page.getByRole('tab', { name: 'Updates' }).click();
    expect(await contrastOf(page, 'main h1', 'main')).toBeGreaterThanOrEqual(4.5);
    expect(await contrastOf(page, 'nav [aria-selected="false"]', 'body')).toBeGreaterThanOrEqual(3);
  });
}
