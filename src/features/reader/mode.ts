import type { ReaderMode, Title } from '../../shared/model/types';

const LONG_STRIP = /^(long strip|webtoons?|manhwa|manhua)$/i;

/**
 * A reading mode the title itself suggests: the one the metadata job chose, or a long strip
 * for Korean and Chinese comics.
 */
export function preferredMode(title: Pick<Title, 'genres'> & { readingMode?: ReaderMode | null }): ReaderMode | null {
  if (title.readingMode) return title.readingMode;
  return title.genres.some((g) => LONG_STRIP.test(g.trim())) ? 'webtoon' : null;
}
