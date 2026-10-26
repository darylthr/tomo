import type { ReaderMode, Title } from '../../shared/model/types';

const LONG_STRIP = /^(long strip|webtoons?|manhwa|manhua)$/i;

/** A reading mode the title itself suggests (Korean and Chinese comics read as one long strip). */
export function preferredMode(title: Pick<Title, 'genres'>): ReaderMode | null {
  return title.genres.some((g) => LONG_STRIP.test(g.trim())) ? 'webtoon' : null;
}
