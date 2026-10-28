export type ReaderMode = 'rtl' | 'ltr' | 'webtoon' | 'vertical';

export type TitleStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';

/** A manga, comic, webtoon or novel as Tomo shows it (server ids from Suwayomi). */
export type Title = {
  id: number;
  title: string;
  coverUrl: string | null;
  author: string;
  artist: string;
  description: string;
  genres: string[];
  status: TitleStatus;
  unread: number;
  chapterCount: number;
  inLibrary: boolean;
  categoryIds: number[];
  sourceName: string;
  initialized: boolean;
  /** From the server's metadata job (Suwayomi manga meta `tomo.*`); null when not matched. */
  logoUrl: string | null;
  bannerUrl: string | null;
  readingMode: ReaderMode | null;
  /** Set for a novel from the WebDAV share (negative id); everything else is from Suwayomi. */
  kind?: 'novel';
};

export type Chapter = {
  id: number;
  titleId: number;
  name: string;
  number: number;
  /** Source order: higher is newer. */
  order: number;
  read: boolean;
  bookmarked: boolean;
  /** Zero-based index of the last page read. */
  lastPage: number;
  pageCount: number;
  uploadedAt: number;
  scanlator: string | null;
};

/** A chapter in the Updates or History list, with the title it belongs to. */
export type FeedEntry = {
  chapter: Chapter;
  title: Pick<Title, 'id' | 'title' | 'coverUrl' | 'inLibrary'>;
  /** ms. Updates: when Suwayomi found the chapter. History: when it was last read. */
  at: number;
};

/** Dates the library query doesn't carry (ms; 0 when unknown), fetched only for the sorts that need them. */
export type SortInfo = Map<number, { addedAt: number; lastReadAt: number; latestAt: number }>;

export type Category = { id: number; name: string; order: number };

/** A Suwayomi source: an installed extension's source, or the Local source ("Home server"). */
export type Source = {
  /** Suwayomi's LongString id, kept as a string. "0" is the Local source. */
  id: string;
  name: string;
  /** Language code from the extension, e.g. "en", "all"; empty for the Local source. */
  lang: string;
  iconUrl: string | null;
  supportsLatest: boolean;
  /** Extension version, e.g. "1.4.12"; empty for the Local source. */
  version: string;
  isLocal: boolean;
};

/** A title as a source lists it while browsing; details load when it opens. */
export type BrowseItem = Pick<Title, 'id' | 'title' | 'coverUrl' | 'inLibrary'>;

export type BrowsePage = { items: BrowseItem[]; hasNextPage: boolean };

export type BrowseMode = 'popular' | 'latest' | 'search';

export type TriState = 'ignore' | 'include' | 'exclude';

export type SortValue = { index: number; ascending: boolean };

/** One entry of a source's filter list, in the order the source gives them. */
export type SourceFilter =
  | { type: 'header'; name: string }
  | { type: 'separator'; name: string }
  | { type: 'checkbox'; name: string; default: boolean }
  | { type: 'tristate'; name: string; default: TriState }
  | { type: 'select'; name: string; values: string[]; default: number }
  | { type: 'text'; name: string; default: string }
  | { type: 'sort'; name: string; values: string[]; default: SortValue | null }
  | { type: 'group'; name: string; filters: SourceFilter[] };
