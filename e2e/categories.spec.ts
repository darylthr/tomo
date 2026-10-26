import { expect, test } from '@playwright/test';
import { mockSuwayomi } from './mockServer';

test('dragging a category by its handle reorders the shelf tabs', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/settings/categories');
  const list = page.getByRole('list', { name: 'Your categories' });
  await expect(list.getByRole('listitem')).toHaveText([/^Reading/, /^Plan to read/]);

  const handle = page.getByRole('button', { name: 'Move Reading' });
  const box = (await handle.boundingBox())!;
  const rowHeight = (await list.getByRole('listitem').first().boundingBox())!.height;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + rowHeight, { steps: 8 });
  await page.mouse.up();

  await expect.poll(() => mock.calls.filter((c) => c.op === 'MOVE_CATEGORY').map((c) => c.variables)).toEqual([{ id: 1, position: 2 }]);
});

test('Settings leads to the categories page and back', async ({ page }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('link', { name: /^Categories/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});
