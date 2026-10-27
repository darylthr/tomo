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
  // One page at a time, whatever the window (spreads have their own test).
  await seedSettings(page, { reader: { spreads: 'off' } });
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

// A tall manga page (800x1200) on a landscape screen: Screen and Height fit must show all of it.
const TALL_PAGE = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#eee"/></svg>';
for (const fit of ['screen', 'height'] as const) {
  test(`${fit} fit shows the whole of a tall page without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedSettings(page, { reader: { fit } });
    await mockSuwayomi(page);
    await page.route('**/chapter/*/page/*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: TALL_PAGE }));
    await page.goto('/read/11');
    const img = pageImage(page, 4);
    await expect(img).toBeVisible();
    await expect.poll(async () => (await img.boundingBox())?.height).toBeGreaterThan(0);
    const box = (await img.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
  });
}

test.describe('reader upgrade', () => {
  const TALL = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#eee"/></svg>';

  test('shows two pages side by side on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockSuwayomi(page);
    await page.route('**/chapter/*/page/*', (route) => route.fulfill({ contentType: 'image/svg+xml', body: TALL }));
    await page.goto('/read/11');
    await expect(pageImage(page, 4)).toBeVisible();
    await expect(pageImage(page, 5)).toBeVisible();
    await expect(page.getByText('4–5 / 8')).toBeVisible();
  });

  test('double-tap zooms the page', async ({ page }) => {
    await seedSettings(page, { reader: { spreads: 'off' } });
    await mockSuwayomi(page);
    await page.goto('/read/11');
    await expect(pageImage(page, 4)).toBeVisible();
    const box = (await page.locator('[data-reader-surface]').boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await expect.poll(() => page.locator('[data-zoom-layer]').evaluate((el) => (el as HTMLElement).style.transform)).toContain('scale(2.5)');
  });

  test('a page bookmark is saved to the server and listed on the title page', async ({ page }) => {
    await seedSettings(page, { reader: { spreads: 'off' } });
    const mock = await mockSuwayomi(page);
    await page.goto('/read/11');
    await expect(pageImage(page, 4)).toBeVisible();
    await pageImage(page, 4).click({ button: 'right' });
    await page.getByRole('dialog', { name: 'Page 4' }).getByRole('button', { name: 'Bookmark page' }).click();
    await expect.poll(() => mock.calls.filter((c) => c.op === 'SET_MANGA_META').map((c) => c.variables.key)).toEqual(['tomo.bookmarks']);
    const saved = JSON.parse(String(mock.calls.find((c) => c.op === 'SET_MANGA_META')!.variables.value));
    expect(saved).toMatchObject([{ chapterId: 11, page: 3 }]);
  });

  test('the end card shows the next chapter', async ({ page }) => {
    await seedSettings(page, { reader: { spreads: 'off' } });
    await mockSuwayomi(page);
    await page.goto('/read/11');
    await expect(pageImage(page, 4)).toBeVisible();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
    await expect(page.getByText(/^Finished · Ch\./)).toBeVisible();
    await expect(page.getByText(/^Next · Ch\./)).toBeVisible();
  });
});
