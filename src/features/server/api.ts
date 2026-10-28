import type { BrowseMode, BrowsePage, Category, Chapter, FeedEntry, SortInfo, Source, SourceFilter, Title } from '../../shared/model/types';
import { gql, gqlUpload, ServerError } from './client';
import { resolveUrl } from './config';
import {
  epochMs,
  toBrowseItem,
  toCategory,
  toChapter,
  toFeedEntry,
  toFilter,
  toSource,
  toTitle,
  type RawBrowseItem,
  type RawCategory,
  type RawChapter,
  type RawFeedChapter,
  type RawFilter,
  type RawSource,
  type RawTitle,
} from './mappers';
import * as op from './operations';

export async function getAbout(): Promise<{ name: string; version: string }> {
  const data = await gql<{ aboutServer: { name: string; version: string } }>(op.ABOUT);
  return data.aboutServer;
}

export async function getLibrary(): Promise<{ titles: Title[]; categories: Category[] }> {
  const data = await gql<{ mangas: { nodes: RawTitle[] }; categories: { nodes: RawCategory[] } }>(op.LIBRARY);
  return {
    // Sorted here: the server's `order` argument only exists in newer Suwayomi versions.
    titles: data.mangas.nodes.map(toTitle).sort((a, b) => a.title.localeCompare(b.title)),
    // Suwayomi's built-in "Default" (id 0) isn't shown: the shelf has All plus the categories made here.
    categories: data.categories.nodes.filter((c) => c.id !== 0).map(toCategory).sort((a, b) => a.order - b.order),
  };
}

export async function getTitle(id: number): Promise<Title> {
  const data = await gql<{ manga: RawTitle }>(op.TITLE, { id });
  return toTitle(data.manga);
}

const newestFirst = (a: Chapter, b: Chapter) => b.order - a.order;

export async function getChapters(titleId: number): Promise<Chapter[]> {
  const data = await gql<{ chapters: { nodes: RawChapter[] } }>(op.CHAPTERS, { mangaId: titleId });
  return data.chapters.nodes.map(toChapter).sort(newestFirst);
}

type RawSortInfo = {
  id: number;
  inLibraryAt: string;
  lastReadChapter: { lastReadAt: string } | null;
  latestFetchedChapter: { fetchedAt: string } | null;
};

/** Dates for sorting the library: when each title was added, last read, and got its newest chapter. */
export async function getLibrarySortInfo(): Promise<SortInfo> {
  const data = await gql<{ mangas: { nodes: RawSortInfo[] } }>(op.LIBRARY_SORT);
  return new Map(
    data.mangas.nodes.map((n) => [
      n.id,
      {
        addedAt: epochMs(n.inLibraryAt),
        lastReadAt: n.lastReadChapter ? epochMs(n.lastReadChapter.lastReadAt) : 0,
        latestAt: n.latestFetchedChapter ? epochMs(n.latestFetchedChapter.fetchedAt) : 0,
      },
    ]),
  );
}

/** Asks Suwayomi to fetch the chapter list from the source (first open, or refresh). */
export async function fetchChapters(titleId: number): Promise<Chapter[]> {
  const data = await gql<{ fetchChapters: { chapters: RawChapter[] } }>(op.FETCH_CHAPTERS, { mangaId: titleId });
  return data.fetchChapters.chapters.map(toChapter).sort(newestFirst);
}

export async function getChapter(chapterId: number): Promise<Chapter> {
  const data = await gql<{ chapter: RawChapter }>(op.CHAPTER, { id: chapterId });
  return toChapter(data.chapter);
}

export async function getPages(chapterId: number): Promise<string[]> {
  const data = await gql<{ fetchChapterPages: { pages: string[] } }>(op.FETCH_PAGES, { chapterId });
  return data.fetchChapterPages.pages.map((p) => resolveUrl(p));
}

