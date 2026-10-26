// GraphQL documents for Suwayomi-Server. Field names follow the official WebUI's queries,
// limited to fields available in current stable releases.

const TITLE_FIELDS = `
  fragment TITLE_FIELDS on MangaType {
    id
    title
    thumbnailUrl
    author
    artist
    description
    genre
    status
    unreadCount
    inLibrary
    initialized
    source { displayName }
    chapters { totalCount }
    categories { nodes { id } }
    meta { key value }
  }
`;

const CHAPTER_FIELDS = `
  fragment CHAPTER_FIELDS on ChapterType {
    id
    name
    mangaId
    chapterNumber
    sourceOrder
    isRead
    isBookmarked
    lastPageRead
    pageCount
    uploadDate
    scanlator
  }
`;

export const ABOUT = `query ABOUT { aboutServer { name version } }`;

export const LIBRARY = `
  ${TITLE_FIELDS}
  query LIBRARY {
    mangas(condition: { inLibrary: true }) { nodes { ...TITLE_FIELDS } }
    categories { nodes { id name order } }
  }
`;

export const TITLE = `
  ${TITLE_FIELDS}
  query TITLE($id: Int!) { manga(id: $id) { ...TITLE_FIELDS } }
`;

export const CHAPTERS = `
  ${CHAPTER_FIELDS}
  query CHAPTERS($mangaId: Int!) {
    chapters(condition: { mangaId: $mangaId }) {
      nodes { ...CHAPTER_FIELDS }
    }
  }
`;

export const CHAPTER = `
  ${CHAPTER_FIELDS}
  query CHAPTER($id: Int!) { chapter(id: $id) { ...CHAPTER_FIELDS } }
`;

export const FETCH_CHAPTERS = `
  ${CHAPTER_FIELDS}
  mutation FETCH_CHAPTERS($mangaId: Int!) {
    fetchChapters(input: { mangaId: $mangaId }) { chapters { ...CHAPTER_FIELDS } }
  }
`;

export const FETCH_PAGES = `
  mutation FETCH_PAGES($chapterId: Int!) {
    fetchChapterPages(input: { chapterId: $chapterId }) { pages }
  }
`;

export const UPDATE_CHAPTER = `
  mutation UPDATE_CHAPTER($id: Int!, $patch: UpdateChapterPatchInput!) {
    updateChapter(input: { id: $id, patch: $patch }) { chapter { id isRead lastPageRead } }
  }
`;

export const UPDATE_MANGA = `
  mutation UPDATE_MANGA($id: Int!, $inLibrary: Boolean!) {
    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) { manga { id inLibrary } }
  }
`;

const BROWSE_FIELDS = `
  fragment BROWSE_FIELDS on MangaType {
    id
    title
    thumbnailUrl
    inLibrary
    meta { key value }
  }
`;

export const SOURCES = `
  query SOURCES {
    sources {
      nodes { id name displayName lang iconUrl supportsLatest extension { versionName } }
    }
  }
`;

// Filter fields are aliased per type because `default` has a different type on each.
const FILTER_FIELDS = `
  ... on HeaderFilter { type: __typename name }
  ... on SeparatorFilter { type: __typename name }
  ... on CheckBoxFilter { type: __typename name CheckBoxFilterDefault: default }
  ... on TriStateFilter { type: __typename name TriStateFilterDefault: default }
  ... on SelectFilter { type: __typename name values SelectFilterDefault: default }
  ... on TextFilter { type: __typename name TextFilterDefault: default }
  ... on SortFilter { type: __typename name values SortFilterDefault: default { index ascending } }
`;

/** Groups can nest; three levels covers every keiyoushi source (as the official WebUI does). */
const filtersSelection = (depth: number): string =>
  depth === 0
    ? `filters { ${FILTER_FIELDS} }`
    : `filters { ${FILTER_FIELDS} ... on GroupFilter { type: __typename name ${filtersSelection(depth - 1)} } }`;

export const SOURCE = `
  query SOURCE($id: LongString!) {
    source(id: $id) { id ${filtersSelection(3)} }
  }
`;

export const FETCH_SOURCE_MANGA = `
  ${BROWSE_FIELDS}
  mutation FETCH_SOURCE_MANGA($input: FetchSourceMangaInput!) {
    fetchSourceManga(input: $input) { hasNextPage mangas { ...BROWSE_FIELDS } }
  }
`;

export const SERVER_SETTINGS = `query SERVER_SETTINGS { settings { maxSourcesInParallel } }`;

export const FETCH_MANGA = `
  ${TITLE_FIELDS}
  mutation FETCH_MANGA($id: Int!) { fetchManga(input: { id: $id }) { manga { ...TITLE_FIELDS } } }
`;
