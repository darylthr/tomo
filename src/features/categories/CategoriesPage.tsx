import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category } from '../../shared/model/types';
import list from '../../shared/ui/List.module.css';
import { Page } from '../../shared/ui/Page';
import { useSettings } from '../../shared/settings/store';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import { Switch } from '../../shared/ui/Switch';
import { useLibrary } from '../library/libraryStore';
import { createCategory, deleteCategory, moveCategory, renameCategory } from '../server/api';
import styles from './CategoriesPage.module.css';

type Editing = { kind: 'new' } | { kind: 'edit'; category: Category; confirmDelete: boolean } | null;

/** Settings → Categories: the owner's categories, which are also the shelf's tabs. */
export function CategoriesPage() {
  const navigate = useNavigate();
  const { categories: all, titles } = useLibrary();
  useEffect(() => {
    void useLibrary.getState().load();
  }, []);

  const categories = all.filter((c) => c.id > 0).sort((a, b) => a.order - b.order);
  const counts = new Map<number, number>();
  for (const t of titles) for (const id of t.categoryIds) counts.set(id, (counts.get(id) ?? 0) + 1);

  const defaultId = useSettings((s) => s.settings.library.defaultCategory);
  const setDefault = (id: number | null) => useSettings.getState().update({ library: { defaultCategory: id } });
  const [editing, setEditing] = useState<Editing>(null);
  // While dragging, the order shown follows the finger; it's sent to the server on release.
  const [draft, setDraft] = useState<number[] | null>(null);
  const shown = draft ? draft.map((id) => categories.find((c) => c.id === id)!).filter(Boolean) : categories;

  const setLocal = (next: Category[]) => useLibrary.setState((s) => ({ categories: [...s.categories.filter((c) => c.id <= 0), ...next] }));
  const sync = (work: Promise<unknown>) => void work.catch(() => {}).finally(() => useLibrary.getState().refresh());

  const move = (id: number, to: number) => {
    const from = categories.findIndex((c) => c.id === id);
    if (from < 0 || to < 0 || to >= categories.length || to === from) return;
    const next = [...categories];
    next.splice(to, 0, ...next.splice(from, 1));
    setLocal(next.map((c, i) => ({ ...c, order: i + 1 })));
    sync(moveCategory(id, to + 1));
  };

  const create = async (name: string) => {
    const category = await createCategory(name);
    setLocal([...categories, category]);
    sync(Promise.resolve());
  };

  const rename = (category: Category, name: string) => {
    setLocal(categories.map((c) => (c.id === category.id ? { ...c, name } : c)));
    sync(renameCategory(category.id, name));
  };

  const remove = (category: Category) => {
    setLocal(categories.filter((c) => c.id !== category.id));
    useLibrary.setState((s) => ({ titles: s.titles.map((t) => ({ ...t, categoryIds: t.categoryIds.filter((id) => id !== category.id) })) }));
    if (category.id === defaultId) setDefault(null);
    sync(deleteCategory(category.id));
  };

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/settings/library'));

  return (
    <Page title="Categories" onBack={back}>
      <p className={styles.hint}>
        The order here is the order of the tabs on your shelf. A title can be in several categories. The default category is the tab your shelf opens on;
        All stays in the bar.
      </p>
      {categories.length === 0 ? (
        <div className={list.state}>No categories yet. Make one for each way you sort your shelf, like To Read, Reading or Paused.</div>
      ) : (
        <ul className={styles.group} aria-label="Your categories">
          {shown.map((c, i) => (
            <CategoryRow
              key={c.id}
              category={c}
              count={counts.get(c.id) ?? 0}
              isDefault={c.id === defaultId}
              index={i}
              total={shown.length}
              onDraft={(to) => {
                const ids = categories.map((x) => x.id).filter((id) => id !== c.id);
                ids.splice(to, 0, c.id);
                setDraft(ids);
              }}
              onDrop={(to) => {
                setDraft(null);
                move(c.id, to);
              }}
              onMove={(to) => move(c.id, to)}
              onOptions={() => setEditing({ kind: 'edit', category: c, confirmDelete: false })}
            />
          ))}
        </ul>
      )}
      <button type="button" className={styles.add} onClick={() => setEditing({ kind: 'new' })}>
        New category
      </button>

      <NameSheet
        editing={editing}
        taken={(name, except) => categories.some((c) => c.id !== except && c.name.trim().toLowerCase() === name.toLowerCase())}
        count={editing?.kind === 'edit' ? (counts.get(editing.category.id) ?? 0) : 0}
        isDefault={editing?.kind === 'edit' && editing.category.id === defaultId}
        onDefault={(on) => editing?.kind === 'edit' && setDefault(on ? editing.category.id : null)}
        onCreate={create}
        onRename={rename}
        onDelete={remove}
        onConfirmDelete={() => setEditing((e) => (e?.kind === 'edit' ? { ...e, confirmDelete: true } : e))}
        onClose={() => setEditing(null)}
      />
    </Page>
  );
}

