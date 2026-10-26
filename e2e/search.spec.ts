import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockSuwayomi } from './mockServer';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceManga = JSON.parse(
  fs.readFileSync(path.join(here, '..', 'src', 'features', 'server', '__fixtures__', 'source-manga.json'), 'utf8'),
);
const MANGADEX = '2499283573021220255';
const ASURA = '7537715367149829912';
const MANGA_PLUS = '1998944621602463790';

type Input = { source: string; type: string; page: number; query?: string; filters?: unknown[] };
const inputOf = (v: Record<string, unknown>) => v.input as Input;

test('browses a source and opens a title from it', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/search');
  const sources = page.getByRole('list', { name: 'Sources' });
  await expect(sources.getByRole('link')).toHaveCount(4);
  await expect(sources.getByRole('link').first()).toContainText('Home server');

  await sources.getByRole('link', { name: /MangaDex/ }).click();
  await expect(page).toHaveURL(new RegExp(`/search/source/${MANGADEX}$`));
  await expect(page.getByRole('heading', { name: 'MangaDex' })).toBeVisible();
  const titles = page.getByRole('list', { name: 'Titles' });
  await expect(titles.getByRole('link')).toHaveCount(6);
  await expect(titles.getByRole('link', { name: /Blue Hour/ })).toContainText('In library');
  expect(mock.calls.find((c) => c.op === 'FETCH_SOURCE_MANGA')?.variables).toEqual({
    input: { source: MANGADEX, type: 'POPULAR', page: 1 },
  });

  await page.getByRole('radio', { name: 'Latest' }).click();
  await expect.poll(() => mock.calls.filter((c) => c.op === 'FETCH_SOURCE_MANGA').map((c) => inputOf(c.variables).type)).toContain('LATEST');

  await titles.getByRole('link', { name: /The Last Ferry/ }).click();
  await expect(page).toHaveURL(/\/title\/22$/);
});

test('searches every source, shows each answer and retries one that failed', async ({ page }) => {
  let asuraTries = 0;
  await mockSuwayomi(page, {
    FETCH_SOURCE_MANGA: (v: Record<string, unknown>) => {
      const { source } = inputOf(v);
      if (source === ASURA && asuraTries++ === 0) return { data: null, errors: [{ message: 'timeout' }] };
      if (source === MANGA_PLUS) return { data: { fetchSourceManga: { hasNextPage: false, mangas: [] } } };
      return sourceManga;
    },
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search all sources' }).click();
  await page.getByRole('searchbox', { name: 'Search all sources' }).fill('ferry');
  await expect(page).toHaveURL(/\/search\?q=ferry$/);

  const asura = page.getByRole('region', { name: 'Asura Scans' });
  await expect(asura.getByText("Couldn't reach Asura Scans")).toBeVisible();
  await expect(page.getByRole('region', { name: 'MANGA Plus by SHUEISHA' }).getByText('No results')).toBeVisible();
  await expect(page.getByRole('region', { name: 'MangaDex' }).getByRole('link', { name: /Paper Lanterns/ })).toBeVisible();

  await asura.getByRole('button', { name: 'Retry' }).click();
  await expect(asura.getByRole('link', { name: /Paper Lanterns/ })).toBeVisible();
});

test('See all opens the source with the query filled in', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto('/search?q=ferry');
  await page.getByRole('link', { name: 'See all from MangaDex' }).click();
  await expect(page).toHaveURL(new RegExp(`/search/source/${MANGADEX}\\?q=ferry$`));
  await expect(page.getByRole('searchbox', { name: 'Search MangaDex' })).toHaveValue('ferry');
  await expect(page.getByRole('radio', { name: 'Popular' })).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(() => mock.calls.filter((c) => c.op === 'FETCH_SOURCE_MANGA' && inputOf(c.variables).source === MANGADEX).length)
    .toBeGreaterThan(1);
});

test('applies filters to a source', async ({ page }) => {
  const mock = await mockSuwayomi(page);
  await page.goto(`/search/source/${MANGADEX}`);
  await page.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters for MangaDex' });
  await sheet.getByRole('switch', { name: 'Has available chapters' }).click();
  await sheet.getByText('Tags').click();
  await sheet.getByRole('button', { name: 'Romance: any' }).click();
  await sheet.getByRole('button', { name: 'Apply 2 filters' }).click();
  await expect(sheet).toBeHidden();

  await expect
    .poll(() =>
      mock.calls
        .filter((c) => c.op === 'FETCH_SOURCE_MANGA')
        .map((c) => inputOf(c.variables))
        .find((i) => i.type === 'SEARCH'),
    )
    .toEqual({
      source: MANGADEX,
      type: 'SEARCH',
      page: 1,
      query: '',
      filters: [
        { position: 1, checkBoxState: true },
        { position: 6, groupChange: { position: 1, triState: 'INCLUDE' } },
      ],
    });
  await expect(page.getByLabel('2 applied')).toBeVisible();
});
