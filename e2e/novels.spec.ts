import { expect, test, type Page } from '@playwright/test';
import { makeEpub } from '../src/features/novels/testEpub';
import { makePdf } from '../src/features/novels/testPdf';
import { mockDav, mockSuwayomi, seedSettings } from './mockServer';

const files = [
  { path: 'Dune.epub', body: makeEpub({ filler: 90 }) },
  { path: 'Light Novels/Vol 1.epub', body: makeEpub({ title: 'Volume One' }) },
  { path: 'notes.txt', body: new Uint8Array([1]) },
];

test.beforeEach(async ({ page }) => {
  await seedSettings(page, { server: { webdavUrl: '/dav/', configured: true }, library: { scroll: 'vertical' } });
  await mockSuwayomi(page);
  await mockDav(page, files);
});

/** Adds Dune from the file browser and opens it from the library. */
async function openDune(page: Page) {
  await page.goto('/search/files');
  await page.getByRole('button', { name: /^Add Dune to library/ }).click();
  await expect(page.getByRole('button', { name: /^Remove The Test Book from library/ })).toBeVisible();
  await page.goto('/');
  await page.getByRole('list', { name: 'Library' }).getByRole('button', { name: 'The Test Book' }).click();
  await expect(page).toHaveURL(/\/novel\/\d+$/);
  await expect(page.getByText('First paragraph.')).toBeInViewport();
}

test('browses the share and adds a book, which then shows on the shelf with its own title', async ({ page }) => {
  await page.goto('/search/files');
  await expect(page.getByRole('list', { name: 'Folders' }).getByRole('link', { name: 'Light Novels' })).toBeVisible();
  await expect(page.getByText('1 other file is hidden')).toBeInViewport();

  await page.getByRole('list', { name: 'Folders' }).getByRole('link', { name: 'Light Novels' }).click();
  await expect(page.getByRole('heading', { name: 'Light Novels' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add Vol 1 to library/ })).toBeVisible();

  await page.goto('/search/files');
  await page.getByRole('button', { name: /^Add Dune to library/ }).click();
  await expect(page.getByRole('button', { name: /^Remove The Test Book from library/ })).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Library' }).getByRole('button', { name: 'The Test Book' })).toBeVisible();
});

test('the Search tab leads to the share', async ({ page }) => {
  await page.goto('/search');
  await page.getByRole('link', { name: /Home server files/ }).click();
  await expect(page).toHaveURL(/\/search\/files$/);
  await expect(page.getByRole('list', { name: 'Books' })).toBeVisible();
});

/** The first paragraph on the page now showing (the text lives in a shadow root). */
const pageStart = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('[class*="host"]')?.shadowRoot;
    const viewport = root?.querySelector('.viewport');
    if (!root || !viewport) return '';
    const view = viewport.getBoundingClientRect();
    const first = [...root.querySelectorAll('p')].find((p) => {
      const r = p.getBoundingClientRect();
      return r.left >= view.left && r.left < view.right;
    });
    return first?.textContent ?? '';
  });

/** Page turns are animated: wait for the page to stop moving. */
const settled = async (page: Page) => {
  let last = '';
  await expect
    .poll(async () => {
      const now = await pageStart(page);
      const done = now === last;
      last = now;
      return done;
    })
    .toBe(true);
  return last;
};

const controls = (page: Page) => page.locator('[class*="_chrome_"]');

test('turns pages with the keyboard and picks up where it stopped', async ({ page }) => {
  await openDune(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('First paragraph.')).not.toBeInViewport();
  const second = await settled(page);
  expect(second).toContain('Filler paragraph');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('First paragraph.')).toBeInViewport();
  await settled(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => pageStart(page)).toBe(second);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => pageStart(page)).not.toBe(second);
  const third = await settled(page);

  // The position is saved, so the book reopens on the same page.
  await page.waitForTimeout(1200);
  await page.goto('/');
  await page.getByRole('list', { name: 'Library' }).getByRole('button', { name: 'The Test Book' }).click();
  await expect(page.getByText('First paragraph.')).not.toBeInViewport();
  await expect.poll(() => pageStart(page)).toBe(third);
});

test('reloading the reader reopens the book', async ({ page }) => {
  await openDune(page);
  await page.reload();
  await expect(page.getByText('First paragraph.')).toBeInViewport();
});

test('tapping the sides turns the page and the middle shows the controls', async ({ page }) => {
  await openDune(page);
  const { width, height } = page.viewportSize()!;
  const wide = width > 900;
  // On wide windows the page is a centred column, 760px at most.
  const left = wide ? width / 2 - 380 : 0;
  const right = wide ? width / 2 + 380 : width;
  const pageWidth = right - left;
  await page.mouse.click(left + pageWidth * 0.9, height / 2);
  await expect(page.getByText('First paragraph.')).not.toBeInViewport();
  await page.mouse.click(left + pageWidth * 0.1, height / 2);
  await expect(page.getByText('First paragraph.')).toBeInViewport();
  await expect(controls(page)).toHaveCSS('opacity', '0');
  await page.mouse.click(width / 2, height / 2);
  await expect(controls(page)).toHaveCSS('opacity', '1');
});

