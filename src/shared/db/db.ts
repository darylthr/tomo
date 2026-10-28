import Dexie, { type EntityTable } from 'dexie';

/** Binary files kept as raw bytes: Safari's private mode can't store Blob objects in IndexedDB. */
export type BlobRow = { key: string; bytes: ArrayBuffer; type: string; updatedAt: number };

/** A novel on the WebDAV share: its details and where the reader left off. Kept on this device. */
export type NovelRow = {
  id: number;
  /** Path of the file below the share's root; unique. */
  path: string;
  title: string;
  author: string;
  /** Bytes of the file when listed, to spot a changed copy. */
  size: number;
  inLibrary: boolean;
  addedAt: number;
  /** Chapters in the book's reading order (0 until the book has been opened once). */
  spineCount: number;
  /** Where reading stopped: the chapter's index, and how far into it (0 to 1). */
  spine: number;
  fraction: number;
  /** 0 when never opened. */
  lastReadAt: number;
  finished: boolean;
  hasCover: boolean;
};

export class TomoDB extends Dexie {
  blobs!: EntityTable<BlobRow, 'key'>;
  novels!: EntityTable<NovelRow, 'id'>;

  constructor() {
    super('tomo');
    this.version(1).stores({ blobs: '&key' });
    this.version(2).stores({ blobs: '&key', novels: '++id, &path' });
  }
}

export const db = new TomoDB();
