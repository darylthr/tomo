import type { MouseEvent } from 'react';
import type { Chapter } from '../model/types';
import list from './List.module.css';

/** "Ch. 42" ("Ch. 10.5"), or the chapter's name when the source gives no number. */
export function chapterLabel(c: Pick<Chapter, 'number' | 'name'>): string {
  return c.number >= 0 ? `Ch. ${c.number}` : c.name;
}

/** A small cover for list rows; the title's first letter when there is no cover. */
export function Thumb({ src, title }: { src: string | null; title: string }) {
  return (
    <span className={list.thumb} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <span className={list.thumbLetter}>{title.trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}

/** The thumbnail in the clicked row, where the book-opening transition starts. */
export function rowThumb(e: MouseEvent<HTMLElement>): HTMLElement | null {
  return e.currentTarget.closest('li')?.querySelector<HTMLElement>(`.${list.thumb}`) ?? null;
}
