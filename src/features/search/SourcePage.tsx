import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { SourceFilter } from '../../shared/model/types';
import { IconBack, IconClose, IconFilter, IconSearch } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { getSourceFilters } from '../server/api';
import { ServerError } from '../server/client';
import { CoverTile } from './CoverTile';
import { FilterSheet } from './FilterSheet';
import { filterChanges, type FilterState } from './filters';
import searchStyles from './Search.module.css';
import { LangTag, SourceIcon } from './SourceIcon';
import styles from './SourcePage.module.css';
import { loadSources, useSources } from './sourcesStore';
import { useBrowse } from './useBrowse';

type Tab = 'popular' | 'latest';

// Each source's filter list and the filters applied to it, for the session.
const filterMemory = new Map<string, { filters: SourceFilter[]; applied: FilterState | null }>();

/** Browse one source: Popular / Latest, a search scoped to it, and its filters (spec §7.5). */
export function SourcePage() {
  const sourceId = useParams().sourceId ?? '';
  return <SourceBrowser key={sourceId} sourceId={sourceId} />;
}

function SourceBrowser({ sourceId }: { sourceId: string }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, sources } = useSources();
  const source = sources.find((s) => s.id === sourceId);

  const query = params.get('q')?.trim() ?? '';
  const tab: Tab = params.get('tab') === 'latest' && source?.supportsLatest !== false ? 'latest' : 'popular';
  const [draft, setDraft] = useState(query);
  // The field follows the applied query when it changes from outside (See all, Clear, Back).
  const [draftFor, setDraftFor] = useState(query);
  if (draftFor !== query) {
    setDraftFor(query);
    setDraft(query);
  }

  const [filters, setFilters] = useState<SourceFilter[] | null>(() => filterMemory.get(sourceId)?.filters ?? null);
  const [applied, setApplied] = useState<FilterState | null>(() => filterMemory.get(sourceId)?.applied ?? null);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const changes = useMemo(() => (filters && applied ? filterChanges(filters, applied) : []), [filters, applied]);
  const searching = !!query || changes.length > 0;
  const browse = useBrowse(
    searching ? { sourceId, mode: 'search', query, filters: changes } : { sourceId, mode: tab },
  );

  useEffect(() => {
    void loadSources();
  }, []);

  const loadFilters = () => {
    setFiltersError(null);
    getSourceFilters(sourceId)
      .then((list) => {
        filterMemory.set(sourceId, { filters: list, applied: filterMemory.get(sourceId)?.applied ?? null });
        setFilters(list);
      })
      .catch((e) => setFiltersError(e instanceof ServerError ? e.message : "Couldn't load this source's filters"));
  };

  const openFilters = () => {
    setSheetOpen(true);
    if (!filters) loadFilters();
  };

  const applyFilters = (next: FilterState) => {
    filterMemory.set(sourceId, { filters: filters ?? [], applied: next });
    setApplied(next);
    setSheetOpen(false);
  };

  const update = (next: { q?: string; tab?: Tab }) => {
    const p = new URLSearchParams();
    if (next.q) p.set('q', next.q);
    if (next.tab === 'latest') p.set('tab', 'latest');
    setParams(p, { replace: true });
  };

  const chooseTab = (next: Tab) => {
    // Popular and Latest ignore the search and filters, as in Mihon.
    filterMemory.set(sourceId, { filters: filters ?? [], applied: null });
    setApplied(null);
    update({ tab: next });
  };

  const back = () => (location.key !== 'default' ? navigate(-1) : navigate('/search'));

  // Infinite scroll, and the scroll position restored when coming back.
  const scroller = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { loadMore, saveScroll, scrollTop, status } = browse;
  const loadMoreRef = useRef(loadMore);
  useLayoutEffect(() => {
    loadMoreRef.current = loadMore;
  });

  const restoredFor = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (restoredFor.current === browse.key || !scroller.current) return;
    restoredFor.current = browse.key;
    scroller.current.scrollTop = scrollTop;
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMoreRef.current(), {
      root: scroller.current,
      rootMargin: '0px 0px 800px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [status]);

  const missing = state === 'ready' && !source;
  const name = source?.name ?? (missing ? 'Unknown source' : '');

  return (
    <section ref={scroller} className={styles.page} aria-label={name || 'Source'} onScroll={(e) => saveScroll(e.currentTarget.scrollTop)}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <button type="button" className={styles.back} aria-label="Back" onClick={back}>
            <IconBack />
          </button>
          {source && <SourceIcon source={source} size="sm" />}
          <h1 className={styles.name}>{name}</h1>
          {source && <LangTag lang={source.lang} />}
        </header>

        {missing ? (
          <div className={searchStyles.state}>This source isn't installed in Suwayomi anymore.</div>
        ) : (
          <>
            <div className={styles.tools}>
              <Segmented
                label="Listing"
                value={searching ? null : tab}
                onChange={chooseTab}
                options={
                  source?.supportsLatest === false
                    ? [{ value: 'popular', label: 'Popular' }]
                    : [
                        { value: 'popular', label: 'Popular' },
                        { value: 'latest', label: 'Latest' },
                      ]
                }
              />
              <form
                className={styles.searchRow}
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  update({ q: draft.trim(), tab });
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              >
                <label className={styles.field}>
                  <IconSearch />
                  <input
                    type="search"
                    placeholder={name ? `Search ${name}` : 'Search'}
                    aria-label={name ? `Search ${name}` : 'Search this source'}
                    enterKeyHint="search"
                    autoComplete="off"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  {draft && (
                    <button
                      type="button"
                      className={styles.clear}
                      aria-label="Clear search"
                      onClick={() => {
                        setDraft('');
                        if (query) update({ tab });
                      }}
                    >
                      <IconClose />
                    </button>
                  )}
                </label>
                <button type="button" className={styles.square} aria-label="Filters" onClick={openFilters}>
                  <IconFilter />
                  {changes.length > 0 && <span className={styles.dot} aria-label={`${changes.length} applied`} />}
                </button>
              </form>
            </div>

            <Listing browse={browse} />
          </>
        )}
        <div ref={sentinel} className={styles.sentinel} />
      </div>

      <FilterSheet
        open={sheetOpen}
        sourceName={name}
        filters={filters}
        error={filtersError}
        applied={applied}
        onApply={applyFilters}
        onRetry={loadFilters}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  );
}

