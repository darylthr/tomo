import 'fake-indexeddb/auto';
import { db } from '../../shared/db/db';
import { useSettings } from '../../shared/settings/store';
import { BackgroundImageError, prepareBackgroundImage, saveBackgroundImage } from './backgroundImage';

const canvases: { width: number; height: number }[] = [];

class FakeOffscreenCanvas {
  constructor(
    public width: number,
    public height: number,
  ) {
    canvases.push(this);
  }
  getContext() {
    return { drawImage() {} };
  }
  async convertToBlob(opts?: { type?: string }) {
    return new Blob(['x'], { type: opts?.type ?? 'image/png' });
  }
}

function stubBitmap(width: number, height: number) {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width, height, close() {} })));
}

beforeEach(async () => {
  canvases.length = 0;
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
  await db.blobs.clear();
  useSettings.getState().reset();
});

afterEach(() => vi.unstubAllGlobals());

describe('prepareBackgroundImage', () => {
  it('downscales a 6000×4000 photo to 2560 on the long edge', async () => {
    stubBitmap(6000, 4000);
    await prepareBackgroundImage(new Blob(['raw']));
    expect(canvases.at(-1)).toMatchObject({ width: 2560, height: 1707 });
  });

  it('keeps a small image at its own size', async () => {
    stubBitmap(1, 1);
    await prepareBackgroundImage(new Blob(['raw']));
    expect(canvases.at(-1)).toMatchObject({ width: 1, height: 1 });
  });

  it('encodes as WebP', async () => {
    stubBitmap(800, 600);
    const blob = await prepareBackgroundImage(new Blob(['raw']));
    expect(blob.type).toBe('image/webp');
  });

  it('rejects an undecodable file with a readable message', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new DOMException('bad'))));
    await expect(prepareBackgroundImage(new Blob(['heic']))).rejects.toThrow(BackgroundImageError);
    await expect(prepareBackgroundImage(new Blob(['heic']))).rejects.toThrow("Couldn't read that image");
  });
});

describe('saveBackgroundImage', () => {
  it('stores the image and turns the background on', async () => {
    stubBitmap(800, 600);
    const key = await saveBackgroundImage(new Blob(['raw']));
    expect(key).toMatch(/^background:/);
    expect(await db.blobs.get(key)).toBeDefined();
    expect(useSettings.getState().settings.background).toMatchObject({ imageKey: key, enabled: true });
  });

  it('gives a replacement image a new key and drops the old one', async () => {
    stubBitmap(800, 600);
    const first = await saveBackgroundImage(new Blob(['first']));
    await new Promise((r) => setTimeout(r, 2));
    const second = await saveBackgroundImage(new Blob(['second']));
    expect(second).not.toBe(first);
    expect(await db.blobs.get(first)).toBeUndefined();
    expect(useSettings.getState().settings.background.imageKey).toBe(second);
  });

  it('leaves the previous image untouched when the new one cannot be read', async () => {
    stubBitmap(800, 600);
    const key = await saveBackgroundImage(new Blob(['first']));
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('bad'))));
    await expect(saveBackgroundImage(new Blob(['broken']))).rejects.toThrow("Couldn't read that image");
    expect(await db.blobs.get(key)).toBeDefined();
    expect(useSettings.getState().settings.background.imageKey).toBe(key);
  });
});
