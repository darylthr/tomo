import Dexie, { type EntityTable } from 'dexie';

/** Binary files kept as raw bytes: Safari's private mode can't store Blob objects in IndexedDB. */
export type BlobRow = { key: string; bytes: ArrayBuffer; type: string; updatedAt: number };

export class TomoDB extends Dexie {
  blobs!: EntityTable<BlobRow, 'key'>;

  constructor() {
    super('tomo');
    this.version(1).stores({ blobs: '&key' });
  }
}

export const db = new TomoDB();
