import type { Category, Chapter, ReaderMode, Title, TitleStatus } from '../../shared/model/types';
import { resolveUrl } from './config';

export type RawTitle = {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  author: string | null;
  artist: string | null;
  description: string | null;
  genre: string[] | null;
  status: string | null;
  unreadCount: number | null;
  inLibrary: boolean;
  initialized: boolean;
  source: { displayName: string } | null;
  chapters: { totalCount: number } | null;
  categories: { nodes: { id: number }[] } | null;
  meta?: { key: string; value: string }[] | null;
};

export type RawChapter = {
  id: number;
  name: string;
  mangaId: number;
  chapterNumber: number;
  sourceOrder: number;
  isRead: boolean;
  isBookmarked: boolean;
  lastPageRead: number;
  pageCount: number;
  uploadDate: string | number;
  scanlator: string | null;
};

export type RawCategory = { id: number; name: string; order: number };

const STATUS: Record<string, TitleStatus> = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  PUBLISHING_FINISHED: 'completed',
  ON_HIATUS: 'hiatus',
  CANCELLED: 'cancelled',
};

const MODES: readonly ReaderMode[] = ['rtl', 'ltr', 'webtoon', 'vertical'];

/**
 * Metadata written by the home server's matcher into Suwayomi manga meta, under `tomo.*` keys:
 * tomo.cover, tomo.logo, tomo.banner (image paths or URLs), tomo.title and tomo.mode.
 */
function tomoMeta(raw: RawTitle) {
  const meta = new Map((raw.meta ?? []).map((m) => [m.key, m.value.trim()] as const));
  const url = (key: string) => {
    const v = meta.get(key);
    return v ? resolveUrl(v) : null;
  };
  const mode = meta.get('tomo.mode') as ReaderMode | undefined;
  return {
    cover: url('tomo.cover'),
    logo: url('tomo.logo'),
    banner: url('tomo.banner'),
    title: meta.get('tomo.title') || null,
    mode: mode && MODES.includes(mode) ? mode : null,
  };
}

export function toTitle(raw: RawTitle): Title {
  const meta = tomoMeta(raw);
  return {
    id: raw.id,
    title: meta.title ?? raw.title,
    coverUrl: meta.cover ?? (raw.thumbnailUrl ? resolveUrl(raw.thumbnailUrl) : null),
    author: raw.author ?? '',
    artist: raw.artist ?? '',
    description: raw.description ?? '',
    genres: raw.genre ?? [],
    status: STATUS[raw.status ?? ''] ?? 'unknown',
    unread: raw.unreadCount ?? 0,
    chapterCount: raw.chapters?.totalCount ?? 0,
    inLibrary: raw.inLibrary,
    categoryIds: raw.categories?.nodes.map((c) => c.id) ?? [],
    sourceName: raw.source?.displayName ?? '',
    initialized: raw.initialized,
    logoUrl: meta.logo,
    bannerUrl: meta.banner,
    readingMode: meta.mode,
  };
}

export function toChapter(raw: RawChapter): Chapter {
  return {
    id: raw.id,
    titleId: raw.mangaId,
    name: raw.name,
    number: raw.chapterNumber,
    order: raw.sourceOrder,
    read: raw.isRead,
    bookmarked: raw.isBookmarked,
    lastPage: raw.lastPageRead,
    pageCount: raw.pageCount,
    uploadedAt: Number(raw.uploadDate) || 0,
    scanlator: raw.scanlator,
  };
}

export function toCategory(raw: RawCategory): Category {
  return { id: raw.id, name: raw.name, order: raw.order };
}
