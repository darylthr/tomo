import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadPage } from './pagePreload';

describe('preloadPage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads and decodes a page once, however often it is asked for', () => {
    const decode = vi.fn(async () => {});
    const made: HTMLImageElement[] = [];
    const Real = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = new Real();
      img.decode = decode;
      made.push(img);
      return img;
    } as unknown as typeof Image);

    preloadPage('/a.jpg');
    preloadPage('/a.jpg');
    expect(made).toHaveLength(1);
    expect(made[0]!.getAttribute('src')).toBe('/a.jpg');
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it('survives a page that cannot be decoded', async () => {
    const Real = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = new Real();
      img.decode = () => Promise.reject(new Error('broken'));
      return img;
    } as unknown as typeof Image);
    expect(() => preloadPage('/broken.jpg')).not.toThrow();
    await Promise.resolve();
  });
});