/** Opens the short book straight from the share, without adding it. */
async function openVolume(page: Page) {
  await page.goto('/search/files?path=Light%20Novels%2F');
  await page.getByRole('button', { name: /^Vol 1/ }).click();
  await expect(page).toHaveURL(/\/novel\/\d+$/);
  await expect(page.getByText('First paragraph.')).toBeInViewport();
}

test('follows a link and jumps by the contents list', async ({ page }) => {
  await openVolume(page);
  await page.getByText('next', { exact: true }).click();
  await expect(page.getByText('Second chapter.')).toBeInViewport();

  // The controls appear on a tap in the middle.
  await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
  await page.getByRole('button', { name: 'Contents' }).click();
  const contents = page.getByRole('dialog', { name: 'Contents' });
  await expect(contents.getByRole('list').getByRole('button')).toHaveCount(3);
  await contents.getByRole('button', { name: 'One', exact: true }).click();
  await expect(page.getByText('First paragraph.')).toBeInViewport();
});

test('changes the text size and the layout from the reading options', async ({ page }) => {
  await openDune(page);
  await page.mouse.click(page.viewportSize()!.width / 2, page.viewportSize()!.height / 2);
  await page.getByRole('button', { name: 'Reading options' }).click();
  const options = page.getByRole('region', { name: 'Reading options' });
  await options.getByRole('radio', { name: 'Scroll' }).click();
  await expect(page.getByRole('button', { name: /^Next: / })).toBeAttached();
  await options.getByRole('radio', { name: 'Pages' }).click();
  await expect(page.getByText('First paragraph.')).toBeInViewport();

  const slider = options.getByRole('slider', { name: 'Text size' });
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuenow', '21');
  await expect(page.getByText('First paragraph.')).toBeInViewport();
});

test('reading to the end of the book says so, and Read again starts over', async ({ page }) => {
  await openVolume(page);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByText('The end of Volume One')).toBeInViewport();
  await page.getByRole('button', { name: 'Read again' }).click();
  await expect(page.getByText('First paragraph.')).toBeInViewport();
});

test('a share that needs a login or is gone shows a message', async ({ page }) => {
  await page.route('**/dav/**', (route) => route.fulfill({ status: 401, body: '' }));
  await page.goto('/search/files');
  await expect(page.getByRole('alert')).toContainText('needs a login');
});

test('without a WebDAV address, the file browser points to Settings', async ({ page }) => {
  await seedSettings(page, { server: { webdavUrl: '', configured: true } });
  await page.goto('/search/files');
  await expect(page.getByText('Add the WebDAV address of your novels in Settings first.')).toBeVisible();
  await page.getByRole('link', { name: 'Server settings' }).click();
  await expect(page.getByLabel('Novels (WebDAV)')).toBeVisible();
});

test('uploads books from the device to the share, renaming one that is already there', async ({ page }) => {
  await page.goto('/search/files');
  await expect(page.getByRole('list', { name: 'Books' })).toBeVisible();
  await page.getByTestId('upload-input').setInputFiles([
    { name: 'Dune.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(makeEpub({ title: 'Second Dune' })) },
    { name: 'Paper.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf(3, 'A Paper')) },
    { name: 'readme.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') },
  ]);
  await expect(page.getByText("2 files weren't").or(page.getByText("readme.txt isn't an EPUB or PDF"))).toBeVisible();
  const books = page.getByRole('list', { name: 'Books' });
  await expect(books.getByText('Dune (2)')).toBeVisible();
  await expect(books.getByText('Paper', { exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Uploads' }).getByText('Uploaded')).toHaveCount(2);
});

test('says when the share does not accept uploads, and offers a retry', async ({ page }) => {
  await page.unroute('**/dav/**');
  await mockDav(page, files, { readOnly: true });
  await page.goto('/search/files');
  await page.getByTestId('upload-input').setInputFiles({ name: 'New.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(makeEpub()) });
  await expect(page.getByRole('alert').filter({ hasText: 'does not accept uploads' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});

test('reads a PDF: opens on page 1, turns pages, and comes back to where it stopped', async ({ page }) => {
  files.push({ path: 'Paper.pdf', body: makePdf(4, 'A Paper') });
  try {
    await page.goto('/search/files');
    await page.getByRole('button', { name: /^Add Paper to library/ }).click();
    await expect(page.getByRole('button', { name: /^Remove A Paper from library/ })).toBeVisible();
    await page.goto('/');
    await page.getByRole('list', { name: 'Library' }).getByRole('button', { name: 'A Paper' }).click();
    await expect(page).toHaveURL(/\/novel\/\d+$/);
    await expect(page.getByRole('img', { name: 'Page 1 of 4' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('img', { name: 'Page 2 of 4' })).toBeVisible();
    await page.keyboard.press('End');
    await expect(page.getByRole('img', { name: 'Page 4 of 4' })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('img', { name: 'Page 3 of 4' })).toBeVisible();

    // Leave and come back: it resumes on page 3.
    await page.goBack();
    await page.getByRole('list', { name: 'Library' }).getByRole('button', { name: 'A Paper' }).click();
    await expect(page.getByRole('img', { name: 'Page 3 of 4' })).toBeVisible();
  } finally {
    files.pop();
  }
});
