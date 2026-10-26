import type {
  BrowseItem,
  Category,
  Chapter,
  ReaderMode,
  Source,
  SourceFilter,
  Title,
  TitleStatus,
  TriState,
} from '../../shared/model/types';
import { resolveUrl } from './config';

type RawMeta = { key: string; value: string };

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
  meta?: RawMeta[] | null;
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
function tomoMeta(raw: { meta?: RawMeta[] | null }) {
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

export type RawSource = {
  id: string;
  name: string;
  displayName: string;
  lang: string;
  iconUrl: string | null;
  supportsLatest: boolean;
  extension: { versionName: string } | null;
};

/** Suwayomi's Local source: the series folders on the home server. */
export const LOCAL_SOURCE_ID = '0';

export function toSource(raw: RawSource): Source {
  const isLocal = raw.id === LOCAL_SOURCE_ID;
  return {
    id: raw.id,
    name: isLocal ? 'Home server' : raw.name || raw.displayName,
    // The Local source reports the placeholder language "localsourcelang".
    lang: isLocal ? '' : raw.lang,
    iconUrl: raw.iconUrl ? resolveUrl(raw.iconUrl) : null,
    supportsLatest: raw.supportsLatest,
    version: isLocal ? '' : (raw.extension?.versionName ?? ''),
    isLocal,
  };
}

export type RawBrowseItem = { id: number; title: string; thumbnailUrl: string | null; inLibrary: boolean; meta?: RawMeta[] | null };

export function toBrowseItem(raw: RawBrowseItem): BrowseItem {
  const meta = tomoMeta(raw);
  return {
    id: raw.id,
    title: meta.title ?? raw.title,
    coverUrl: meta.cover ?? (raw.thumbnailUrl ? resolveUrl(raw.thumbnailUrl) : null),
    inLibrary: raw.inLibrary,
  };
}

export type RawFilter =
  | { type: 'HeaderFilter' | 'SeparatorFilter'; name: string }
  | { type: 'CheckBoxFilter'; name: string; CheckBoxFilterDefault: boolean }
  | { type: 'TriStateFilter'; name: string; TriStateFilterDefault: string }
  | { type: 'SelectFilter'; name: string; values: string[]; SelectFilterDefault: number }
  | { type: 'TextFilter'; name: string; TextFilterDefault: string | null }
  | { type: 'SortFilter'; name: string; values: string[]; SortFilterDefault: { index: number; ascending: boolean } | null }
  | { type: 'GroupFilter'; name: string; filters?: RawFilter[] };

const TRI: Record<string, TriState> = { IGNORE: 'ignore', INCLUDE: 'include', EXCLUDE: 'exclude' };

/** Maps a source's filter list; unknown filter types become separators so positions stay right. */
export function toFilter(raw: RawFilter): SourceFilter {
  switch (raw.type) {
    case 'HeaderFilter':
      return { type: 'header', name: raw.name };
    case 'CheckBoxFilter':
      return { type: 'checkbox', name: raw.name, default: !!raw.CheckBoxFilterDefault };
    case 'TriStateFilter':
      return { type: 'tristate', name: raw.name, default: TRI[raw.TriStateFilterDefault] ?? 'ignore' };
    case 'SelectFilter':
      return { type: 'select', name: raw.name, values: raw.values ?? [], default: raw.SelectFilterDefault ?? 0 };
    case 'TextFilter':
      return { type: 'text', name: raw.name, default: raw.TextFilterDefault ?? '' };
    case 'SortFilter':
      return { type: 'sort', name: raw.name, values: raw.values ?? [], default: raw.SortFilterDefault ?? null };
    case 'GroupFilter':
      return { type: 'group', name: raw.name, filters: (raw.filters ?? []).map(toFilter) };
    default:
      return { type: 'separator', name: (raw as { name?: string }).name ?? '' };
  }
}
