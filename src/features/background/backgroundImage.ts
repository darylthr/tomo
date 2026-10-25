import { db } from '../../shared/db/db';
import { useSettings } from '../../shared/settings/store';

const KEY_PREFIX = 'background:';
const MAX_EDGE = 2560;

export class BackgroundImageError extends Error {
  constructor(message = "Couldn't read that image") {
    super(message);
    this.name = 'BackgroundImageError';
  }
}

type Encodable = { width: number; height: number; getContext(type: '2d'): unknown };

function makeCanvas(width: number, height: number): Encodable {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height) as unknown as Encodable;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function encode(canvas: Encodable, type: string): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return (canvas as unknown as OffscreenCanvas).convertToBlob({ type, quality: 0.9 });
  }
  return new Promise((resolve, reject) =>
    (canvas as unknown as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new BackgroundImageError())),
      type,
      0.9,
    ),
  );
}

/** Decodes, downscales to ≤2560px on the long edge, and re-encodes as WebP (JPEG where WebP can't be encoded). */
export async function prepareBackgroundImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new BackgroundImageError();
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) throw new BackgroundImageError();
    ctx.drawImage(bitmap, 0, 0, width, height);
    const webp = await encode(canvas, 'image/webp');
    return webp.type === 'image/webp' ? webp : encode(canvas, 'image/jpeg');
  } finally {
    bitmap.close();
  }
}

/**
 * Stores a new background under a fresh key (so the panel re-renders) and
 * removes the previous one once the new image is safely saved.
 */
export async function saveBackgroundImage(file: Blob): Promise<string> {
  const blob = await prepareBackgroundImage(file);
  const updatedAt = Date.now();
  const key = `${KEY_PREFIX}${updatedAt}`;
  const previous = useSettings.getState().settings.background.imageKey;
  try {
    await db.blobs.put({ key, bytes: await blob.arrayBuffer(), type: blob.type, updatedAt });
  } catch {
    throw new BackgroundImageError("Couldn't save that image");
  }
  useSettings.getState().update({ background: { imageKey: key, enabled: true } });
  if (previous && previous !== key) await db.blobs.delete(previous);
  return key;
}

export async function loadBackgroundImage(key: string): Promise<ImageBitmap | null> {
  const row = await db.blobs.get(key);
  if (!row) return null;
  try {
    return await createImageBitmap(new Blob([row.bytes], { type: row.type }));
  } catch {
    return null;
  }
}

export async function clearBackgroundImage(): Promise<void> {
  const key = useSettings.getState().settings.background.imageKey;
  if (key) await db.blobs.delete(key);
  useSettings.getState().update({ background: { imageKey: null, enabled: false } });
}
