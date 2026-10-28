import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPageReady, preloadPage, whenPagesReady } from './pagePreload';

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

  it('reports a page ready only once it has decoded, and waits for it', async () => {
    let finish!: () => void;
    const Real = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = new Real();
      img.decode = () => new Promise<void>((resolve) => (finish = resolve));
      return img;
    } as unknown as typeof Image);
    const waited = whenPagesReady(['/slow.jpg'], 5000);
    expect(isPageReady('/slow.jpg')).toBe(false);
    finish();
    await waited;
    expect(isPageReady('/slow.jpg')).toBe(true);
  });

  it('stops waiting after the timeout', async () => {
    vi.useFakeTimers();
    const Real = window.Image;
    vi.spyOn(window, 'Image').mockImplementation(function () {
      const img = new Real();
      img.decode = () => new Promise<void>(() => {});
      return img;
    } as unknown as typeof Image);
    const waited = whenPagesReady(['/never.jpg'], 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await waited;
    expect(isPageReady('/never.jpg')).toBe(false);
    vi.useRealTimers();
  });
});