function Listing({ browse }: { browse: ReturnType<typeof useBrowse> }) {
  const { status, items, error, retry } = browse;

  if (status === 'loading') {
    return (
      <ul className={styles.grid} aria-busy="true" aria-label="Loading titles">
        {Array.from({ length: 12 }, (_, i) => (
          <li key={i} className={styles.skeleton} />
        ))}
      </ul>
    );
  }
  if (status === 'error') {
    return (
      <div className={`${searchStyles.state} ${searchStyles.stateError}`} role="alert">
        <span>{error}</span>
        <button type="button" className={searchStyles.ghost} onClick={retry}>
          Retry
        </button>
      </div>
    );
  }
  if (!items.length) return <div className={searchStyles.state}>No titles found</div>;

  return (
    <>
      <ul className={styles.grid} aria-label="Titles">
        {items.map((item) => (
          <li key={item.id}>
            <CoverTile item={item} />
          </li>
        ))}
      </ul>
      {status === 'more' && (
        <div className={styles.more}>
          <span className={searchStyles.spinner} aria-hidden="true" />
          Loading more…
        </div>
      )}
      {status === 'moreError' && (
        <div className={`${searchStyles.state} ${searchStyles.stateError} ${styles.moreError}`} role="alert">
          <span>{error}</span>
          <button type="button" className={searchStyles.ghost} onClick={retry}>
            Retry
          </button>
        </div>
      )}
    </>
  );
}
