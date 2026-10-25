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