export async function setProgress(chapterId: number, patch: { lastPage?: number; read?: boolean }): Promise<void> {
  const body: { lastPageRead?: number; isRead?: boolean } = {};
  if (patch.lastPage !== undefined) body.lastPageRead = patch.lastPage;
  if (patch.read !== undefined) body.isRead = patch.read;
  // keepalive: saves made as the app is hidden or closed still reach the server.
  await gql(op.UPDATE_CHAPTER, { id: chapterId, patch: body }, { keepalive: true });
}

/** Suwayomi's own chapter bookmark: syncs everywhere and drives "Bookmarked only". */
export async function setChapterBookmark(chapterId: number, bookmarked: boolean): Promise<void> {
  await gql(op.UPDATE_CHAPTER, { id: chapterId, patch: { isBookmarked: bookmarked } });
}

/** Marks several chapters read or unread, or bookmarks them, in one request. Returns the ids that were updated. */
export async function updateChapters(ids: number[], patch: { read?: boolean; bookmarked?: boolean }): Promise<number[]> {
  if (!ids.length) return [];
  const body: { isRead?: boolean; isBookmarked?: boolean } = {};
  if (patch.read !== undefined) body.isRead = patch.read;
  if (patch.bookmarked !== undefined) body.isBookmarked = patch.bookmarked;
  try {
    await gql(op.UPDATE_CHAPTERS, { ids, patch: body });
    return ids;
  } catch (e) {
    // A server without the bulk mutation is asked one chapter at a time.
    if (!(e instanceof ServerError) || e.kind !== 'version') throw e;
  }
  const done: number[] = [];
  for (let i = 0; i < ids.length; i += 6) {
    const batch = ids.slice(i, i + 6);
    const results = await Promise.allSettled(batch.map((id) => gql(op.UPDATE_CHAPTER, { id, patch: body })));
    results.forEach((r, j) => r.status === 'fulfilled' && done.push(batch[j]!));
  }
  return done;
}

export type RestoreState = 'idle' | 'restoring' | 'success' | 'failure';
export type RestoreStatus = { state: RestoreState; done: number; total: number };

type RawRestoreStatus = { state: string; totalManga: number; mangaProgress: number } | null;

function toRestoreStatus(raw: RawRestoreStatus): RestoreStatus {
  if (!raw) return { state: 'idle', done: 0, total: 0 };
  const state: RestoreState = raw.state === 'SUCCESS' ? 'success' : raw.state === 'FAILURE' ? 'failure' : raw.state === 'IDLE' ? 'idle' : 'restoring';
  return { state, done: raw.mangaProgress ?? 0, total: raw.totalManga ?? 0 };
}

/** Sources a Mihon, Tachiyomi or Suwayomi backup uses that this server doesn't have installed. */
export async function validateBackup(file: File): Promise<{ id: string; name: string }[]> {
  const data = await gqlUpload<{ validateBackup: { missingSources: { id: string | number; name: string | null }[] } }>(
    op.VALIDATE_BACKUP,
    'backup',
    file,
  );
  return data.validateBackup.missingSources.map((s) => ({ id: String(s.id), name: s.name || `Source ${s.id}` }));
}

/** Starts restoring a backup on the server; follow it with `getRestoreStatus`. */
export async function restoreBackup(file: File): Promise<{ id: string; status: RestoreStatus }> {
  const data = await gqlUpload<{ restoreBackup: { id: string; status: RawRestoreStatus } }>(op.RESTORE_BACKUP, 'backup', file);
  return { id: data.restoreBackup.id, status: toRestoreStatus(data.restoreBackup.status) };
}

export async function getRestoreStatus(id: string): Promise<RestoreStatus> {
  const data = await gql<{ restoreStatus: RawRestoreStatus }>(op.RESTORE_STATUS, { id });
  return toRestoreStatus(data.restoreStatus);
}

export async function setInLibrary(titleId: number, inLibrary: boolean): Promise<void> {
  await gql(op.UPDATE_MANGA, { id: titleId, inLibrary });
}

