import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from '../reader/ReaderPage.module.css';
import { useNovels } from './novelsStore';
import { isPdf } from './webdav';

const NovelReader = lazy(() => import('./NovelReaderPage').then((m) => ({ default: m.NovelReaderPage })));
const PdfReader = lazy(() => import('./PdfReaderPage').then((m) => ({ default: m.PdfReaderPage })));

/** `/novel/:id`: the reader that suits the file, a PDF or an EPUB. */
export function BookPage() {
  const rowId = Number(useParams().id);
  const loaded = useNovels((s) => s.loaded);
  const row = useNovels((s) => s.rows.find((r) => r.id === rowId));
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    void useNovels.getState().load().finally(() => setAsked(true));
  }, []);

  const waiting = (
    <div className={styles.reader}>
      <div className={styles.message} role="status">
        <p>Opening…</p>
      </div>
    </div>
  );
  if (!loaded && !asked) return waiting;
  return <Suspense fallback={waiting}>{row && isPdf(row.path) ? <PdfReader row={row} /> : <NovelReader />}</Suspense>;
}
