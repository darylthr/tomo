import { expect, test, type Page } from '@playwright/test';
import { mockSuwayomi, seedSettings, type Call } from './mockServer';

const pageImage = (page: Page, n: number, of = 8) => page.getByRole('img', { name: `Page ${n} of ${of}` });
const saved = (calls: Call[]) =>
  calls.filter((c) => c.op === 'UPDATE_CHAPTER').map((c) => c.variables.patch as { lastPageRead?: number; isRead?: boolean });

test('continues the centered book at its saved page', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^(Continue|Start reading)/ }).click();
  await expect(page).toHaveURL(/\/read\/11$/);
  await expect(pageImage(page, 4)).toBeVisible();
});

test('turning a page saves the position to the server', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/read/11');
  await expect(pageImage(page, 4)).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(pageImage(page, 5)).toBeVisible();
  await expect.poll(() => saved(mock.calls)).toContainEqual({ lastPageRead: 4 });
});

test('reaching the last page marks the chapter read', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/read/11');
  await expect(pageImage(page, 4)).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect(pageImage(page, 8)).toBeVisible();
  await expect.poll(() => saved(mock.calls)).toContainEqual({ lastPageRead: 7, isRead: true });
});

test('webtoon mode only keeps nearby pages mounted', async ({ page }) => {
  await seedSettings(page, { reader: { defaultMode: 'webtoon' } });
  const pages = Array.from({ length: 250 }, (_, i) => `/api/v1/manga/1/chapter/11/page/${i}`);
  await mockSuwayomi(page, { FETCH_PAGES: { data: { fetchChapterPages: { pages } } } });
  await page.goto('/read/11');
  await expect(pageImage(page, 4, 250)).toBeVisible();
  expect(await page.getByRole('img', { name: /^Page \d+ of 250$/ }).count()).toBeLessThan(40);
});

test('Back returns to the library', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.getByRole('button', { name: /^(Continue|Start reading)/ }).click();
  await expect(pageImage(page, 4)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('region', { name: 'Selected title' }).getByRole('heading', { name: 'Blue Hour' })).toBeVisible();
});