export async function createCategory(name: string): Promise<Category> {
  const data = await gql<{ createCategory: { category: RawCategory } }>(op.CREATE_CATEGORY, { name });
  return toCategory(data.createCategory.category);
}

export async function renameCategory(id: number, name: string): Promise<void> {
  await gql(op.RENAME_CATEGORY, { id, name });
}

/** Moves a category to `position` (from 1) in the owner's list, which is the shelf's tab order. */
export async function moveCategory(id: number, position: number): Promise<void> {
  await gql(op.MOVE_CATEGORY, { id, position });
}

/** Deletes a category; its titles stay in the library. */
export async function deleteCategory(id: number): Promise<void> {
  await gql(op.DELETE_CATEGORY, { id });
}

/** Puts a title in exactly these categories. */
export async function setTitleCategories(titleId: number, categoryIds: number[]): Promise<void> {
  const addToCategories = categoryIds.filter((id) => id > 0);
  await gql(op.UPDATE_MANGA_CATEGORIES, { id: titleId, patch: { clearCategories: true, addToCategories } });
}

/** Asks Suwayomi to load a title's details from its source (titles found while browsing). */
export async function fetchTitle(id: number): Promise<Title> {
  const data = await gql<{ fetchManga: { manga: RawTitle } }>(op.FETCH_MANGA, { id });
  return toTitle(data.fetchManga.manga);
}

/** Installed sources: the Local source ("Home server") first, then by name and language. */
export async function getSources(signal?: AbortSignal): Promise<Source[]> {
  const data = await gql<{ sources: { nodes: RawSource[] } }>(op.SOURCES, undefined, { signal });
  return data.sources.nodes
    .map(toSource)
    .sort((a, b) => Number(b.isLocal) - Number(a.isLocal) || a.name.localeCompare(b.name) || a.lang.localeCompare(b.lang));
}

export async function getSourceFilters(sourceId: string, signal?: AbortSignal): Promise<SourceFilter[]> {
  const data = await gql<{ source: { filters: RawFilter[] } }>(op.SOURCE, { id: sourceId }, { signal });
  return data.source.filters.map(toFilter);
}

/** Suwayomi's FilterChangeInput: one changed filter, by position; group children nest. */
export type FilterChange = {
  position: number;
  checkBoxState?: boolean;
  triState?: 'IGNORE' | 'INCLUDE' | 'EXCLUDE';
  selectState?: number;
  textState?: string;
  sortState?: { index: number; ascending: boolean };
  groupChange?: FilterChange;
};

export type BrowseRequest = {
  sourceId: string;
  mode: BrowseMode;
  /** 1-based. */
  page: number;
  query?: string;
  filters?: FilterChange[];
};

export async function browseSource(req: BrowseRequest, signal?: AbortSignal): Promise<BrowsePage> {
  const input: Record<string, unknown> = { source: req.sourceId, type: req.mode.toUpperCase(), page: req.page };
  if (req.mode === 'search') {
    input.query = req.query ?? '';
    if (req.filters?.length) input.filters = req.filters;
  }
  const data = await gql<{ fetchSourceManga: { hasNextPage: boolean; mangas: RawBrowseItem[] } }>(
    op.FETCH_SOURCE_MANGA,
    { input },
    { signal },
  );
  return { items: data.fetchSourceManga.mangas.map(toBrowseItem), hasNextPage: data.fetchSourceManga.hasNextPage };
}

const DEFAULT_PARALLEL_SOURCES = 6;

/** How many sources Suwayomi lets Tomo search at once (its MAX_SOURCES_IN_PARALLEL setting). */
export async function getMaxSourcesInParallel(): Promise<number> {
  try {
    const data = await gql<{ settings: { maxSourcesInParallel?: number | null } }>(op.SERVER_SETTINGS);
    const n = data.settings.maxSourcesInParallel;
    return n && n > 0 ? Math.min(n, 20) : DEFAULT_PARALLEL_SOURCES;
  } catch {
    return DEFAULT_PARALLEL_SOURCES;
  }
}

