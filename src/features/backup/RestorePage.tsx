import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import list from '../../shared/ui/List.module.css';
import { Page } from '../../shared/ui/Page';
import { useLibrary } from '../library/libraryStore';
import { getRestoreStatus, restoreBackup, validateBackup, type RestoreStatus } from '../server/api';
import { ServerError } from '../server/client';
import styles from './RestorePage.module.css';

type Step =
  | { kind: 'pick' }
  | { kind: 'checking'; file: File }
  | { kind: 'ready'; file: File; missing: { id: string; name: string }[]; checked: boolean }
  | { kind: 'restoring'; file: File; status: RestoreStatus | null }
  | { kind: 'done'; status: RestoreStatus }
  | { kind: 'error'; message: string; file?: File };

const POLL_MS = 1000;
/** Failed status checks in a row before giving up (a restore keeps going on the server). */
const MAX_MISSES = 4;

const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function describe(e: unknown): string {
  if (e instanceof ServerError) return e.kind === 'server' && e.details ? `${e.message}: ${e.details.split('\n')[0]}` : e.message;
  return 'Something went wrong';
}

/** Settings → Library → Restore from backup: sends a Mihon, Tachiyomi or Suwayomi backup to the server, which restores it. */
export function RestorePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const choose = async (file: File) => {
    setStep({ kind: 'checking', file });
    try {
      const missing = await validateBackup(file);
      if (alive.current) setStep({ kind: 'ready', file, missing, checked: true });
    } catch (e) {
      if (!alive.current) return;
      // An older server can't check a backup first; it can still restore it.
      if (e instanceof ServerError && e.kind === 'version') setStep({ kind: 'ready', file, missing: [], checked: false });
      else setStep({ kind: 'error', file, message: `Couldn't read that backup. ${describe(e)}.` });
    }
  };

  const restore = async (file: File) => {
    setStep({ kind: 'restoring', file, status: null });
    let status: RestoreStatus;
    try {
      const started = await restoreBackup(file);
      status = started.status;
      let misses = 0;
      while (alive.current && status.state !== 'success' && status.state !== 'failure') {
        setStep({ kind: 'restoring', file, status });
        await wait(POLL_MS);
        try {
          status = await getRestoreStatus(started.id);
          misses = 0;
        } catch (e) {
          if (++misses >= MAX_MISSES) throw e;
        }
      }
    } catch (e) {
      if (alive.current) setStep({ kind: 'error', file, message: `Couldn't finish the restore. ${describe(e)}.` });
      return;
    }
    if (!alive.current) return;
    if (status.state === 'success') {
      void useLibrary.getState().refresh();
      setStep({ kind: 'done', status });
    } else setStep({ kind: 'error', file, message: 'The server could not restore that backup.' });
  };

  return (
    <Page title="Restore from backup" onBack={() => navigate('/settings/library')}>
      <p className={styles.hint}>
        Bring your library over from Mihon, Tachiyomi or another Suwayomi. Your server does the restoring, so the extensions that
        backup used need to be installed in Suwayomi first.
      </p>

      <input
        ref={input}
        type="file"
        className={styles.file}
        aria-label="Backup file"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void choose(file);
        }}
      />

      {step.kind === 'pick' && (
        <>
          <button type="button" className={styles.primary} onClick={() => input.current?.click()}>
            Choose backup file
          </button>
          <p className={list.note}>
            In Mihon: More → Settings → Data and storage → Create backup. Files end in .tachibk or .proto.gz.
          </p>
        </>
      )}

      {step.kind === 'checking' && (
        <div className={list.state} role="status">
          <span className={list.spinner} aria-hidden="true" />
          Checking {step.file.name}…
        </div>
      )}

      {step.kind === 'ready' && (
        <>
          <div className={styles.card}>
            <p className={styles.fileName}>{step.file.name}</p>
            <p className={styles.fileSize}>{size(step.file.size)}</p>
          </div>
          {!step.checked && (
            <p className={styles.warn} role="status">
              Your server couldn't check this backup first. You can still restore it.
            </p>
          )}
          {step.missing.length > 0 && (
            <div className={styles.card} role="status">
              <p className={styles.warnTitle}>
                {step.missing.length === 1 ? '1 source isn’t' : `${step.missing.length} sources aren’t`} installed on your server
              </p>
              <p className={styles.fileSize}>Their titles will be skipped. Install the extensions in Suwayomi to bring them back.</p>
              <ul className={styles.sources} aria-label="Missing sources">
                {step.missing.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" className={styles.primary} onClick={() => void restore(step.file)}>
            {step.missing.length > 0 ? 'Restore anyway' : 'Restore'}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setStep({ kind: 'pick' })}>
            Choose another file
          </button>
        </>
      )}

      {step.kind === 'restoring' && (
        <div className={styles.card} role="status">
          <p className={styles.fileName}>Restoring {step.file.name}</p>
          <p className={styles.fileSize}>
            {step.status && step.status.total > 0
              ? `${step.status.done.toLocaleString()} of ${step.status.total.toLocaleString()} titles`
              : 'Starting…'}
          </p>
          <progress
            className={styles.progress}
            max={step.status && step.status.total > 0 ? step.status.total : undefined}
            value={step.status && step.status.total > 0 ? step.status.done : undefined}
            aria-label="Restore progress"
          />
          <p className={styles.fileSize}>You can leave this page. The server keeps going.</p>
        </div>
      )}

      {step.kind === 'done' && (
        <>
          <div className={styles.card} role="status">
            <p className={styles.fileName}>Backup restored</p>
            <p className={styles.fileSize}>
              {step.status.total > 0 ? `${step.status.total.toLocaleString()} titles were read from the backup.` : 'Your library is updated.'}
            </p>
          </div>
          <Link to="/" className={styles.primary}>
            Open your library
          </Link>
        </>
      )}

      {step.kind === 'error' && (
        <>
          <div className={`${list.state} ${list.stateError}`} role="alert">
            {step.message}
          </div>
          <button type="button" className={styles.secondary} onClick={() => setStep({ kind: 'pick' })}>
            Try again
          </button>
        </>
      )}
    </Page>
  );
}