type RowProps = {
  category: Category;
  count: number;
  isDefault: boolean;
  index: number;
  total: number;
  onDraft: (to: number) => void;
  /** `to` comes from the drag itself: a re-render may not have landed between pointer events. */
  onDrop: (to: number) => void;
  onMove: (to: number) => void;
  onOptions: () => void;
};

function CategoryRow({ category, count, isDefault, index, total, onDraft, onDrop, onMove, onOptions }: RowProps) {
  const drag = useRef<{ startY: number; startIndex: number; rowHeight: number; to: number } | null>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [held, setHeld] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const row = e.currentTarget.closest('li');
    if (!row) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startIndex: index, rowHeight: row.getBoundingClientRect().height, to: index };
    setHeld(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const to = Math.max(0, Math.min(total - 1, d.startIndex + Math.round((e.clientY - d.startY) / d.rowHeight)));
    if (to === d.to) return;
    d.to = to;
    onDraft(to);
  };
  const release = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setHeld(false);
    // A cancelled drag (the system took the touch) puts the row back.
    onDrop(commit ? d.to : d.startIndex);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
    if (to === null) return;
    e.preventDefault();
    onMove(to);
    // The row re-renders in its new place; keep focus on its handle.
    requestAnimationFrame(() => handleRef.current?.focus());
  };

  return (
    <li className={`${styles.row} ${held ? styles.held : ''}`}>
      <button
        ref={handleRef}
        type="button"
        className={styles.handle}
        aria-label={`Move ${category.name}`}
        aria-description="Drag, or use the up and down arrow keys"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => release(true)}
        onPointerCancel={() => release(false)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />))}
        </svg>
      </button>
      <span className={styles.name}>
        {category.name}
        {isDefault && <span className={styles.defaultTag}>Default</span>}
      </span>
      <span className={styles.count}>{count}</span>
      <button type="button" className={styles.more} aria-label={`Options for ${category.name}`} onClick={onOptions}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {[6, 12, 18].map((x) => (
            <circle key={x} cx={x} cy={12} r={1.8} />
          ))}
        </svg>
      </button>
    </li>
  );
}

type SheetProps = {
  editing: Editing;
  taken: (name: string, except?: number) => boolean;
  count: number;
  isDefault: boolean;
  onDefault: (on: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (category: Category, name: string) => void;
  onDelete: (category: Category) => void;
  onConfirmDelete: () => void;
  onClose: () => void;
};

/** New category, or rename and delete one. */
function NameSheet({ editing, taken, count, isDefault, onDefault, onCreate, onRename, onDelete, onConfirmDelete, onClose }: SheetProps) {
  // Kept while the sheet animates out, so its content doesn't vanish mid-exit.
  const [last, setLast] = useState<Exclude<Editing, null>>({ kind: 'new' });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // A fresh field each time the sheet opens for something else; confirming a delete keeps it.
  const key = editing ? (editing.kind === 'edit' ? `edit-${editing.category.id}` : 'new') : null;
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (openKey !== key) {
    setOpenKey(key);
    if (editing) {
      setName(editing.kind === 'edit' ? editing.category.name : '');
      setFailed(false);
    }
  }
  if (editing && editing !== last) setLast(editing);

  const current = editing ?? last;
  const trimmed = name.trim();
  const except = current.kind === 'edit' ? current.category.id : undefined;
  const duplicate = trimmed !== '' && taken(trimmed, except);
  const unchanged = current.kind === 'edit' && trimmed === current.category.name;
  const canSave = trimmed !== '' && !duplicate && !unchanged && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (current.kind === 'edit') {
      onRename(current.category, trimmed);
      onClose();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await onCreate(trimmed);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const title = current.kind === 'edit' ? current.category.name : 'New category';
  return (
    <Sheet open={editing !== null} label={title} title={title} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.fieldLabel} htmlFor="category-name">
          Name
        </label>
        <div className={styles.fieldRow}>
          <input
            id="category-name"
            className={styles.field}
            value={name}
            maxLength={64}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={sheet.ghost} disabled={!canSave}>
            {current.kind === 'edit' ? 'Save' : 'Create'}
          </button>
        </div>
        {duplicate && <p className={styles.problem}>You already have a category with that name.</p>}
        {failed && (
          <p className={styles.problem} role="alert">
            Couldn't reach the server. Try again.
          </p>
        )}
      </form>
      {current.kind === 'edit' && (
        <div className={styles.defaultRow}>
          <span>
            <span className={styles.defaultTitle}>Default category</span>
            <span className={styles.defaultNote}>Your shelf opens on this tab.</span>
          </span>
          <Switch label="Default category" checked={isDefault} onChange={onDefault} />
        </div>
      )}
      {current.kind === 'edit' && (
        <div className={styles.danger}>
          {current.confirmDelete ? (
            <>
              <p>
                {count === 0
                  ? 'It has no titles.'
                  : `Its ${count} ${count === 1 ? 'title stays' : 'titles stay'} in your library.`}
              </p>
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => {
                  onDelete(current.category);
                  onClose();
                }}
              >
                Delete {current.category.name}
              </button>
            </>
          ) : (
            <button type="button" className={styles.deleteLink} onClick={onConfirmDelete}>
              Delete
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