const newestAtFirst = (a: FeedEntry, b: FeedEntry) => b.at - a.at || b.chapter.order - a.chapter.order;
const asSeconds = (ms: number) => String(Math.floor(ms / 1000));

/** New chapters for library titles found since `sinceMs`, newest first. */
export async function getUpdates(sinceMs: number, signal?: AbortSignal): Promise<FeedEntry[]> {
  const data = await gql<{ chapters: { nodes: RawFeedChapter[] } }>(op.UPDATES, { since: asSeconds(sinceMs) }, { signal });
  return (
    data.chapters.nodes
      // Chapters fetched when a title joined the library are its back catalogue, not news.
      .filter((raw) => epochMs(raw.fetchedAt) > epochMs(raw.manga.inLibraryAt))
      .map((raw) => toFeedEntry(raw, 'updates'))
      // The server's time unit isn't guaranteed, so the window is applied here too.
      .filter((e) => e.at > sinceMs)
      .sort(newestAtFirst)
  );
}

/** Every chapter read since `sinceMs`, most recently read first. */
export async function getHistory(sinceMs: number, signal?: AbortSignal): Promise<FeedEntry[]> {
  const data = await gql<{ chapters: { nodes: RawFeedChapter[] } }>(op.HISTORY, { since: asSeconds(sinceMs) }, { signal });
  return data.chapters.nodes
    .map((raw) => toFeedEntry(raw, 'history'))
    .filter((e) => e.at > sinceMs)
    .sort(newestAtFirst);
}

/** When Suwayomi last checked its library's sources for new chapters (ms; 0 if never). */
export async function getLastUpdateTime(): Promise<number> {
  const data = await gql<{ lastUpdateTimestamp: { timestamp: string } }>(op.LAST_UPDATE);
  return epochMs(data.lastUpdateTimestamp.timestamp);
}

/** Asks Suwayomi to check every library title's source for new chapters. */
export async function startLibraryUpdate(): Promise<{ running: boolean }> {
  const data = await gql<{ updateLibraryManga: { updateStatus: { isRunning: boolean } } }>(op.UPDATE_LIBRARY);
  return { running: data.updateLibraryManga.updateStatus.isRunning };
}

/** Asks Suwayomi to check only the titles in these categories. */
export async function startCategoryUpdate(categories: number[]): Promise<{ running: boolean }> {
  const data = await gql<{ updateCategoryManga: { updateStatus: { isRunning: boolean } } }>(op.UPDATE_CATEGORY, { categories });
  return { running: data.updateCategoryManga.updateStatus.isRunning };
}

export async function isLibraryUpdateRunning(): Promise<boolean> {
  const data = await gql<{ updateStatus: { isRunning: boolean } }>(op.UPDATE_STATUS);
  return data.updateStatus.isRunning;
}

export async function getGlobalMetas(): Promise<{ key: string; value: string }[]> {
  const data = await gql<{ metas: { nodes: { key: string; value: string }[] } }>(op.GLOBAL_METAS);
  return data.metas.nodes;
}

export async function setGlobalMeta(key: string, value: string, keepalive = false): Promise<void> {
  await gql(op.SET_GLOBAL_META, { key, value }, { keepalive });
}

export async function getMangaMeta(id: number): Promise<Record<string, string>> {
  const data = await gql<{ manga: { meta: { key: string; value: string }[] } }>(op.MANGA_META, { id });
  return Object.fromEntries(data.manga.meta.map((m) => [m.key, m.value]));
}

export async function setMangaMeta(id: number, key: string, value: string): Promise<void> {
  await gql(op.SET_MANGA_META, { id, key, value });
}

export async function deleteMangaMeta(id: number, key: string): Promise<void> {
  await gql(op.DELETE_MANGA_META, { id, key });
}
