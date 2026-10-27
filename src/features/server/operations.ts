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

// Separate from LIBRARY: these fields are newer than some supported servers, and an unknown
// field fails the whole query. Only asked for when the shelf is sorted by one of these dates.
export const LIBRARY_SORT = `
  query LIBRARY_SORT {
    mangas(condition: { inLibrary: true }) {
      nodes { id inLibraryAt lastReadChapter { lastReadAt } latestFetchedChapter { fetchedAt } }
    }
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

// Category ids above 0 are the owner's; 0 is Suwayomi's built-in default.
export const CREATE_CATEGORY = `
  mutation CREATE_CATEGORY($name: String!) { createCategory(input: { name: $name }) { category { id name order } } }
`;

export const RENAME_CATEGORY = `
  mutation RENAME_CATEGORY($id: Int!, $name: String!) {
    updateCategory(input: { id: $id, patch: { name: $name } }) { category { id name } }
  }
`;

/** `position` counts from 1 among the owner's categories. */
export const MOVE_CATEGORY = `
  mutation MOVE_CATEGORY($id: Int!, $position: Int!) {
    updateCategoryOrder(input: { id: $id, position: $position }) { categories { id order } }
  }
`;

export const DELETE_CATEGORY = `
  mutation DELETE_CATEGORY($id: Int!) { deleteCategory(input: { categoryId: $id }) { category { id } } }
`;

export const UPDATE_MANGA_CATEGORIES = `
  mutation UPDATE_MANGA_CATEGORIES($id: Int!, $patch: UpdateMangaCategoriesPatchInput!) {
    updateMangaCategories(input: { id: $id, patch: $patch }) { manga { id categories { nodes { id } } } }
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

const FEED_FIELDS = `
  fragment FEED_FIELDS on ChapterType {
    ...CHAPTER_FIELDS
    fetchedAt
    lastReadAt
    manga { id title thumbnailUrl inLibrary inLibraryAt meta { key value } }
  }
`;

// Filters, not `order:`: older servers don't take the list form of `order`. Sorted on the client.
export const UPDATES = `
  ${CHAPTER_FIELDS}
  ${FEED_FIELDS}
  query UPDATES($since: LongString!) {
    chapters(filter: { inLibrary: { equalTo: true }, fetchedAt: { greaterThan: $since } }) {
      nodes { ...FEED_FIELDS }
    }
  }
`;

export const HISTORY = `
  ${CHAPTER_FIELDS}
  ${FEED_FIELDS}
  query HISTORY($since: LongString!) {
    chapters(filter: { lastReadAt: { greaterThan: $since } }) { nodes { ...FEED_FIELDS } }
  }
`;

export const LAST_UPDATE = `query LAST_UPDATE { lastUpdateTimestamp { timestamp } }`;

// updateLibraryManga and updateStatus exist in old and new servers (newer ones deprecate them).
export const UPDATE_LIBRARY = `mutation UPDATE_LIBRARY { updateLibraryManga(input: {}) { updateStatus { isRunning } } }`;

export const UPDATE_STATUS = `query UPDATE_STATUS { updateStatus { isRunning } }`;

// Server-wide key/value store: Tomo keeps each device's reading time here (`tomo.time.<device>`).
export const GLOBAL_METAS = `query GLOBAL_METAS { metas { nodes { key value } } }`;

export const SET_GLOBAL_META = `
  mutation SET_GLOBAL_META($key: String!, $value: String!) { setGlobalMeta(input: { meta: { key: $key, value: $value } }) { meta { key } } }
`;
