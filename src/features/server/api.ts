import type { Category, Chapter, Title } from '../../shared/model/types';
import { gql } from './client';
import { resolveUrl } from './config';
import { toCategory, toChapter, toTitle, type RawCategory, type RawChapter, type RawTitle } from './mappers';
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
    categories: data.categories.nodes.map(toCategory).sort((a, b) => a.order - b.order),
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

export async function setInLibrary(titleId: number, inLibrary: boolean): Promise<void> {
  await gql(op.UPDATE_MANGA, { id: titleId, inLibrary });
}
