import { useState, type CSSProperties } from 'react';
import { useSettings } from '../../shared/settings/store';
import { contrastRatio } from '../../shared/theme/contrast';
import {
  BUILTINS,
  chromeInk,
  deleteTheme,
  onAccent,
  renameTheme,
  resetTheme,
  setColour,
  type Colours,
} from '../../shared/theme/themes';
import { Sheet } from '../../shared/ui/Sheet';
import sheet from '../../shared/ui/Sheet.module.css';
import styles from './ThemeEditor.module.css';

const ROWS: { key: keyof Colours; label: string }[] = [
  { key: 'bg', label: 'Background' },
  { key: 'surface', label: 'Cards and sheets' },
  { key: 'ink', label: 'Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'chrome', label: 'Navbar and frame' },
];

type Props = {
  /** The theme being edited; null closes the editor. */
  id: string | null;
  onClose: () => void;
};

/** A theme's five colours, a live preview, and reset (built-ins) or rename and delete (custom themes). */
export function ThemeEditor({ id, onClose }: Props) {
  const theme = useSettings((s) => s.settings.theme);
  const setTheme = useSettings((s) => s.setTheme);
  // Kept while the sheet animates out, so its content doesn't vanish mid-exit.
  const [shownId, setShownId] = useState(id);
  if (id && id !== shownId) setShownId(id);

  // The theme to show: the one being opened, or the last one while the sheet animates out.
  const target = id ?? shownId;
  const builtin = BUILTINS.find((t) => t.id === target);
  const custom = theme.custom.find((t) => t.id === target);
  const name = builtin?.name ?? custom?.name ?? '';
  const colours: Colours | null = builtin ? { ...builtin.colours, ...theme.overrides[builtin.id] } : (custom?.colours ?? null);
  const edited = !!builtin && Object.keys(theme.overrides[builtin.id] ?? {}).length > 0;

  const [draftName, setDraftName] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [openFor, setOpenFor] = useState<string | null>(null);
  if (id && id !== openFor) {
    setOpenFor(id);
    setDraftName(custom?.name ?? '');
    setConfirming(false);
  }
  if (!id && openFor) setOpenFor(null);

  if (!target || !colours) return <Sheet open={false} label="Theme" title="Theme" onClose={onClose}>{null}</Sheet>;

  const unreadable = contrastRatio(colours.ink, colours.bg) < 4.5 || contrastRatio(colours.ink, colours.surface) < 4.5;
  const preview = {
    '--bg': colours.bg,
    '--surface-base': colours.surface,
    '--ink': colours.ink,
    '--accent': colours.accent,
    '--on-accent': onAccent(colours.accent),
    '--chrome': colours.chrome,
    '--chrome-ink': chromeInk(colours.chrome),
  } as CSSProperties;

  return (
    <Sheet open={id !== null} label={name} title={name} closeLabel="Close theme" onClose={onClose}>
      {custom && (
        <label className={styles.nameRow}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.field}
            value={draftName}
            maxLength={40}
            onChange={(e) => {
              setDraftName(e.target.value);
              const trimmed = e.target.value.trim();
              if (trimmed) setTheme(renameTheme(theme, custom.id, trimmed));
            }}
          />
        </label>
      )}

      <h3 className={styles.heading}>Colours</h3>
      <div className={styles.rows}>
        {ROWS.map(({ key, label }) => (
          <label key={key} className={styles.row}>
            <span>{label}</span>
            <span className={styles.value}>
              <span className={styles.hex}>{colours[key].toUpperCase()}</span>
              <input
                type="color"
                className={styles.swatch}
                aria-label={label}
                value={colours[key]}
                onChange={(e) => setTheme(setColour(theme, target, key, e.target.value))}
              />
            </span>
          </label>
        ))}
      </div>
      {unreadable && <p className={styles.warning}>Text may be hard to read on this background</p>}

      <h3 className={styles.heading}>Preview</h3>
      {/* Static shapes in the theme's colours: a preview, not controls. */}
      <div className={styles.preview} style={preview} data-theme-scope="" aria-hidden="true">
        <div className={styles.previewCard}>
          <div className={styles.previewRow}>
            <span>Show titles as</span>
            <span className={styles.track}>
              <span className={styles.trackOn}>Books</span>
              <span>Covers</span>
            </span>
          </div>
          <div className={styles.previewRow}>
            <span className={styles.previewMuted}>Fade the shelf sides</span>
            <span className={styles.toggle} />
          </div>
        </div>
        <span className={styles.previewPrimary}>Continue · Ch. 2</span>
      </div>

      {builtin && edited && (
        <button type="button" className={`${sheet.ghost} ${styles.wide}`} onClick={() => setTheme(resetTheme(theme, builtin.id))}>
          Reset to {builtin.name}
        </button>
      )}
      {custom &&
        (confirming ? (
          <button
            type="button"
            className={styles.delete}
            onClick={() => {
              setTheme(deleteTheme(theme, custom.id));
              onClose();
            }}
          >
            Delete {custom.name}
          </button>
        ) : (
          <button type="button" className={styles.deleteLink} onClick={() => setConfirming(true)}>
            Delete theme
          </button>
        ))}
    </Sheet>
  );
}
