import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconClose } from '../../shared/ui/icons';
import list from '../../shared/ui/List.module.css';
import styles from './Upload.module.css';
import type { Upload } from './uploads';

const ACCEPT = '.epub,.pdf,application/epub+zip,application/pdf';

/** The Upload button: opens the file picker. */
export function UploadButton({ onFiles }: { onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={list.ghost} onClick={() => input.current?.click()}>
        Upload
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        data-testid="upload-input"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          // The same file can be picked again.
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Dropping files anywhere on the page uploads them; the overlay shows while files are dragged over. */
export function DropZone({ folder, onFiles }: { folder: string; onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const handler = useRef(onFiles);
  useEffect(() => {
    handler.current = onFiles;
  });

  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const overHandler = (e: DragEvent) => {
      // Without this the browser opens the dropped file instead.
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      handler.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overHandler);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overHandler);
      window.removeEventListener('drop', drop);
    };
  }, []);

  if (!over) return null;
  return (
    <div className={styles.drop} aria-hidden="true" data-testid="drop-overlay">
      <div className={styles.dropCard}>
        <b>Drop to upload</b>
        <span>to {folder}</span>
      </div>
    </div>
  );
}

/** What is being sent, and how it went. */
export function UploadList({
  items,
  rejected,
  onRetry,
  onDismiss,
  onClear,
}: {
  items: Upload[];
  rejected: string[];
  onRetry: (id: number) => void;
  onDismiss: (id: number) => void;
  onClear: () => void;
}) {
  if (!items.length && !rejected.length) return null;
  const finished = items.some((u) => u.state === 'done');
  return (
    <>
      <div className={list.groupLabel}>
        <span>Uploads</span>
        {(finished || rejected.length > 0) && (
          <button type="button" className={list.ghost} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {items.length > 0 && (
        <ul className={list.group} aria-label="Uploads">
          {items.map((u) => (
            <li key={u.id} className={styles.item} data-state={u.state}>
              <span className={styles.name}>
                <span className={list.rowTitle}>{u.name}</span>
                <span className={list.rowSub} role={u.state === 'failed' ? 'alert' : undefined}>
                  {u.state === 'waiting' && 'Waiting'}
                  {u.state === 'sending' && `Uploading ${Math.round(u.progress * 100)}%`}
                  {u.state === 'done' && 'Uploaded'}
                  {u.state === 'failed' && (u.error ?? 'Failed')}
                </span>
                {(u.state === 'sending' || u.state === 'waiting') && (
                  <span className={styles.bar} role="progressbar" aria-label={`Uploading ${u.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)}>
                    <span style={{ transform: `scaleX(${u.progress})` }} />
                  </span>
                )}
              </span>
              {u.state === 'done' && <IconCheck className={styles.ok} aria-hidden="true" />}
              {u.state === 'failed' && (
                <button type="button" className={list.ghost} onClick={() => onRetry(u.id)}>
                  Retry
                </button>
              )}
              {(u.state === 'failed' || u.state === 'done') && (
                <button type="button" className={styles.dismiss} aria-label={`Dismiss ${u.name}`} onClick={() => onDismiss(u.id)}>
                  <IconClose />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rejected.length > 0 && (
        <p className={list.note} role="alert">
          {rejected.length === 1 ? `${rejected[0]} isn't an EPUB or PDF.` : `${rejected.length} files weren't EPUB or PDF books and were skipped.`}
        </p>
      )}
    </>
  );
}
