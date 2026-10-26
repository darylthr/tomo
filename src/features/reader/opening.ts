import type { NavigateFunction } from 'react-router-dom';
import type { Title } from '../../shared/model/types';
import { prefersReducedMotion } from '../../shared/ui/useReducedMotion';
import { useUi } from '../../shared/ui/uiStore';

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';

/** Navigates to the reader, remembering where the cover was so the reader can open it like a book. */
export function openBook(navigate: NavigateFunction, title: Pick<Title, 'coverUrl'>, chapterId: number, coverEl: HTMLElement | null) {
  const r = coverEl?.getBoundingClientRect();
  useUi.setState({
    openingFrom:
      r && r.width > 0 && title.coverUrl
        ? { left: r.left, top: r.top, width: r.width, height: r.height, coverUrl: title.coverUrl }
        : null,
  });
  navigate(`/read/${chapterId}`);
}

/** Where a 2:3 page sits when fitted to the screen. */
export function pageRect(vw = window.innerWidth, vh = window.innerHeight) {
  let h = vh;
  let w = h / 1.5;
  if (w > vw) {
    w = vw;
    h = w * 1.5;
  }
  return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
}

type Rect = { left: number; top: number; width: number; height: number };

/**
 * Spec §8: the cover flies from the shelf to the page (560 ms), swings open on its left hinge
 * (0 → −172°, 680 ms from 260 ms) while the backdrop fades in, then the cover fades away.
 * Resolves when done; under reduced motion it is a short cross-fade.
 */
export function playOpening(els: { root: HTMLElement; book: HTMLElement; cover: HTMLElement; backdrop: HTMLElement }, from: Rect): Promise<void> {
  const to = pageRect();
  Object.assign(els.book.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });

  if (prefersReducedMotion()) {
    const a = els.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' });
    return a.finished.then(() => undefined);
  }

  const fromTransform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  const anims = [
    els.backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out', fill: 'both' }),
    els.book.animate([{ transform: fromTransform }, { transform: 'none' }], { duration: 560, easing: EASE, fill: 'both' }),
    els.cover.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-172deg)' }], {
      duration: 680,
      delay: 260,
      easing: EASE,
      fill: 'both',
    }),
    els.cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 880, easing: 'ease-out', fill: 'both' }),
    els.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 1000, easing: 'ease-out', fill: 'forwards' }),
  ];
  return Promise.all(anims.map((a) => a.finished)).then(() => undefined);
}
