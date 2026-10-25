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

export type Category = { id: number; name: string; order: number };
