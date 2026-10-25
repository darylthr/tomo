import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GRADIENT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'gradient.png');

async function pillOffsetFrom(page: Page, tab: string): Promise<number> {
  return page.evaluate((name) => {
    const tabs = document.querySelector('[role="tablist"][class*="tabs"]')!;
    const pill = tabs.querySelector<HTMLElement>('[class*="pill"]')!;
    const ic = [...tabs.querySelectorAll<HTMLElement>('[role="tab"]')]
      .find((t) => t.getAttribute('aria-label') === name)!
      .querySelector<HTMLElement>('[class*="ic"]')!;
    const a = pill.getBoundingClientRect();
    const b = ic.getBoundingClientRect();
    return Math.abs(a.left + a.width / 2 - (b.left + b.width / 2));
  }, tab);
}

test('a deep link selects its tab with the pill under it', async ({ page }) => {
  await page.goto('/history');
  await expect(page.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');
  expect(await pillOffsetFrom(page, 'History')).toBeLessThanOrEqual(2);
});

test('tabs navigate and the pill follows', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Updates' }).click();
  await expect(page).toHaveURL(/\/updates$/);
  await page.getByRole('tab', { name: 'Library' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForTimeout(450);
  expect(await pillOffsetFrom(page, 'Library')).toBeLessThanOrEqual(2);
});

test('the search icon opens a field that searches all sources', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search all sources' }).click();
  const field = page.getByRole('searchbox', { name: 'Search all sources' });
  await expect(field).toBeFocused();
  await field.fill('moon');
  await expect(page).toHaveURL(/\/search\?q=moon$/);
  await expect(page.getByRole('heading', { name: 'Results for "moon"' })).toBeVisible();
});

test('a background image is dithered, fades to black and survives a reload', async ({ page, browserName }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Choose image').setInputFiles(GRADIENT);
  const toggle = page.getByRole('switch', { name: 'Dithered background' });
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Close settings' }).click();

  const canvas = page.locator('main canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  if (browserName === 'chromium') {
    await page.waitForTimeout(300);
    const bottomIsBlack = await canvas.evaluate((el: HTMLCanvasElement) => {
      const img = new Image();
      return new Promise<boolean>((resolve) => {
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = el.width;
          c.height = el.height;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const rows = Math.floor(el.height * 0.1);
          const data = ctx.getImageData(0, el.height - rows, el.width, rows).data;
          for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) return resolve(false);
          resolve(true);
        };
        img.src = el.toDataURL();
      });
    });
    expect(bottomIsBlack).toBe(true);
  }

  await page.reload();
  await expect(page.locator('main canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('switch', { name: 'Dithered background' })).toHaveAttribute('aria-checked', 'true');
});

test('reduced motion makes the pill jump instead of slide', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('tab', { name: 'History' }).click();
  const duration = await page.evaluate(
    () => getComputedStyle(document.querySelector('[role="tablist"][class*="tabs"] [class*="pill"]')!).transitionDuration,
  );
  expect(duration).toBe('0s');
});
