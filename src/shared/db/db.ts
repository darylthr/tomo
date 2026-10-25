import Dexie, { type EntityTable } from 'dexie';

export type BlobRow = { key: string; blob: Blob; updatedAt: number };

export class TomoDB extends Dexie {
  blobs!: EntityTable<BlobRow, 'key'>;

  constructor() {
    super('tomo');
    this.version(1).stores({ blobs: '&key' });
  }
}

export const db = new TomoDB();
