import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const mediaMatches = new Map<string, boolean>();
const mediaListeners = new Map<string, Set<(e: MediaQueryListEvent) => void>>();

/** Make `window.matchMedia(query).matches` return `matches` and notify listeners. */
export function setMatchMedia(query: string, matches: boolean): void {
  mediaMatches.set(query, matches);
  mediaListeners.get(query)?.forEach((cb) => cb({ matches, media: query } as MediaQueryListEvent));
}

window.matchMedia = (query: string): MediaQueryList => {
  const listeners = mediaListeners.get(query) ?? new Set();
  mediaListeners.set(query, listeners);
  return {
    get matches() {
      return mediaMatches.get(query) ?? false;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: (cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeListener: (cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView ??= function () {};

if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

afterEach(() => {
  cleanup();
  mediaMatches.clear();
  localStorage.clear();
});
