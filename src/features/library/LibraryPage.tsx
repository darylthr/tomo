import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Title } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { IconSort } from '../../shared/ui/icons';
import { Sheet } from '../../shared/ui/Sheet';
import sheetStyles from '../../shared/ui/Sheet.module.css';
import { setInLibrary as setTitleInLibrary } from '../server/api';
import { useUi } from '../../shared/ui/uiStore';
import { novelRowId, novelToTitle, useNovels } from '../novels/novelsStore';
import { openBook } from '../reader/opening';
import { CategoryBar, type CategoryFilter } from './CategoryBar';
import barStyles from './CategoryBar.module.css';
import { loadChapters, pickContinueChapter } from './continueReading';
import { LibraryGrid } from './LibraryGrid';
import styles from './LibraryPage.module.css';
import { useLibrary } from './libraryStore';
import { needsInfo, SORTS, sortTitles } from './librarySort';
import { Shelf } from './shelf/Shelf';
import { SelectionBar } from './SelectionBar';
import { SortSheet } from './SortSheet';
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
  const { status, titles: serverTitles, categories, error, load, refresh, sortInfo: serverSortInfo, sortInfoState, loadSortInfo } = useLibrary();
  const novelRows = useNovels((s) => s.rows);
  const novelCovers = useNovels((s) => s.covers);
  const update = useSettings((s) => s.update);
  const [sorting, setSorting] = useState(false);
  const library = useSettings((s) => s.settings.library);
  const serverUrl = useSettings((s) => s.settings.server.url);
  const navigate = useNavigate();
  const openSettings = () => navigate('/settings');
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [center, setCenter] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void useNovels.getState().load();
  }, [load]);

  // Novels from the WebDAV share stand on the same shelf, after Suwayomi's titles are sorted in with them.
  const titles = useMemo(
    () => [...serverTitles, ...novelRows.filter((n) => n.inLibrary).map((n) => novelToTitle(n, novelCovers[n.id] ?? null))],
    [serverTitles, novelRows, novelCovers],
  );
  const sortInfo = useMemo(() => {
    const info = new Map(serverSortInfo ?? []);
    for (const n of novelRows) info.set(-n.id, { addedAt: n.addedAt, lastReadAt: n.lastReadAt, latestAt: n.addedAt });
    return info;
  }, [serverSortInfo, novelRows]);

  const counts = useMemo(() => {
    const map = new Map<CategoryFilter, number>([['all', titles.length]]);
    for (const t of titles) {
      for (const id of t.categoryIds) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [titles]);

  const { sortBy, sortDescending } = library;
  const wantsInfo = needsInfo(sortBy);
  useEffect(() => {
    if (wantsInfo && status === 'ready' && sortInfoState === 'idle') void loadSortInfo();
  }, [wantsInfo, status, sortInfoState, loadSortInfo]);

  const shown = useMemo(() => {
    const inCategory =
      filter === 'all' ? titles : titles.filter((t) => t.categoryIds.includes(filter));
    return sortTitles(inCategory, sortBy, sortDescending, sortInfo);
  }, [titles, filter, sortBy, sortDescending, sortInfo]);

  const sort = SORTS.find((s) => s.value === sortBy) ?? SORTS[0]!;
  const sortLabel = `${sort.label}, ${sort.directions[sortDescending ? 0 : 1]}`;

  const continueReading = async (title: Title, coverEl?: HTMLElement | null) => {
    if (title.kind === 'novel') {
      useUi.setState({ openingFrom: null });
      navigate(`/novel/${novelRowId(title.id)}`);
      return;
    }
    const cover = coverEl ?? document.querySelector<HTMLElement>(`[data-title-id="${title.id}"] [data-cover]`);
    try {
      const chapter = pickContinueChapter(await loadChapters(title.id));
      if (chapter) openBook(navigate, title, chapter.id, cover);
      else navigate(`/title/${title.id}`);
    } catch {
      navigate(`/title/${title.id}`);
    }
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
    setRemoveError(null);
  };
  const toggleSelected = (t: Title) => {
    setSelecting(true);
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(t.id)) next.add(t.id);
      return next;
    });
  };
  const toggleAll = () => setSelected(selected.size === shown.length ? new Set() : new Set(shown.map((t) => t.id)));

  const removeSelected = async () => {
    setRemoving(true);
    setRemoveError(null);
    const picked = titles.filter((t) => selected.has(t.id));
    const results = await Promise.allSettled(
      picked.map((t) => (t.kind === 'novel' ? useNovels.getState().setInLibrary(novelRowId(t.id), false) : setTitleInLibrary(t.id, false))),
    );
    // The shelf shows what the server says now, whatever happened to individual titles.
    await refresh();
    setRemoving(false);
    const failed = picked.filter((_, i) => results[i]!.status === 'rejected');
    if (!failed.length) return stopSelecting();
    setSelected(new Set(failed.map((t) => t.id)));
    setConfirming(false);
    setRemoveError(`Couldn't remove ${failed.length} ${failed.length === 1 ? 'title' : 'titles'}. They're still selected.`);
  };

  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) stopSelecting();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, confirming]);

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

  // Choosing several titles happens on the grid, whichever way the shelf scrolls.
  const vertical = library.scroll === 'vertical' || selecting;
  const lite = library.detail === 'lite';
  const current = shown[Math.min(center, shown.length - 1)];

  return (
    <div className={`${styles.page} ${vertical ? styles.vertical : ''}`}>
      {selecting ? (
        <SelectionBar count={selected.size} total={shown.length} onCancel={stopSelecting} onToggleAll={toggleAll} onRemove={() => setConfirming(true)} />
      ) : (
      <CategoryBar
        categories={categories}
        counts={counts}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setCenter(0);
        }}
        action={
          <>
            <button type="button" className={barStyles.action} aria-label={`Sort library: ${sortLabel}`} onClick={() => setSorting(true)}>
              <IconSort />
            </button>
          </>
        }
      />
      )}
      {removeError && (
        <p className={styles.removeError} role="alert">
          {removeError}
        </p>
      )}
      <Sheet
        open={confirming}
        label="Remove from library"
        title={`Remove ${selected.size} ${selected.size === 1 ? 'title' : 'titles'}?`}
        closeLabel="Keep them"
        onClose={() => !removing && setConfirming(false)}
        footer={
          <button type="button" className={`${sheetStyles.apply} ${styles.removeButton}`} disabled={removing} onClick={() => void removeSelected()}>
            {removing ? 'Removing…' : 'Remove from library'}
          </button>
        }
      >
        <p className={styles.removeNote}>
          They leave your shelf and categories. Reading progress stays on the server, and you can add them again from Search.
        </p>
      </Sheet>
      <SortSheet
        open={sorting}
        sortBy={sortBy}
        descending={sortDescending}
        unsupported={sortInfoState === 'unsupported'}
        onChange={(by, descending) => {
          update({ library: { sortBy: by, sortDescending: descending } });
          setCenter(0);
        }}
        onClose={() => setSorting(false)}
      />
      {vertical ? (
        <LibraryGrid
          titles={shown}
          display={library.display}
          lite={lite}
          size={library.gridSize}
          showTitles={library.gridTitles}
          showProgress={library.gridProgress}
          onOpen={(t, el) => void continueReading(t, el)}
          onDetails={(t) => navigate(`/title/${t.id}`)}
          selecting={selecting}
          selected={selected}
          onSelect={toggleSelected}
        />
      ) : (
        <>
          <div className={styles.shelfWrap}>
            <Shelf
              key={`${filter}-${sortBy}-${sortDescending}`}
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
