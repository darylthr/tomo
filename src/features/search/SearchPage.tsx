import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSettings } from '../../shared/settings/store';
import { IconChevron, IconExtensions, IconExternal } from '../../shared/ui/icons';
import { Page } from '../../shared/ui/Page';
import { GlobalResults } from './GlobalResults';
import styles from './Search.module.css';
import { LangTag, SourceIcon } from './SourceIcon';
import { loadSources, useSources } from './sourcesStore';

/** The Search tab: installed sources, or results from every source for the header's query (spec §7.5). */
export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';

  useEffect(() => {
    void loadSources();
  }, []);

  return <Page title={q ? `“${q}”` : 'Search'}>{q ? <GlobalResults query={q} /> : <SourcesHome />}</Page>;
}

function SourcesHome() {
  const { state, sources, error } = useSources();
  const server = useSettings((s) => s.settings.server);
  const webUi = server.webUiUrl || server.url;

  return (
    <>
      <div className={styles.groupLabel}>
        <span>Sources</span>
        <span className={styles.groupHint}>via Suwayomi</span>
      </div>
      {state === 'error' ? (
        <div className={`${styles.state} ${styles.stateError}`} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.ghost} onClick={() => void loadSources(true)}>
            Retry
          </button>
        </div>
      ) : state !== 'ready' ? (
        <div className={styles.group} aria-busy="true" aria-label="Loading sources">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : sources.length === 0 ? (
        <div className={styles.state}>No sources yet. Install extensions in Suwayomi to browse them here.</div>
      ) : (
        <ul className={styles.group} aria-label="Sources">
          {sources.map((s) => (
            <li key={s.id}>
              <Link to={`/search/source/${s.id}`} className={styles.row}>
                <SourceIcon source={s} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{s.name}</span>
                  <span className={styles.rowSub}>{s.isLocal ? 'Local source · your files' : `Extension ${s.version}`}</span>
                </span>
                <span className={styles.rowSide}>
                  <LangTag lang={s.lang} />
                  <IconChevron className={styles.chevron} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.groupLabel}>
        <span>Extensions</span>
      </div>
      <div className={styles.group}>
        {webUi ? (
          <a className={styles.row} href={webUi} target="_blank" rel="noreferrer">
            <ExtensionsIcon />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Manage extensions in Suwayomi</span>
              <span className={styles.rowSub}>Install, update and add repos like keiyoushi's</span>
            </span>
            <span className={styles.rowSide}>
              <IconExternal className={styles.chevron} />
            </span>
          </a>
        ) : (
          <Link className={styles.row} to="/settings">
            <ExtensionsIcon />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Manage extensions in Suwayomi</span>
              <span className={styles.rowSub}>Add Suwayomi's web UI address in Settings first</span>
            </span>
            <span className={styles.rowSide}>
              <IconChevron className={styles.chevron} />
            </span>
          </Link>
        )}
      </div>

      <p className={styles.note}>Use the search icon above to search every source at once.</p>
      <p className={styles.note}>You're responsible for the content you access through your sources.</p>
    </>
  );
}

function ExtensionsIcon() {
  return (
    <span className={`${styles.icon} ${styles.letter} ${styles.neutral}`} aria-hidden="true">
      <IconExtensions />
    </span>
  );
}
