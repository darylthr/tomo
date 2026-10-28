import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSettings } from '../../shared/settings/store';
import { IconChevron, IconFolder } from '../../shared/ui/icons';
import list from '../../shared/ui/List.module.css';
import { Thumb } from '../../shared/ui/ListRow';
import { Page } from '../../shared/ui/Page';
import search from '../search/Search.module.css';
import { ServerError } from '../server/client';
import { titleFromPath, useNovels } from './novelsStore';
import { DropZone, UploadButton, UploadList } from './UploadPanel';
import { useUploads } from './uploads';
import { isBook, isPdf, listFolder, type DavEntry } from './webdav';

type Result = { key: string; entries?: DavEntry[]; error?: string };

const parentOf = (path: string) => path.replace(/[^/]+\/$/, '');

const size = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : bytes >= 1e3 ? `${Math.round(bytes / 1e3)} kB` : '');

/** Browse the WebDAV share (`/search/files?path=Folder/`): folders, and the EPUBs and PDFs to read or add to the library. Books can be uploaded here. */
export function FilesPage() {
  const [params] = useSearchParams();
  const path = params.get('path') ?? '';
  const navigate = useNavigate();
  const webdavUrl = useSettings((s) => s.settings.server.webdavUrl);
  const rows = useNovels((s) => s.rows);
  const covers = useNovels((s) => s.covers);
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The listing is for the folder asked for now; until it arrives, the page is loading.
  const key = `${webdavUrl}|${path}|${attempt}`;
  const listing = result?.key === key ? result : null;

  useEffect(() => {
    void useNovels.getState().load();
    if (!webdavUrl) return;
    const abort = new AbortController();
    listFolder(path, abort.signal)
      .then((entries) => setResult({ key, entries }))
      .catch((e) => {
        if (!abort.signal.aborted) setResult({ key, error: e instanceof ServerError ? e.message : "Couldn't read the share" });
      });
    return () => abort.abort();
  }, [key, path, webdavUrl]);

  const entries = useMemo(() => listing?.entries ?? [], [listing]);
  const names = useMemo(() => entries.map((e) => e.name), [entries]);
  const uploads = useUploads(path, names, () => setAttempt((a) => a + 1));

  const back = () => (path ? navigate(`/search/files?path=${encodeURIComponent(parentOf(path))}`) : navigate('/search'));
  const title = path ? path.replace(/\/$/, '').split('/').pop()! : 'Home server files';

  const open = async (file: DavEntry) => {
    const row = await useNovels.getState().ensure(file);
    navigate(`/novel/${row.id}`);
  };

  const toggle = async (file: DavEntry) => {
    setBusy(file.path);
    setProblem(null);
    try {
      const store = useNovels.getState();
      const row = await store.ensure(file);
      if (row.inLibrary) await store.setInLibrary(row.id, false);
      else {
        await store.setInLibrary(row.id, true);
        // Reading the book now gives the shelf its title, author and cover.
        await store.hydrate(row.id);
      }
    } catch (e) {
      setProblem(e instanceof ServerError ? e.message : "Couldn't add that book");
    } finally {
      setBusy(null);
    }
  };

  if (!webdavUrl) {
    return (
      <Page title={title} onBack={back}>
        <div className={list.state}>
          <span>Add the WebDAV address of your novels in Settings first.</span>
          <Link className={list.ghost} to="/settings/server">
            Server settings
          </Link>
        </div>
      </Page>
    );
  }

  const folders = entries.filter((e) => e.isDir);
  const books = entries.filter((e) => !e.isDir && isBook(e.name));
  const others = entries.filter((e) => !e.isDir && !isBook(e.name)).length;

  return (
    <Page title={title} onBack={back} action={<UploadButton onFiles={uploads.add} />}>
      <DropZone folder={path ? title : 'the share'} onFiles={uploads.add} />
      <UploadList items={uploads.items} rejected={uploads.rejected} onRetry={uploads.retry} onDismiss={uploads.dismiss} onClear={uploads.clearFinished} />
      {!listing && (
        <div className={list.group} aria-busy="true" aria-label="Loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className={list.skeletonRow} />
          ))}
        </div>
      )}
      {listing?.error !== undefined && (
        <div className={`${list.state} ${list.stateError}`} role="alert">
          <span>{listing.error}</span>
          <button type="button" className={list.ghost} onClick={() => setAttempt((a) => a + 1)}>
            Retry
          </button>
        </div>
      )}
      {listing?.entries && !folders.length && !books.length && <div className={list.state}>No folders or books here. Upload an EPUB or PDF to start.</div>}

      {folders.length > 0 && (
        <ul className={list.group} aria-label="Folders">
          {folders.map((f) => (
            <li key={f.path}>
              <Link to={`/search/files?path=${encodeURIComponent(f.path)}`} className={list.row}>
                <span className={`${search.icon} ${search.letter} ${search.neutral}`} aria-hidden="true">
                  <IconFolder />
                </span>
                <span className={list.rowText}>
                  <span className={list.rowTitle}>{f.name}</span>
                </span>
                <span className={list.rowSide}>
                  <IconChevron className={list.chevron} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {books.length > 0 && (
        <>
          <div className={list.groupLabel}>
            <span>Books</span>
          </div>
          <ul className={`${list.group} ${list.groupThumbs}`} aria-label="Books">
            {books.map((b) => {
              const row = rows.find((r) => r.path === b.path);
              const name = row?.title ?? titleFromPath(b.path);
              const added = !!row?.inLibrary;
              return (
                <li key={b.path}>
                  <div className={list.feedRow}>
                    <Thumb src={row ? (covers[row.id] ?? null) : null} title={name} />
                    <button type="button" className={list.feedMain} onClick={() => void open(b)}>
                      <span className={list.rowText}>
                        <span className={list.rowTitle}>{name}</span>
                        <span className={list.rowSub}>{[row?.author, size(b.size)].filter(Boolean).join(' · ') || (isPdf(b.name) ? 'PDF' : 'EPUB')}</span>
                      </span>
                    </button>
                    <span className={list.feedActions}>
                      <button
                        type="button"
                        className={list.ghost}
                        aria-pressed={added}
                        aria-label={added ? `Remove ${name} from library` : `Add ${name} to library`}
                        disabled={busy === b.path}
                        onClick={() => void toggle(b)}
                      >
                        {busy === b.path ? 'Adding…' : added ? 'In library' : 'Add'}
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {problem && (
        <p className={list.note} role="alert">
          {problem}
        </p>
      )}
      {others > 0 && <p className={list.note}>{others === 1 ? '1 other file is' : `${others} other files are`} hidden. Only EPUB and PDF books are shown.</p>}
    </Page>
  );
}
