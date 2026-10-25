import type { Chapter } from '../../shared/model/types';
import { fetchChapters, getChapters } from '../server/api';

/** The chapter to open for "Continue": the oldest unread one, or the first chapter to read again. */
export function pickContinueChapter(chapters: Chapter[]): Chapter | null {
  if (!chapters.length) return null;
  const byOrder = [...chapters].sort((a, b) => a.order - b.order);
  return byOrder.find((c) => !c.read) ?? byOrder[0]!;
}

/** Loads chapters for a title, asking the server to fetch them the first time. */
export async function loadChapters(titleId: number): Promise<Chapter[]> {
  const chapters = await getChapters(titleId);
  return chapters.length ? chapters : fetchChapters(titleId);
}
