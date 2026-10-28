import { expect, test } from '@playwright/test';
import { mockSuwayomi, seedSettings } from './mockServer';

const selected = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Selected title' });

test('shows the server library on the shelf', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await expect(selected(page).getByRole('heading', { name: 'Blue Hour' })).toBeVisible();
  await expect(page.getByText('1 / 3')).toBeVisible();
  await expect(selected(page).getByText('MangaDex (EN)')).toBeVisible();
});

test('narrows the shelf to a category', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.getByRole('tab', { name: /Reading/ }).click();
  await expect(page.getByText('1 / 1')).toBeVisible();
});

test('moves between books with the keyboard', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await expect(selected(page).getByRole('heading', { name: 'Blue Hour' })).toBeVisible();
  await page.getByRole('group', { name: /Library shelf/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(selected(page).getByRole('heading', { name: 'Kintsugi' })).toBeVisible();
});

test('asks to connect a server when the same address has no Suwayomi', async ({ page }) => {
  await mockSuwayomi(page, { LIBRARY: 502 });
  await page.goto('/');
  await expect(page.getByText('Connect your Suwayomi server to see your library')).toBeVisible();
});

test('explains an unreachable configured server and retries', async ({ page }) => {
  await seedSettings(page, { server: { url: 'http://localhost:4173', configured: true } });
  const mock = await mockSuwayomi(page, { LIBRARY: 502 });
  await page.goto('/');
  await expect(page.getByText("Can't reach your server")).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect.poll(() => mock.calls.filter((c) => c.op === 'LIBRARY').length).toBeGreaterThanOrEqual(2);
});

test('removes several titles at once from the library, starting with a long press', async ({ page }) => {
  await seedSettings(page, { library: { scroll: 'vertical' } });
  const mock = await mockSuwayomi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select titles' })).toHaveCount(0);
  const grid = page.getByRole('list', { name: 'Library' });
  await grid.getByRole('button').first().click({ delay: 700 });
  await grid.getByRole('button').nth(1).click();
  await expect(page.getByRole('status').filter({ hasText: 'selected' })).toHaveText('2 selected');
  await page.getByRole('button', { name: 'Remove selected from library' }).click();
  await page.getByRole('button', { name: 'Remove from library' }).click();
  await expect.poll(() => mock.calls.filter((c) => c.op === 'UPDATE_MANGA').map((c) => c.variables.inLibrary)).toEqual([false, false]);
  await expect(page.getByRole('navigation', { name: 'Selection' })).toBeHidden();
});

test('in the vertical grid a tap opens the title page, whose Back is in the top bar, and the grid returns to that title', async ({ page }) => {
  await seedSettings(page, { library: { scroll: 'vertical' } });
  await mockSuwayomi(page);
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /^Default/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Details and chapters of/ })).toHaveCount(0);
  const tiles = page.getByRole('list', { name: 'Library' }).getByRole('button');
  const name = await tiles.last().getAttribute('aria-label');
  await tiles.last().click();
  await expect(page).toHaveURL(/\/title\/\d+$/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('list', { name: 'Library' }).getByRole('button', { name: name! })).toBeInViewport();
});

test('opening a sheet never scrolls its dialog (the sheet used to show at the top, then slide down)', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^Sort library/ }).waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __scrolls: number[] };
    w.__scrolls = [];
    const tick = () => {
      const dialog = document.querySelector('dialog[open]');
      if (dialog) w.__scrolls.push(dialog.scrollTop + dialog.scrollLeft);
      if (w.__scrolls.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /^Sort library/ }).click();
  await expect(page.getByRole('dialog', { name: 'Sort library' })).toBeVisible();
  await page.waitForTimeout(700);
  const scrolls = await page.evaluate(() => (window as unknown as { __scrolls: number[] }).__scrolls);
  expect(scrolls.length).toBeGreaterThan(5);
  expect(scrolls.every((n) => n === 0)).toBe(true);
});
