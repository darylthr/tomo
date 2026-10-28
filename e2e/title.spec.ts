import { expect, test } from '@playwright/test';
import { mockSuwayomi } from './mockServer';

test('marks a range of chapters read: long-press one row, tap another, Select range', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/title/1');
  const chapters = page.getByRole('list', { name: 'Chapters' });
  await chapters.getByText('Chapter 3: Last Stop').click({ delay: 700 });
  await expect(page.getByRole('status').filter({ hasText: 'selected' })).toHaveText('1 selected');
  await chapters.getByText('Chapter 1: Dusk').click();
  await page.getByRole('button', { name: 'Select range' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'selected' })).toHaveText('3 selected');
  await page.getByRole('button', { name: 'Mark read' }).click();
  await expect.poll(() => mock.calls.filter((c) => c.op === 'UPDATE_CHAPTERS').map((c) => c.variables)).toEqual([
    { ids: [12, 11], patch: { isRead: true } },
  ]);
  await expect(page.getByRole('toolbar', { name: 'Selected chapters' })).toBeHidden();
});
