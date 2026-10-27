import { useState } from 'react';
import { Segmented } from '../../shared/ui/Segmented';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import styles from './PageActions.module.css';
import { useReader } from './readerStore';
import { pageFileName, savePage } from './savePage';

type Props = {
  titleName: string;
  /** Bookmark controls for the chosen page (page bookmarks). */
  bookmark?: (page: number) => React.ReactNode;
};

/** What a long-pressed page offers: save or share it, and bookmark it. In a spread, pick the page. */
export function PageActions({ titleName, bookmark }: Props) {
  const { pageActions, view, layout, mode, pages, chapter, closePageActions } = useReader();
  const [chosen, setChosen] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [openFor, setOpenFor] = useState<number | null>(null);
  if (pageActions !== openFor) {
    setOpenFor(pageActions);
    setChosen(null);
    setState('idle');
  }

  const spread = pageActions !== null ? (layout.find((e) => e.includes(pageActions)) ?? view) : view;
  const page = chosen ?? pageActions ?? 0;
  // On screen, Manga puts the earlier page of a spread on the right.
  const [left, right] = mode === 'rtl' ? [spread[1], spread[0]] : [spread[0], spread[1]];

  const save = async () => {
    const src = pages[page];
    if (!src) return;
    setState('saving');
    try {
      await savePage(src, (type) => pageFileName(titleName, chapter?.number ?? 0, page, type));
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <Sheet open={pageActions !== null} label={`Page ${page + 1}`} title={`Page ${page + 1}`} onClose={closePageActions} closeLabel="Close page actions">
      {spread.length > 1 && left !== undefined && right !== undefined && (
        <div className={styles.row}>
          <Segmented
            label="Which page"
            value={page === left ? 'left' : 'right'}
            onChange={(side) => setChosen(side === 'left' ? left : right)}
            options={[
              { value: 'left', label: 'Left page' },
              { value: 'right', label: 'Right page' },
            ]}
          />
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className={sheet.apply} disabled={state === 'saving'} onClick={() => void save()}>
          {state === 'saving' ? 'Saving…' : 'Save page'}
        </button>
        {bookmark?.(page)}
      </div>
      {state === 'failed' && (
        <p className={styles.error} role="alert">
          Couldn't save this page
        </p>
      )}
    </Sheet>
  );
}
