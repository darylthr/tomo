import { expect, test } from '@playwright/test';
import { mockSuwayomi } from './mockServer';

const TWO_HOURS_AGO = () => ({ data: { lastUpdateTimestamp: { timestamp: String(Date.now() - 2 * 3_600_000) } } });

test.describe('Updates', () => {
  test('checks sources on app open when the last check is stale, and badges unread chapters', async ({ page }) => {
    const mock = await mockSuwayomi(page, { LAST_UPDATE: TWO_HOURS_AGO });
    await page.goto('/');
    await expect(page.getByRole('tab', { name: 'Updates' })).toContainText('4');
    expect(mock.calls.filter((c) => c.op === 'UPDATE_LIBRARY')).toHaveLength(1);

    await page.getByRole('tab', { name: 'Updates' }).click();
    await expect(page.getByRole('button', { name: /^Blue Hour, Ch. 3,/ })).toBeVisible();
    // Chapters found when Night Tram joined the library are not news.
    await expect(page.getByRole('button', { name: /^Night Tram, Ch. 1,/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Night Tram, Ch. 2,/ })).toBeVisible();
    await expect(page.getByText('Checked when you open Tomo or pull to refresh. No background checks.')).toBeVisible();
  });

  test('skips the check when Suwayomi checked recently, and checks on request', async ({ page }) => {
    const mock = await mockSuwayomi(page);
    await page.goto('/updates');
    await expect(page.getByRole('button', { name: /^Blue Hour, Ch. 3,/ })).toBeVisible();
    expect(mock.calls.filter((c) => c.op === 'UPDATE_LIBRARY')).toHaveLength(0);

    await page.getByRole('button', { name: 'Check for updates' }).click();
    await expect.poll(() => mock.calls.filter((c) => c.op === 'UPDATE_LIBRARY').length).toBe(1);
  });

  test('opens a new chapter in the reader', async ({ page }) => {
    await mockSuwayomi(page);
    await page.goto('/updates');
    await page.getByRole('button', { name: /^Blue Hour, Ch. 3,/ }).click();
    await expect(page).toHaveURL(/\/read\/12$/);
  });

  test('offers a retry when updates fail, without breaking the library', async ({ page }) => {
    await mockSuwayomi(page, { UPDATES: 502 });
    await page.goto('/updates');
    await expect(page.getByRole('alert')).toContainText("Couldn't load updates");
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
    await page.getByRole('tab', { name: 'Library' }).click();
    await expect(page.getByRole('region', { name: 'Selected title' }).getByRole('heading', { name: 'Blue Hour' })).toBeVisible();
  });
});

test.describe('History', () => {
  test('resumes an unfinished chapter', async ({ page }) => {
    await mockSuwayomi(page);
    await page.goto('/history');
    await page.getByRole('button', { name: 'Resume Blue Hour' }).click();
    await expect(page).toHaveURL(/\/read\/12$/);
  });

  test('resumes at the next chapter after a finished one', async ({ page }) => {
    const kintsugi = [
      { id: 21, name: 'Chapter 12', mangaId: 2, chapterNumber: 12, sourceOrder: 12, isRead: true, isBookmarked: false, lastPageRead: 19, pageCount: 20, uploadDate: '0', scanlator: null },
      { id: 22, name: 'Chapter 13', mangaId: 2, chapterNumber: 13, sourceOrder: 13, isRead: false, isBookmarked: false, lastPageRead: 0, pageCount: 0, uploadDate: '0', scanlator: null },
    ];
    await mockSuwayomi(page, { CHAPTERS: { data: { chapters: { nodes: kintsugi } } } });
    await page.goto('/history');
    await page.getByRole('button', { name: 'Resume Kintsugi: Golden Seams' }).click();
    await expect(page).toHaveURL(/\/read\/22$/);
  });

  test('removes a title on this device, and it stays removed', async ({ page }) => {
    await mockSuwayomi(page);
    await page.goto('/history');
    await page.getByRole('button', { name: 'Remove Paper Moon from history' }).click();
    await expect(page.getByRole('button', { name: 'Resume Paper Moon' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Resume Blue Hour' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume Paper Moon' })).toHaveCount(0);
  });

  test('clears all after a second tap', async ({ page }) => {
    await mockSuwayomi(page);
    await page.goto('/history');
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByRole('button', { name: 'Clear history?' }).click();
    await expect(page.getByText('Chapters you read will show up here.')).toBeVisible();
  });
});
