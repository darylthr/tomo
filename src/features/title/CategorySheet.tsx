import { useState, type FormEvent } from 'react';
import type { Category } from '../../shared/model/types';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import styles from './CategorySheet.module.css';

type Props = {
  open: boolean;
  /** add: the title isn't in the library yet. edit: it is. */
  mode: 'add' | 'edit';
  titleName: string;
  /** The owner's categories (not the built-in default), in shelf order. */
  categories: Category[];
  /** How many library titles each category holds. */
  counts: Map<number, number>;
  selected: number[];
  onCreate: (name: string) => Promise<Category>;
  /** An empty list in edit mode removes the title from the library. */
  onSave: (categoryIds: number[]) => void;
  onClose: () => void;
};

/** Picks a title's categories when adding it to the library, or later to move it. */
export function CategorySheet({ open, mode, titleName, categories, counts, selected, onCreate, onSave, onClose }: Props) {
  const [ticked, setTicked] = useState<number[]>(selected);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setTicked(selected);
      setNaming(false);
      setName('');
    }
  }

  const toggle = (id: number) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const category = await onCreate(trimmed);
      setTicked((t) => [...t, category.id]);
      setName('');
      setNaming(false);
    } catch {
      // The name stays in the field so it can be tried again.
    } finally {
      setCreating(false);
    }
  };

  const remove = mode === 'edit' && ticked.length === 0;
  return (
    <Sheet
      open={open}
      label={mode === 'add' ? `Add ${titleName} to library` : `Categories for ${titleName}`}
      title={mode === 'add' ? 'Add to library' : 'Categories'}
      onClose={onClose}
      footer={
        <button type="button" className={`${sheet.apply} ${remove ? styles.danger : ''}`} onClick={() => onSave(ticked)}>
          {mode === 'add' ? 'Add' : remove ? 'Remove from library' : 'Save'}
        </button>
      }
    >
      <p className={styles.hint}>
        {mode === 'add' ? 'Pick its categories. You can change them any time.' : 'Untick every category to remove it from your library.'}
      </p>
      <ul className={styles.list}>
        {categories.map((c) => (
          <li key={c.id}>
            <label className={styles.option}>
              <input type="checkbox" className={styles.box} checked={ticked.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className={styles.name}>{c.name}</span>
              <span className={styles.count}>{counts.get(c.id) ?? 0}</span>
            </label>
          </li>
        ))}
      </ul>
      {naming ? (
        <form className={styles.newForm} onSubmit={create}>
          <input
            className={styles.field}
            aria-label="Category name"
            placeholder="Category name"
            value={name}
            maxLength={64}
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={sheet.ghost} disabled={!name.trim() || creating}>
            Create
          </button>
        </form>
      ) : (
        <button type="button" className={styles.newButton} onClick={() => setNaming(true)}>
          <span aria-hidden="true">+</span>
          New category
        </button>
      )}
    </Sheet>
  );
}
