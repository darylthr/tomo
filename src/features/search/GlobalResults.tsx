import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Source } from '../../shared/model/types';
import { CoverTile } from './CoverTile';
import { retryGlobalSource, startGlobalSearch, useGlobalSearch, type SourceSearch } from './globalSearch';
import styles from './Search.module.css';
import { LangTag, SourceIcon } from './SourceIcon';
import { loadSources, useSources } from './sourcesStore';

/** One row per source, filling in as each source answers (spec §7.5, global search). */
export function GlobalResults({ query }: { query: string }) {
  const { state, sources, limit, error } = useSources();
  const results = useGlobalSearch((s) => (s.query === query ? s.results : null));

  useEffect(() => {
    if (state === 'ready' && sources.length) startGlobalSearch(query, sources, limit);
  }, [query, state, sources, limit]);

  if (state === 'error') {
    return (
      <div className={`${styles.state} ${styles.stateError}`} role="alert">
        <span>{error}</span>
        <button type="button" className={styles.ghost} onClick={() => void loadSources(true)}>
          Retry
        </button>
      </div>
    );
  }
  if (state === 'ready' && !sources.length) {
    return <div className={styles.state}>No sources to search. Install extensions in Suwayomi first.</div>;
  }

  return (
    <>
      {sources.map((s) => (
        <SourceResults key={s.id} source={s} query={query} result={results?.[s.id]} />
      ))}
      <p className={styles.note}>Searching every source installed in Suwayomi. “See all” opens that source.</p>
    </>
  );
}

function SourceResults({ source, query, result }: { source: Source; query: string; result: SourceSearch | undefined }) {
  const status = result?.status ?? 'waiting';
  const found = status === 'done' && result!.items.length > 0;
  return (
    <section className={styles.sourceResults} aria-label={source.name} aria-busy={status === 'waiting' || status === 'searching'}>
      <header className={styles.resultsHead}>
        <span className={styles.resultsName}>
          <SourceIcon source={source} size="sm" />
          <span className={styles.rowTitle}>{source.name}</span>
          <LangTag lang={source.lang} />
        </span>
        {found && (
          <Link
            to={`/search/source/${source.id}?q=${encodeURIComponent(query)}`}
            className={styles.ghost}
            aria-label={`See all from ${source.name}`}
          >
            See all
          </Link>
        )}
      </header>
      {found ? (
        <ul className={styles.hscroll}>
          {result!.items.map((item) => (
            <li key={item.id}>
              <CoverTile item={item} />
            </li>
          ))}
        </ul>
      ) : status === 'done' ? (
        <div className={styles.state}>No results</div>
      ) : status === 'error' ? (
        <div className={`${styles.state} ${styles.stateError}`}>
          <span>Couldn't reach {source.name}</span>
          <button type="button" className={styles.ghost} onClick={() => retryGlobalSource(source.id)}>
            Retry
          </button>
        </div>
      ) : (
        <div className={styles.state}>
          <span className={styles.spinner} aria-hidden="true" />
          Searching…
        </div>
      )}
    </section>
  );
}
