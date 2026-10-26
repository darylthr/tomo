import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { openBook } from '../reader/opening';
import { CategoryBar, type CategoryFilter } from './CategoryBar';
import { loadChapters, pickContinueChapter } from './continueReading';
import { LibraryGrid } from './LibraryGrid';
import styles from './LibraryPage.module.css';
import { useLibrary } from './libraryStore';
import { Shelf } from './shelf/Shelf';
import { TitleInfo } from './TitleInfo';

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className={styles.message} role="status">
      <p className={styles.messageTitle}>{title}</p>
      {children && <div className={styles.messageActions}>{children}</div>}
    </div>
  );
}

export function LibraryPage() {
  const { status, titles, categories, error, load, refresh } = useLibrary();
  const library = useSettings((s) => s.settings.library);
  const serverUrl = useSettings((s) => s.settings.server.url);
  const navigate = useNavigate();
  const openSettings = () => navigate('/settings');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [center, setCenter] = useState(0);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map = new Map<CategoryFilter, number>([['all', titles.length]]);
    for (const t of titles) {
      const ids = t.categoryIds.length ? t.categoryIds : [0];
      for (const id of ids) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [titles]);

  const shown = useMemo(
    () =>
      filter === 'all'
        ? titles
        : titles.filter((t) => (t.categoryIds.length ? t.categoryIds.includes(filter) : filter === 0)),
    [titles, filter],
  );

  const continueReading = async (title: Title, coverEl?: HTMLElement | null) => {
    const cover = coverEl ?? document.querySelector<HTMLElement>(`[data-title-id="${title.id}"] [data-cover]`);
    try {
      const chapter = pickContinueChapter(await loadChapters(title.id));
      if (chapter) openBook(navigate, title, chapter.id, cover);
      else navigate(`/title/${title.id}`);
    } catch {
      navigate(`/title/${title.id}`);
    }
  };

  if (status === 'idle' || status === 'loading') {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.skeleton} aria-label="Loading your library">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (status === 'error' && error) {
    if (!serverUrl && error.kind === 'unreachable') {
      return (
        <Message title="Connect your Suwayomi server to see your library">
          <button type="button" className={styles.button} onClick={openSettings}>
            Open Settings
          </button>
        </Message>
      );
    }
    return (
      <Message title={error.message}>
        <button type="button" className={styles.button} onClick={() => void refresh()}>
          Retry
        </button>
        <button type="button" className={styles.ghost} onClick={openSettings}>
          Server settings
        </button>
      </Message>
    );
  }

  if (!titles.length) return <Message title="Your library is empty. Add titles from Search." />;

  const vertical = library.scroll === 'vertical';
  const lite = library.detail === 'lite';
  const current = shown[Math.min(center, shown.length - 1)];

  return (
    <div className={`${styles.page} ${vertical ? styles.vertical : ''}`}>
      <CategoryBar
        categories={categories}
        counts={counts}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setCenter(0);
        }}
      />
      {vertical ? (
        <LibraryGrid titles={shown} display={library.display} lite={lite} onOpen={(t, el) => void continueReading(t, el)} />
      ) : (
        <>
          <div className={styles.shelfWrap}>
            <Shelf
              key={String(filter)}
              titles={shown}
              display={library.display}
              lite={lite}
              fadeSides={library.fadeSides}
              onCenterChange={setCenter}
              onOpen={(t, el) => void continueReading(t, el)}
            />
            <div className={styles.position} aria-live="off">
              {Math.min(center + 1, shown.length).toLocaleString()} / {shown.length.toLocaleString()}
            </div>
          </div>
          {current && (
            <TitleInfo
              title={current}
              onContinue={() => void continueReading(current)}
              onChapters={() => navigate(`/title/${current.id}`)}
            />
          )}
        </>
      )}
    </div>
  );
}
