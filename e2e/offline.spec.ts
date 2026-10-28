import { expect, test } from '@playwright/test';
import { mockSuwayomi } from './mockServer';

// The one spec that lets the service worker run (the config blocks it elsewhere, so mocks stay in charge).
test.use({ serviceWorkers: 'allow' });

test('the app opens from the device when the network is gone', async ({ page, context }) => {
  await mockSuwayomi(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The worker takes control, then the page's own scripts are cached as they load.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Library' })).toBeVisible();
});
