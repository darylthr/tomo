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
    mangas(condition: { inLibrary: true }, order: [{ by: TITLE }]) { nodes { ...TITLE_FIELDS } }
    categories(order: [{ by: ORDER }]) { nodes { id name order } }
  }
`;

export const TITLE = `
  ${TITLE_FIELDS}
  query TITLE($id: Int!) { manga(id: $id) { ...TITLE_FIELDS } }
`;

export const CHAPTERS = `
  ${CHAPTER_FIELDS}
  query CHAPTERS($mangaId: Int!) {
    chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: DESC }]) {
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
