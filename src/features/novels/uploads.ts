import { useCallback, useEffect, useRef, useState } from 'react';
import { ServerError } from '../server/client';
import { isBook, uniqueName, uploadFile } from './webdav';

export type Upload = {
  id: number;
  /** The name on the share (made unique among what is already there). */
  name: string;
  file: File;
  state: 'waiting' | 'sending' | 'done' | 'failed';
  progress: number;
  error?: string;
};

const message = (e: unknown) => (e instanceof ServerError ? (e.details ?? e.message) : "Couldn't upload that file");

/**
 * Sends books to the folder `path` of the share, one at a time.
 * `taken` are the names already in the folder; `onSettled` runs when the queue empties after something was sent.
 */
export function useUploads(path: string, taken: string[], onSettled: () => void) {
  // The queue lives in a ref, so the sending loop always sees the latest; state mirrors it for rendering.
  const queue = useRef<Upload[]>([]);
  const [items, setItems] = useState<Upload[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const next = useRef(1);
  const running = useRef(false);
  const sent = useRef(false);
  const latest = useRef({ path, onSettled });
  useEffect(() => {
    latest.current = { path, onSettled };
  });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const commit = useCallback((change: (all: Upload[]) => Upload[]) => {
    queue.current = change(queue.current);
    setItems(queue.current);
  }, []);
  const patch = useCallback((id: number, change: Partial<Upload>) => commit((all) => all.map((u) => (u.id === id ? { ...u, ...change } : u))), [commit]);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const upload = queue.current.find((u) => u.state === 'waiting');
        if (!upload) break;
        const folder = latest.current.path;
        patch(upload.id, { state: 'sending', progress: 0, error: undefined });
        abort.current = new AbortController();
        try {
          await uploadFile(`${folder}${upload.name}`, upload.file, (progress) => patch(upload.id, { progress }), abort.current.signal);
          sent.current = true;
          patch(upload.id, { state: 'done', progress: 1 });
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          patch(upload.id, { state: 'failed', error: message(e) });
        }
      }
      if (sent.current) {
        sent.current = false;
        latest.current.onSettled();
      }
    } finally {
      running.current = false;
    }
  }, [patch]);

  const add = useCallback(
    (files: File[]) => {
      const books = files.filter((f) => isBook(f.name));
      setRejected(files.filter((f) => !isBook(f.name)).map((f) => f.name));
      if (!books.length) return;
      const names = [...taken, ...queue.current.map((u) => u.name)];
      const made: Upload[] = books.map((file) => {
        const name = uniqueName(file.name, names);
        names.push(name);
        return { id: next.current++, name, file, state: 'waiting', progress: 0 };
      });
      commit((all) => [...all, ...made]);
      void pump();
    },
    [taken, commit, pump],
  );

  const retry = useCallback(
    (id: number) => {
      patch(id, { state: 'waiting', error: undefined });
      void pump();
    },
    [patch, pump],
  );

  const dismiss = useCallback((id: number) => commit((all) => all.filter((u) => u.id !== id)), [commit]);
  const clearFinished = useCallback(() => {
    commit((all) => all.filter((u) => u.state !== 'done'));
    setRejected([]);
  }, [commit]);

  return { items, rejected, add, retry, dismiss, clearFinished };
}
